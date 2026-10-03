-- 联网独立计量。所有写入经服务端私有RPC；预占防止并发越限。
BEGIN;
CREATE TABLE IF NOT EXISTS public.web_search_periods (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  pending integer NOT NULL DEFAULT 0 CHECK (pending >= 0),
  PRIMARY KEY (user_id, period_key)
);
CREATE TABLE IF NOT EXISTS public.web_search_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  period_key text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','started','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  FOREIGN KEY (user_id, period_key) REFERENCES public.web_search_periods(user_id, period_key) ON DELETE CASCADE
);
ALTER TABLE public.web_search_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_search_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_search_periods, public.web_search_requests FROM anon, authenticated;
GRANT ALL ON public.web_search_periods, public.web_search_requests TO service_role;

CREATE OR REPLACE FUNCTION public.kaiwu_web_search(p_user_id uuid, p_limits jsonb, p_request_id uuid DEFAULT NULL)
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
  IF v_plan <> 'free' THEN
    SELECT current_period_start, current_period_end INTO q FROM public.user_quotas WHERE user_id = p_user_id;
    IF NOT FOUND OR q.current_period_end IS NULL OR q.current_period_end <= now() THEN
      RETURN jsonb_build_object('allowed',false,'reason','period_unavailable','limit',v_limit,'remaining',v_limit,'used',0,'pending',0,'plan',v_plan);
    END IF;
    v_period := 'paid:' || q.current_period_start::text;
    v_end := q.current_period_end;
  END IF;
  IF p_request_id IS NULL THEN
    SELECT used,pending INTO b FROM public.web_search_periods WHERE user_id=p_user_id AND period_key=v_period;
    IF FOUND THEN v_used := b.used; v_pending := b.pending; END IF;
  ELSE
    INSERT INTO public.web_search_periods(user_id,period_key) VALUES(p_user_id,v_period) ON CONFLICT DO NOTHING;
    SELECT used,pending INTO b FROM public.web_search_periods WHERE user_id=p_user_id AND period_key=v_period FOR UPDATE;
    v_used := b.used; v_pending := b.pending;
    IF EXISTS(SELECT 1 FROM public.web_search_requests WHERE id=p_request_id) THEN
      v_reason := 'duplicate_request';
    ELSIF v_used + v_pending < v_limit THEN
      INSERT INTO public.web_search_requests(id,user_id,period_key) VALUES(p_request_id,p_user_id,v_period);
      UPDATE public.web_search_periods SET pending=pending+1 WHERE user_id=p_user_id AND period_key=v_period;
      v_pending := v_pending+1; v_allowed := true; v_reason := 'reserved';
    END IF;
  END IF;
  RETURN jsonb_build_object('plan',v_plan,'limit',v_limit,'used',v_used,'pending',v_pending,
    'remaining',greatest(0,v_limit-v_used-v_pending),'periodEnd',v_end,
    'allowed',CASE WHEN p_request_id IS NULL THEN v_used+v_pending<v_limit ELSE v_allowed END,
    'reason',v_reason,'requestId',CASE WHEN v_allowed THEN p_request_id ELSE NULL END);
END;
$$;

CREATE OR REPLACE FUNCTION public.kaiwu_settle_web_search(p_request_id uuid, p_state text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  IF p_state NOT IN ('started','released') THEN RAISE EXCEPTION 'invalid search state'; END IF;
  SELECT * INTO r FROM public.web_search_requests WHERE id=p_request_id;
  IF NOT FOUND THEN RETURN; END IF;
  -- 和预占一致：先锁余额行，再锁请求行，防止锁顺序反转。
  PERFORM 1 FROM public.web_search_periods WHERE user_id=r.user_id AND period_key=r.period_key FOR UPDATE;
  SELECT * INTO r FROM public.web_search_requests WHERE id=p_request_id FOR UPDATE;
  IF r.status <> 'reserved' THEN RETURN; END IF;
  UPDATE public.web_search_requests SET status=p_state, started_at=CASE WHEN p_state='started' THEN now() ELSE NULL END WHERE id=p_request_id;
  UPDATE public.web_search_periods SET pending=pending-1, used=used+CASE WHEN p_state='started' THEN 1 ELSE 0 END
    WHERE user_id=r.user_id AND period_key=r.period_key;
END;
$$;
REVOKE ALL ON FUNCTION public.kaiwu_web_search(uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kaiwu_settle_web_search(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_web_search(uuid,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.kaiwu_settle_web_search(uuid,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
