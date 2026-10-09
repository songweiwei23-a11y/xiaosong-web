-- 深度研究报告（2026-10-04 产品方定：只给专业会员 99、高频会员 199，单独一份次数，不挤占联网和创作额度）
-- 四样东西，全部只许服务端（service_role）读写，浏览器拿不到：
--   app_secrets        后台设置的服务密钥（联网搜索密钥），只存不回显
--   research_periods / research_requests + 两个 RPC   深度研究次数：预占、开搜时记一次、没搜就失败返还
--   research_jobs      研究任务：主题、深度、研究计划、每一步进度、报告
--   research_sources   读过的网页：报告里每个 [n] 都对应这里的一条，核对引用用
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_secrets TO service_role;

CREATE TABLE IF NOT EXISTS public.research_periods (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  pending integer NOT NULL DEFAULT 0 CHECK (pending >= 0),
  PRIMARY KEY (user_id, period_key)
);
CREATE TABLE IF NOT EXISTS public.research_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  period_key text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','started','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  FOREIGN KEY (user_id, period_key) REFERENCES public.research_periods(user_id, period_key) ON DELETE CASCADE
);
ALTER TABLE public.research_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_periods, public.research_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.research_periods, public.research_requests TO service_role;

-- 和 kaiwu_web_search 同一套规则（会员按当期、到期不给、封禁不给），只是另一本账；额度为 0 的档位明说「不含」
CREATE OR REPLACE FUNCTION public.kaiwu_research_quota(p_user_id uuid, p_limits jsonb, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  s record; q record; b record;
  v_plan text := 'free'; v_limit integer := 0; v_period text := 'trial';
  v_end timestamptz; v_used integer := 0; v_pending integer := 0;
  v_allowed boolean := false; v_reason text := 'quota_exhausted';
BEGIN
  SELECT plan, status, end_date INTO s FROM public.subscriptions WHERE user_id = p_user_id;
  IF FOUND THEN
    IF s.status = 'inactive' THEN
      RETURN jsonb_build_object('allowed',false,'reason','account_inactive','limit',0,'remaining',0,'used',0,'pending',0,'plan','free');
    END IF;
    IF s.status = 'active' AND (s.end_date IS NULL OR s.end_date > now()) AND s.plan IN ('basic','pro','enterprise') THEN
      v_plan := s.plan;
    ELSIF s.plan IN ('basic','pro','enterprise') AND s.end_date <= now() THEN
      RETURN jsonb_build_object('allowed',false,'reason','membership_expired','limit',0,'remaining',0,'used',0,'pending',0,'plan','free');
    END IF;
  END IF;
  v_limit := greatest(0, coalesce((p_limits ->> v_plan)::integer,0));
  IF v_limit = 0 THEN
    RETURN jsonb_build_object('allowed',false,'reason','plan_not_included','limit',0,'remaining',0,'used',0,'pending',0,'plan',v_plan);
  END IF;
  IF v_plan <> 'free' THEN
    SELECT current_period_start, current_period_end INTO q FROM public.user_quotas WHERE user_id = p_user_id;
    IF NOT FOUND OR q.current_period_end IS NULL OR q.current_period_end <= now() THEN
      RETURN jsonb_build_object('allowed',false,'reason','period_unavailable','limit',v_limit,'remaining',v_limit,'used',0,'pending',0,'plan',v_plan);
    END IF;
    v_period := 'paid:' || q.current_period_start::text;
    v_end := q.current_period_end;
  END IF;
  IF p_request_id IS NULL THEN
    SELECT used,pending INTO b FROM public.research_periods WHERE user_id=p_user_id AND period_key=v_period;
    IF FOUND THEN v_used := b.used; v_pending := b.pending; END IF;
  ELSE
    INSERT INTO public.research_periods(user_id,period_key) VALUES(p_user_id,v_period) ON CONFLICT DO NOTHING;
    SELECT used,pending INTO b FROM public.research_periods WHERE user_id=p_user_id AND period_key=v_period FOR UPDATE;
    v_used := b.used; v_pending := b.pending;
    IF EXISTS(SELECT 1 FROM public.research_requests WHERE id=p_request_id) THEN
      v_reason := 'duplicate_request';
    ELSIF v_used + v_pending < v_limit THEN
      INSERT INTO public.research_requests(id,user_id,period_key) VALUES(p_request_id,p_user_id,v_period);
      UPDATE public.research_periods SET pending=pending+1 WHERE user_id=p_user_id AND period_key=v_period;
      v_pending := v_pending+1; v_allowed := true; v_reason := 'reserved';
    END IF;
  END IF;
  RETURN jsonb_build_object('plan',v_plan,'limit',v_limit,'used',v_used,'pending',v_pending,
    'remaining',greatest(0,v_limit-v_used-v_pending),'periodEnd',v_end,
    'allowed',CASE WHEN p_request_id IS NULL THEN v_used+v_pending<v_limit ELSE v_allowed END,
    'reason',CASE WHEN p_request_id IS NULL AND v_used+v_pending<v_limit THEN 'available' ELSE v_reason END,
    'requestId',CASE WHEN v_allowed THEN p_request_id ELSE NULL END);
END;
$$;

CREATE OR REPLACE FUNCTION public.kaiwu_settle_research(p_request_id uuid, p_state text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  IF p_state NOT IN ('started','released') THEN RAISE EXCEPTION 'invalid research state'; END IF;
  SELECT * INTO r FROM public.research_requests WHERE id=p_request_id;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM 1 FROM public.research_periods WHERE user_id=r.user_id AND period_key=r.period_key FOR UPDATE;
  SELECT * INTO r FROM public.research_requests WHERE id=p_request_id FOR UPDATE;
  IF r.status <> 'reserved' THEN RETURN; END IF;
  UPDATE public.research_requests SET status=p_state, started_at=CASE WHEN p_state='started' THEN now() ELSE NULL END WHERE id=p_request_id;
  UPDATE public.research_periods SET pending=pending-1, used=used+CASE WHEN p_state='started' THEN 1 ELSE 0 END
    WHERE user_id=r.user_id AND period_key=r.period_key;
END;
$$;
REVOKE ALL ON FUNCTION public.kaiwu_research_quota(uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kaiwu_settle_research(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_research_quota(uuid,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.kaiwu_settle_research(uuid,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.research_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 档案隔离：和作品、素材库一样，没有档案时为空
  profile_id text,
  topic text NOT NULL,
  depth text NOT NULL CHECK (depth IN ('quick','standard','deep')),
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','plan_ready','running','writing','done','failed','canceled')),
  plan jsonb,
  -- 背景资料：档案摘要 + 上传资料正文（服务端读出来的），写报告时用
  context text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_hash text,
  canvas_versions jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  report text,
  checks jsonb,
  error text,
  quota_request_id uuid,
  client_request_id uuid,
  run_token uuid,
  retry_count integer NOT NULL DEFAULT 0,
  summary_failed boolean NOT NULL DEFAULT false,
  heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_jobs_user_idx ON public.research_jobs(user_id, created_at DESC);
ALTER TABLE public.research_jobs ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.research_jobs ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.research_jobs ADD COLUMN IF NOT EXISTS input_hash text;
ALTER TABLE public.research_jobs ADD COLUMN IF NOT EXISTS canvas_versions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.research_jobs ADD COLUMN IF NOT EXISTS run_token uuid;
ALTER TABLE public.research_jobs ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.research_jobs ADD COLUMN IF NOT EXISTS summary_failed boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS research_jobs_request_idx ON public.research_jobs(user_id, client_request_id);
CREATE TABLE IF NOT EXISTS public.research_sources (
  job_id uuid NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  n integer NOT NULL CHECK (n > 0),
  step integer NOT NULL,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  site text NOT NULL DEFAULT '',
  published text NOT NULL DEFAULT '',
  -- full = 打开网页读到了正文；snippet = 网页打不开，只有搜索结果里的正文
  fetched text NOT NULL DEFAULT 'snippet' CHECK (fetched IN ('full','snippet')),
  content text NOT NULL DEFAULT '',
  PRIMARY KEY (job_id, n)
);
ALTER TABLE public.research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ADD COLUMN IF NOT EXISTS collected_at timestamptz NOT NULL DEFAULT now();
REVOKE ALL ON public.research_jobs, public.research_sources FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.research_jobs, public.research_sources TO service_role;

-- 拟计划也必须占位，限制并发和重复请求；确认前不计已用次数。
CREATE OR REPLACE FUNCTION public.kaiwu_create_research(
  p_user_id uuid, p_request_id uuid, p_profile_id text, p_topic text,
  p_depth text, p_context text, p_limits jsonb, p_attachments jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.research_jobs; q jsonb; v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':research',0));
  SELECT * INTO j FROM public.research_jobs WHERE user_id=p_user_id AND client_request_id=p_request_id;
  IF FOUND THEN
    IF j.topic<>p_topic OR j.depth<>p_depth OR j.profile_id IS DISTINCT FROM p_profile_id OR j.attachments<>p_attachments OR j.input_hash IS DISTINCT FROM md5(p_context)
      THEN RAISE EXCEPTION 'research request conflict'; END IF;
    RETURN jsonb_build_object('id',j.id,'existing',true,'status',j.status);
  END IF;
  IF p_profile_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.user_profiles WHERE id::text=p_profile_id AND user_id=p_user_id
  ) THEN RAISE EXCEPTION 'research profile not owned'; END IF;
  IF (SELECT count(*) FROM public.research_jobs WHERE user_id=p_user_id AND status IN ('planning','plan_ready','running','writing'))>=2
    THEN RETURN jsonb_build_object('allowed',false,'reason','too_many_jobs'); END IF;
  IF (SELECT count(*) FROM public.research_jobs WHERE user_id=p_user_id AND created_at>now()-interval '1 day')>=30
    THEN RETURN jsonb_build_object('allowed',false,'reason','planning_limit'); END IF;
  q:=public.kaiwu_research_quota(p_user_id,p_limits,p_request_id);
  IF NOT coalesce((q->>'allowed')::boolean,false) THEN RETURN q; END IF;
  INSERT INTO public.research_jobs(user_id,profile_id,topic,depth,context,input_hash,attachments,quota_request_id,client_request_id)
    VALUES(p_user_id,p_profile_id,p_topic,p_depth,p_context,md5(p_context),p_attachments,p_request_id,p_request_id) RETURNING id INTO v_id;
  RETURN jsonb_build_object('allowed',true,'id',v_id,'quota',q,'status','planning');
END; $$;
REVOKE ALL ON FUNCTION public.kaiwu_create_research(uuid,uuid,text,text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_create_research(uuid,uuid,text,text,text,text,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.kaiwu_start_research(p_user_id uuid,p_job_id uuid,p_plan jsonb,p_retry boolean,p_limits jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.research_jobs; q jsonb; r public.research_requests; v_request uuid; v_steps jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':research',0));
  SELECT * INTO j FROM public.research_jobs WHERE id=p_job_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'reason','not_found'); END IF;
  q:=public.kaiwu_research_quota(p_user_id,p_limits,NULL);
  IF q->>'reason' IN ('account_inactive','membership_expired','period_unavailable','plan_not_included') THEN RETURN q; END IF;
  IF p_retry THEN
    IF j.status NOT IN ('failed','canceled','done') OR j.plan IS NULL OR j.retry_count>=3
      THEN RETURN jsonb_build_object('allowed',false,'reason','retry_unavailable'); END IF;
    IF j.status='done' AND NOT j.summary_failed AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(j.steps) s WHERE s->>'status'<>'done')
      THEN RETURN jsonb_build_object('allowed',false,'reason','already_done'); END IF;
  ELSIF j.status<>'plan_ready' THEN RETURN jsonb_build_object('allowed',false,'reason','state_changed'); END IF;
  IF (SELECT count(*) FROM public.research_jobs WHERE user_id=p_user_id AND status IN ('running','writing'))>=2
    THEN RETURN jsonb_build_object('allowed',false,'reason','too_many_jobs'); END IF;
  SELECT * INTO r FROM public.research_requests WHERE id=j.quota_request_id;
  v_request:=j.quota_request_id;
  IF NOT FOUND OR r.status='released' OR (r.status='reserved' AND r.period_key<>'paid:'||(SELECT current_period_start::text FROM public.user_quotas WHERE user_id=p_user_id)) THEN
    IF r.status='reserved' THEN PERFORM public.kaiwu_settle_research(r.id,'released'); END IF;
    v_request:=gen_random_uuid();
    q:=public.kaiwu_research_quota(p_user_id,p_limits,v_request);
    IF NOT coalesce((q->>'allowed')::boolean,false) THEN RETURN q; END IF;
  END IF;
  IF p_retry THEN v_steps:=j.steps; ELSE
    IF jsonb_typeof(p_plan->'questions')<>'array' OR jsonb_array_length(p_plan->'questions')<1 OR jsonb_array_length(p_plan->'questions')>8
      THEN RAISE EXCEPTION 'invalid research plan'; END IF;
    SELECT jsonb_agg(jsonb_build_object('status','pending')) INTO v_steps FROM jsonb_array_elements(p_plan->'questions');
  END IF;
  UPDATE public.research_jobs SET plan=CASE WHEN p_retry THEN j.plan ELSE p_plan END,steps=v_steps,status='running',error=NULL,
    run_token=NULL,heartbeat_at=NULL,quota_request_id=v_request,retry_count=retry_count+CASE WHEN p_retry THEN 1 ELSE 0 END,updated_at=now() WHERE id=j.id;
  RETURN jsonb_build_object('allowed',true,'status','running');
END; $$;
REVOKE ALL ON FUNCTION public.kaiwu_start_research(uuid,uuid,jsonb,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_start_research(uuid,uuid,jsonb,boolean,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.kaiwu_cancel_research(p_user_id uuid,p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.research_jobs;
BEGIN
  SELECT * INTO j FROM public.research_jobs WHERE id=p_job_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('found',false); END IF;
  IF j.status IN ('planning','plan_ready','running','writing') THEN
    UPDATE public.research_jobs SET status='canceled',updated_at=now() WHERE id=j.id;
    IF j.status IN ('planning','plan_ready') OR j.run_token IS NULL THEN PERFORM public.kaiwu_settle_research(j.quota_request_id,'released'); END IF;
  END IF;
  RETURN jsonb_build_object('found',true);
END; $$;
REVOKE ALL ON FUNCTION public.kaiwu_cancel_research(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_cancel_research(uuid,uuid) TO service_role;

-- 过期计划与停止后遗留占位的回收，也在任务锁内完成，避免刚补跑就被释放。
CREATE OR REPLACE FUNCTION public.kaiwu_expire_research(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.research_jobs;
BEGIN
  SELECT * INTO j FROM public.research_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF j.status='plan_ready' AND j.updated_at<now()-interval '6 hours' THEN
    UPDATE public.research_jobs SET status='canceled',error='研究计划六小时未确认，已释放占位；可以重试接着研究',updated_at=now() WHERE id=j.id;
    PERFORM public.kaiwu_settle_research(j.quota_request_id,'released');
    RETURN true;
  ELSIF j.status='canceled' AND coalesce(j.heartbeat_at,j.updated_at)<now()-interval '3 minutes' THEN
    PERFORM public.kaiwu_settle_research(j.quota_request_id,'released');
    UPDATE public.research_jobs SET run_token=NULL WHERE id=j.id;
    RETURN true;
  END IF;
  RETURN false;
END; $$;
REVOKE ALL ON FUNCTION public.kaiwu_expire_research(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_expire_research(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
