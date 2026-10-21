-- 次数包（按次创作包）：一次付款，取得一批可消耗的创作次数，用多少扣多少，用完可以再买。
--
-- 【本文件只是待审的迁移，未在任何环境执行。】生产执行前需要用户确认（见 lib/config/count-packs.ts 的状态说明）。
-- 与会员额度的关系：会员额度（user_quotas）保持不变；次数包只在会员额度用完之后才扣（会员额度优先）。
-- 额度的具体数字、有效期、退款规则由配置决定，本迁移不写死任何销售参数。
BEGIN;

-- 1. 发放批次：每笔审核通过的次数包订单一条
CREATE TABLE IF NOT EXISTS public.count_pack_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  pack_id text NOT NULL,
  credits_total integer NOT NULL CHECK (credits_total > 0),
  credits_remaining integer NOT NULL CHECK (credits_remaining >= 0),
  -- null 表示不过期；有效期由配置决定（未确认前测试配置为 365 天）
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (credits_remaining <= credits_total)
);
CREATE INDEX IF NOT EXISTS count_pack_lots_user_expiry ON public.count_pack_lots(user_id, expires_at);

-- 2. 预留：一次创作请求对应一条。预留时先扣减批次，结算失败或两小时未结算则退回
CREATE TABLE IF NOT EXISTS public.count_pack_reservations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  lot_id uuid NOT NULL REFERENCES public.count_pack_lots(id) ON DELETE CASCADE,
  feature text NOT NULL,
  cost integer NOT NULL CHECK (cost > 0),
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'committed', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  settled_at timestamptz,
  PRIMARY KEY (user_id, request_id)
);

-- 3. 账本：只增不改。每次发放、消耗、退回各一条，管理员据此对账
CREATE TABLE IF NOT EXISTS public.count_pack_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.count_pack_lots(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('grant', 'consume', 'return')),
  amount integer NOT NULL CHECK (amount > 0),
  order_id uuid,
  request_id text,
  feature text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS count_pack_ledger_user ON public.count_pack_ledger(user_id, created_at);

-- 三张表只给服务端（service_role）读写；用户通过接口看自己的余额
ALTER TABLE public.count_pack_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_pack_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_pack_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.count_pack_lots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.count_pack_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.count_pack_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.count_pack_lots TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.count_pack_reservations TO service_role;
GRANT SELECT, INSERT ON public.count_pack_ledger TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.count_pack_ledger_id_seq TO service_role;

-- 4. 订单表放宽：次数包订单的 plan_id 以 count_pack_ 开头，billing_cycle 为 pack。
--    会员套餐的取值范围不变；原来的 CHECK 约束按名字不确定，这里按定义找出来删掉再重建。
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.payment_orders'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%plan_id%' OR pg_get_constraintdef(oid) ILIKE '%billing_cycle%')
  LOOP
    EXECUTE format('ALTER TABLE public.payment_orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_plan_id_pack_check
  CHECK (plan_id IN ('basic', 'pro', 'enterprise') OR left(plan_id, 11) = 'count_pack_');
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_billing_cycle_pack_check
  CHECK (billing_cycle IN ('monthly', 'yearly', 'pack'));

-- 5. 预留次数包（只在会员额度已用完、且该功能计次数包时调用）
CREATE OR REPLACE FUNCTION public.kaiwu_reserve_pack_credit(
  p_user_id uuid, p_request_id text, p_feature text, p_fingerprint text, p_cost integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r public.count_pack_reservations%ROWTYPE;
  lot public.count_pack_lots%ROWTYPE;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN RAISE EXCEPTION 'invalid cost'; END IF;
  -- 与会员额度用同一把锁，保证同一用户的预留和结算顺序一致
  PERFORM pg_advisory_xact_lock(hashtextextended('creation:' || p_user_id::text, 0));

  -- 先把超过两小时仍未结算的预留退回（进程中断、结算没到的情况）
  FOR r IN
    SELECT * FROM public.count_pack_reservations
    WHERE user_id = p_user_id AND status = 'pending' AND expires_at <= now()
    FOR UPDATE
  LOOP
    UPDATE public.count_pack_reservations SET status = 'released', settled_at = now()
      WHERE user_id = r.user_id AND request_id = r.request_id;
    UPDATE public.count_pack_lots SET credits_remaining = credits_remaining + r.cost WHERE id = r.lot_id;
    INSERT INTO public.count_pack_ledger(user_id, lot_id, kind, amount, request_id, feature)
      VALUES (p_user_id, r.lot_id, 'return', r.cost, r.request_id, r.feature);
  END LOOP;

  SELECT * INTO r FROM public.count_pack_reservations WHERE user_id = p_user_id AND request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('allowed', false,
      'reason', CASE WHEN r.fingerprint = p_fingerprint AND r.feature = p_feature THEN 'duplicate' ELSE 'conflict' END,
      'state', r.status);
  END IF;

  -- 先用到期最早的批次；不过期的排在最后
  SELECT * INTO lot FROM public.count_pack_lots
    WHERE user_id = p_user_id AND credits_remaining >= p_cost AND (expires_at IS NULL OR expires_at > now())
    ORDER BY expires_at NULLS LAST, created_at
    LIMIT 1
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false, 'reason', 'pack_empty'); END IF;

  UPDATE public.count_pack_lots SET credits_remaining = credits_remaining - p_cost WHERE id = lot.id;
  INSERT INTO public.count_pack_reservations(user_id, request_id, lot_id, feature, cost, fingerprint)
    VALUES (p_user_id, p_request_id, lot.id, p_feature, p_cost, p_fingerprint);
  RETURN jsonb_build_object('allowed', true, 'request_id', p_request_id, 'funded_by', 'count_pack');
END;
$$;

-- 6. 结算次数包预留：成功则记消耗并写用量事件，失败则退回次数。重复调用结果一致。
CREATE OR REPLACE FUNCTION public.kaiwu_settle_pack_credit(
  p_user_id uuid, p_request_id text, p_success boolean, p_task_type text DEFAULT NULL, p_detail jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.count_pack_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('creation:' || p_user_id::text, 0));
  SELECT * INTO r FROM public.count_pack_reservations
    WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled', false); END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('settled',
      (r.status = 'committed' AND p_success) OR (r.status = 'released' AND NOT p_success),
      'state', r.status);
  END IF;

  IF p_success THEN
    UPDATE public.count_pack_reservations SET status = 'committed', settled_at = now()
      WHERE user_id = p_user_id AND request_id = p_request_id;
    INSERT INTO public.count_pack_ledger(user_id, lot_id, kind, amount, request_id, feature)
      VALUES (p_user_id, r.lot_id, 'consume', r.cost, p_request_id, r.feature);
    INSERT INTO public.usage_events(user_id, feature, task_type, detail)
      VALUES (p_user_id, r.feature, p_task_type,
        coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('generation_request_id', p_request_id, 'funded_by', 'count_pack'));
  ELSE
    UPDATE public.count_pack_reservations SET status = 'released', settled_at = now()
      WHERE user_id = p_user_id AND request_id = p_request_id;
    UPDATE public.count_pack_lots SET credits_remaining = credits_remaining + r.cost WHERE id = r.lot_id;
    INSERT INTO public.count_pack_ledger(user_id, lot_id, kind, amount, request_id, feature)
      VALUES (p_user_id, r.lot_id, 'return', r.cost, p_request_id, r.feature);
  END IF;
  RETURN jsonb_build_object('settled', true);
END;
$$;

-- 7. 审核次数包订单：订单状态与发放批次在同一个事务里。只能审一次（订单必须是 reviewing）。
CREATE OR REPLACE FUNCTION public.admin_approve_count_pack_order(
  p_order_id uuid, p_admin uuid, p_approved boolean, p_note text, p_credits integer, p_valid_until timestamptz, p_now timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  o public.payment_orders%ROWTYPE;
  v_lot uuid;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0001'; END IF;
  IF o.status <> 'reviewing' THEN RAISE EXCEPTION 'order_not_reviewing:%', o.status USING ERRCODE = 'P0001'; END IF;
  IF left(o.plan_id, 11) <> 'count_pack_' THEN RAISE EXCEPTION 'not_count_pack' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.payment_orders
    SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
        reviewed_at = p_now,
        reviewer_id = p_admin,
        review_note = nullif(trim(coalesce(p_note, '')), '')
    WHERE id = p_order_id;

  IF p_approved THEN
    IF p_credits IS NULL OR p_credits <= 0 THEN RAISE EXCEPTION 'invalid_credits' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.count_pack_lots(user_id, order_id, pack_id, credits_total, credits_remaining, expires_at, created_at)
      VALUES (o.user_id, p_order_id, o.plan_id, p_credits, p_credits, p_valid_until, p_now)
      RETURNING id INTO v_lot;
    INSERT INTO public.count_pack_ledger(user_id, lot_id, kind, amount, order_id)
      VALUES (o.user_id, v_lot, 'grant', p_credits, p_order_id);
  END IF;

  RETURN jsonb_build_object('orderId', p_order_id,
    'status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    'credits', CASE WHEN p_approved THEN p_credits ELSE 0 END);
END;
$$;

-- 8. 完整结果证据：次数包预留也要能记录（原函数只认会员额度的预留，次数包生成会因此报错）。
--    逻辑与 20261004_creation_completion_evidence.sql 的版本一致，只多了一步：会员预留找不到时，去次数包预留里找。
CREATE OR REPLACE FUNCTION public.kaiwu_record_creation_completion(
  p_user_id uuid,p_request_id text,p_result text,p_result_sha256 text,p_terminal text,
  p_task_type text DEFAULT NULL,p_conversation_id text DEFAULT NULL,p_message_id text DEFAULT NULL,p_usage jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  r public.creation_requests%ROWTYPE;
  pr public.count_pack_reservations%ROWTYPE;
  v_feature text; v_fingerprint text;
  old public.creation_completion_evidence%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('creation:' || p_user_id::text,0));
  SELECT * INTO r FROM public.creation_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF r.status='released' THEN RAISE EXCEPTION 'invalid generation reservation'; END IF;
    v_feature := r.feature; v_fingerprint := r.fingerprint;
  ELSE
    SELECT * INTO pr FROM public.count_pack_reservations WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
    IF NOT FOUND OR pr.status='released' THEN RAISE EXCEPTION 'invalid generation reservation'; END IF;
    v_feature := pr.feature; v_fingerprint := pr.fingerprint;
  END IF;
  IF p_result IS NULL OR length(btrim(p_result))=0 OR octet_length(p_result)>1600000 THEN RAISE EXCEPTION 'invalid completion result'; END IF;
  IF p_terminal NOT IN ('message_end','workflow_finished','recovered_message','structured_result') OR p_terminal IS NULL THEN RAISE EXCEPTION 'invalid completion terminal'; END IF;
  IF p_result_sha256 IS DISTINCT FROM encode(sha256(convert_to(p_result,'UTF8')),'hex') THEN RAISE EXCEPTION 'completion hash mismatch'; END IF;
  SELECT * INTO old FROM public.creation_completion_evidence WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF old.result_sha256<>p_result_sha256 THEN RAISE EXCEPTION 'completion evidence conflict'; END IF;
    RETURN jsonb_build_object('recorded',true);
  END IF;
  INSERT INTO public.creation_completion_evidence(user_id,request_id,feature,request_fingerprint,task_type,result,result_sha256,content_chars,terminal,dify_conversation_id,dify_message_id,usage_metadata)
    VALUES(p_user_id,p_request_id,v_feature,v_fingerprint,p_task_type,p_result,p_result_sha256,char_length(p_result),p_terminal,p_conversation_id,p_message_id,coalesce(p_usage,'{}'::jsonb));
  RETURN jsonb_build_object('recorded',true);
END;
$$;
-- 8b. 证据表的外键：原来 (user_id, request_id) 指向 creation_requests，次数包预留不在那张表里，会被外键拒绝。
--     这里去掉那个外键，改为 user_id 指向 auth.users（删用户时级联删除）；请求是否存在由上面的函数检查。
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.creation_completion_evidence'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.creation_completion_evidence DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.creation_completion_evidence ADD CONSTRAINT creation_completion_evidence_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

REVOKE ALL ON FUNCTION public.kaiwu_record_creation_completion(uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_record_creation_completion(uuid,text,text,text,text,text,text,text,jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.kaiwu_reserve_pack_credit(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kaiwu_settle_pack_credit(uuid, text, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_approve_count_pack_order(uuid, uuid, boolean, text, integer, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_reserve_pack_credit(uuid, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.kaiwu_settle_pack_credit(uuid, text, boolean, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_count_pack_order(uuid, uuid, boolean, text, integer, timestamptz, timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
