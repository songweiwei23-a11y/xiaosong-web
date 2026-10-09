-- Deploy before generation routes. Does not reset existing balances or touch web-search quotas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.creation_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  feature text NOT NULL,
  used_column text NOT NULL,
  fingerprint text NOT NULL,
  period_start timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','committed','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  settled_at timestamptz,
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS creation_requests_pending ON public.creation_requests(user_id, period_start, feature) WHERE status='pending';
ALTER TABLE public.creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creation_requests FROM anon, authenticated;
GRANT SELECT ON public.creation_requests TO service_role;
-- Legacy RLS allowed owners to UPDATE their balance. Clients only need SELECT.
REVOKE INSERT, UPDATE, DELETE ON public.user_quotas FROM anon, authenticated;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS detail jsonb;

CREATE OR REPLACE FUNCTION public.kaiwu_reserve_creation(
  p_user_id uuid, p_request_id text, p_feature text, p_fingerprint text, p_plans jsonb, p_features jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  q public.user_quotas%ROWTYPE; s record; r public.creation_requests%ROWTYPE;
  v_plan text := 'free'; v_column text; v_limit integer; v_used integer := 0; v_pending integer;
  v_expired boolean := false; v_roll boolean := false; v_period_end timestamptz;
  f jsonb; v_count integer; v_free integer;
BEGIN
  -- All generation reservations and settlements for one user use the same lock order.
  PERFORM pg_advisory_xact_lock(hashtextextended('creation:' || p_user_id::text,0));
  SELECT * INTO s FROM public.subscriptions WHERE user_id=p_user_id FOR SHARE;
  IF FOUND THEN
    IF s.status='inactive' THEN RETURN jsonb_build_object('allowed',false,'reason','banned'); END IF;
    v_expired := s.status='active' AND s.plan <> 'free' AND s.end_date IS NOT NULL AND s.end_date<=now();
    IF s.status='active' AND (s.end_date IS NULL OR s.end_date>now()) AND p_plans ? s.plan THEN v_plan:=s.plan; END IF;
  END IF;
  SELECT value->>'column' INTO v_column FROM jsonb_array_elements(p_features) WHERE value->>'key'=p_feature;
  IF v_column IS NULL OR v_column NOT IN ('knowledge_used','positioning_used','topic_used','script_used','free_chat_used','storyboard_used','review_used','title_used','deal_reason_used','interview_used','breakdown_used','remix_used','direction_used') THEN
    RAISE EXCEPTION 'invalid feature';
  END IF;
  SELECT * INTO r FROM public.creation_requests WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('allowed',false,'reason',CASE WHEN r.fingerprint=p_fingerprint AND r.feature=p_feature THEN 'duplicate' ELSE 'conflict' END,'state',r.status);
  END IF;
  INSERT INTO public.user_quotas(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO q FROM public.user_quotas WHERE user_id=p_user_id FOR UPDATE;
  IF v_plan<>'free' AND (q.current_period_end IS NULL OR q.current_period_end<now()) THEN
    v_roll:=true;
    -- Match existing plans.ts Date.setMonth rollover, including month-end overflow.
    v_period_end:=date_trunc('month',now())+interval '1 month'
      +(extract(day from now())::integer-1)*interval '1 day'+(now()-date_trunc('day',now()));
    IF s.end_date IS NOT NULL THEN v_period_end:=least(v_period_end,s.end_date); END IF;
    UPDATE public.user_quotas SET current_period_start=now(),current_period_end=v_period_end,updated_at=now() WHERE user_id=p_user_id;
  END IF;
  -- Dynamic column names are quoted and restricted to the allowlist above; function callable only by service_role.
  FOR f IN SELECT value FROM jsonb_array_elements(p_features) LOOP
    IF f->>'column' NOT IN ('knowledge_used','positioning_used','topic_used','script_used','free_chat_used','storyboard_used','review_used','title_used','deal_reason_used','interview_used','breakdown_used','remix_used','direction_used') THEN RAISE EXCEPTION 'invalid column'; END IF;
    IF v_roll THEN
      EXECUTE format('UPDATE public.user_quotas SET %I=0 WHERE user_id=$1',f->>'column') USING p_user_id;
    ELSIF v_expired THEN
      v_free:=(p_plans->'free'->'quotas'->>(f->>'key'))::integer;
      EXECUTE format('UPDATE public.user_quotas SET %I=greatest(coalesce(%I,0),$2) WHERE user_id=$1',f->>'column',f->>'column') USING p_user_id,v_free;
    END IF;
  END LOOP;
  SELECT * INTO q FROM public.user_quotas WHERE user_id=p_user_id;
  IF p_request_id IS NULL THEN RETURN jsonb_build_object('allowed',true,'reason','period_ready'); END IF;
  v_limit:=(p_plans->v_plan->'quotas'->>p_feature)::integer;
  IF p_plans->v_plan->>'totalQuota' IS NOT NULL THEN
    v_limit:=(p_plans->v_plan->>'totalQuota')::integer;
    FOR f IN SELECT value FROM jsonb_array_elements(p_features) LOOP
      v_used:=v_used+coalesce((to_jsonb(q)->>(f->>'column'))::integer,0);
    END LOOP;
    SELECT count(*) INTO v_pending FROM public.creation_requests WHERE user_id=p_user_id AND status='pending' AND expires_at>now() AND period_start IS NOT DISTINCT FROM q.current_period_start;
  ELSE
    v_used:=coalesce((to_jsonb(q)->>v_column)::integer,0);
    SELECT count(*) INTO v_pending FROM public.creation_requests WHERE user_id=p_user_id AND feature=p_feature AND status='pending' AND expires_at>now() AND period_start IS NOT DISTINCT FROM q.current_period_start;
  END IF;
  IF v_limit IS NULL THEN RAISE EXCEPTION 'missing plan configuration'; END IF;
  IF v_limit<>-1 AND v_used+v_pending>=v_limit THEN RETURN jsonb_build_object('allowed',false,'reason','quota','used',v_used+v_pending,'limit',v_limit); END IF;
  INSERT INTO public.creation_requests(user_id,request_id,feature,used_column,fingerprint,period_start) VALUES(p_user_id,p_request_id,p_feature,v_column,p_fingerprint,q.current_period_start);
  RETURN jsonb_build_object('allowed',true,'request_id',p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kaiwu_settle_creation(p_user_id uuid,p_request_id text,p_success boolean,p_task_type text DEFAULT NULL,p_detail jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.creation_requests%ROWTYPE; q public.user_quotas%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('creation:' || p_user_id::text,0));
  SELECT * INTO q FROM public.user_quotas WHERE user_id=p_user_id FOR UPDATE;
  SELECT * INTO r FROM public.creation_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled',false); END IF;
  IF r.status<>'pending' THEN
    RETURN jsonb_build_object('settled',(r.status='committed' AND p_success) OR (r.status='released' AND NOT p_success),'state',r.status);
  END IF;
  IF p_success THEN
    -- Late results from an earlier paid period still create usage events, without consuming the new period.
    IF r.period_start IS NOT DISTINCT FROM q.current_period_start THEN
      EXECUTE format('UPDATE public.user_quotas SET %I=coalesce(%I,0)+1,updated_at=now() WHERE user_id=$1',r.used_column,r.used_column) USING p_user_id;
    END IF;
    INSERT INTO public.usage_events(user_id,feature,task_type,detail)
      VALUES(p_user_id,r.feature,p_task_type,coalesce(p_detail,'{}'::jsonb)||jsonb_build_object('generation_request_id',p_request_id));
  END IF;
  UPDATE public.creation_requests SET status=CASE WHEN p_success THEN 'committed' ELSE 'released' END,settled_at=now() WHERE user_id=p_user_id AND request_id=p_request_id;
  RETURN jsonb_build_object('settled',true);
END;
$$;
REVOKE ALL ON FUNCTION public.kaiwu_reserve_creation(uuid,text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.kaiwu_settle_creation(uuid,text,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_reserve_creation(uuid,text,text,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.kaiwu_settle_creation(uuid,text,boolean,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
