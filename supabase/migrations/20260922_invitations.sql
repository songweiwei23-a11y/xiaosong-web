-- 邀请码：注册必须凭码
--
-- invitation_codes 表本身早就存在（100 行，其中 5 个已被用掉），
-- 字段也设计得挺完整，但代码里一处都没引用过——等于这张表一直在那儿闲着，
-- 而注册是完全开放的。这次把它真正接上。
--
-- 【安全前提，必须一并做】注册目前走的是浏览器里的 supabase.auth.signUp()，
-- 用的是公开的 anon key。任何人都可以绕过我们的页面，直接 POST 到
-- Supabase 的 /auth/v1/signup 完成注册——前端加多少校验都拦不住。
-- 实测确认过：当前这个接口是通的。
--
-- 所以除了这份迁移，还必须在 Supabase 控制台关掉公开注册：
--   Authentication → Sign In / Providers → Email → 关闭 "Allow new users to sign up"
-- 关掉之后，唯一的注册入口就是我们的 /api/auth/register，
-- 它在服务端用 service_role 建号，而 service_role 不受该开关限制。

-- ---------- 结构补齐 ----------

-- 码必须唯一。没有这条约束的话，并发生成时可能撞码，
-- 兑换时 .eq('code', X) 会命中多行，行为不可预期
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_codes_code
  ON invitation_codes (code);

-- 后台列表按状态筛、按时间倒序，这是唯一的查询方式
CREATE INDEX IF NOT EXISTS idx_invitation_codes_list
  ON invitation_codes (status, created_at DESC);

-- 作废用。原表的 status 只出现过 'active'，这里放开到四种：
--   active   未使用，可兑换
--   used     已被兑换
--   revoked  管理员手动作废
--   expired  过了 expires_at（由查询时判定，不做定时任务）
ALTER TABLE invitation_codes
  DROP CONSTRAINT IF EXISTS invitation_codes_status_check;
ALTER TABLE invitation_codes
  ADD CONSTRAINT invitation_codes_status_check
  CHECK (status IN ('active', 'used', 'revoked', 'expired'));

-- 已经有 used_by 的历史数据，状态要跟着对上，
-- 否则后台列表里它们会一直显示成「未使用」
UPDATE invitation_codes
SET status = 'used'
WHERE used_by IS NOT NULL AND status = 'active';

-- ---------- 权限 ----------
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- 把所有既有策略清干净再建。上次 RLS 迁移就是栽在「猜策略名」上：
-- 漏掉的宽松策略还在，而策略之间是「或」的关系，新加的限制形同虚设。
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitation_codes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.invitation_codes', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝。
--
-- 邀请码不能让浏览器读到：一旦能读，任何人拉一遍表就拿到全部可用码，
-- 这个门就白设了。兑换与生成全部在服务端完成。

-- ---------- 兑换：一次原子操作 ----------
--
-- 为什么要写成数据库函数：兑换必须「检查 + 占用」不可分割。
-- 如果先 SELECT 判断可用、再 UPDATE 占用，两个人同时提交同一个码时，
-- 两边都会读到「可用」，于是一个码放进来两个人。
-- 放在一条 UPDATE ... WHERE 里，行锁保证只有一个人能改成功。
CREATE OR REPLACE FUNCTION claim_invitation_code(p_code TEXT, p_user_id UUID)
RETURNS TABLE (ok BOOLEAN, reason TEXT, plan_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row invitation_codes%ROWTYPE;
BEGIN
  -- 先原子占用：只有「active 且尚未被用且未过期」的码能被改动
  UPDATE invitation_codes
  SET used_by = p_user_id,
      used_at = NOW(),
      status = 'used'
  WHERE upper(code) = upper(btrim(p_code))
    AND status = 'active'
    AND used_by IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT, v_row.plan_type;
    RETURN;
  END IF;

  -- 没占上，回头查清楚是哪种情况，好给用户一句有用的话
  SELECT * INTO v_row FROM invitation_codes
  WHERE upper(code) = upper(btrim(p_code)) LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '邀请码不存在，请检查是否输错'::TEXT, NULL::TEXT;
  ELSIF v_row.status = 'revoked' THEN
    RETURN QUERY SELECT FALSE, '这个邀请码已被管理员作废'::TEXT, NULL::TEXT;
  ELSIF v_row.used_by IS NOT NULL OR v_row.status = 'used' THEN
    RETURN QUERY SELECT FALSE, '这个邀请码已经被使用过了'::TEXT, NULL::TEXT;
  ELSIF v_row.expires_at IS NOT NULL AND v_row.expires_at <= NOW() THEN
    RETURN QUERY SELECT FALSE, '这个邀请码已过期'::TEXT, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, '邀请码不可用'::TEXT, NULL::TEXT;
  END IF;
END $$;

-- 只有服务端（service_role）能调用。给 authenticated/anon 开权限的话，
-- 就等于把兑换能力交给了浏览器，可以被拿来暴力撞码
REVOKE ALL ON FUNCTION claim_invitation_code(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_invitation_code(TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION claim_invitation_code(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_invitation_code(TEXT, UUID) TO service_role;

-- 跑完看一眼现状
SELECT status, count(*) AS 数量
FROM invitation_codes
GROUP BY status
ORDER BY status;
