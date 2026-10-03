-- 真实数据库事务验收。全部数据变更回滚；不消耗任何用户额度。
BEGIN;
DO $$
DECLARE
  u uuid; a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  r jsonb; p text; n integer;
  limits jsonb := '{"free":3,"basic":20,"pro":60,"enterprise":150}'::jsonb;
BEGIN
  IF has_function_privilege('anon','public.kaiwu_web_search(uuid,jsonb,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.kaiwu_web_search(uuid,jsonb,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'client can forge search authorization';
  END IF;
  SELECT user_id INTO u FROM public.subscriptions WHERE plan='free' AND status='active' LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'free test subject unavailable'; END IF;
  INSERT INTO public.web_search_periods(user_id,period_key,used,pending) VALUES(u,'trial',0,0)
    ON CONFLICT(user_id,period_key) DO UPDATE SET used=0,pending=0;
  r := public.kaiwu_web_search(u,limits,a); IF NOT (r->>'allowed')::boolean THEN RAISE EXCEPTION 'reserve 1 failed'; END IF;
  r := public.kaiwu_web_search(u,limits,b); IF NOT (r->>'allowed')::boolean THEN RAISE EXCEPTION 'reserve 2 failed'; END IF;
  r := public.kaiwu_web_search(u,limits,c); IF NOT (r->>'allowed')::boolean THEN RAISE EXCEPTION 'reserve 3 failed'; END IF;
  r := public.kaiwu_web_search(u,limits,gen_random_uuid()); IF (r->>'allowed')::boolean THEN RAISE EXCEPTION 'overspend'; END IF;
  PERFORM public.kaiwu_settle_web_search(a,'started');
  PERFORM public.kaiwu_settle_web_search(a,'started');
  r := public.kaiwu_web_search(u,limits); IF (r->>'used')::int <> 1 OR (r->>'pending')::int <> 2 THEN RAISE EXCEPTION 'duplicate billing'; END IF;
  PERFORM public.kaiwu_settle_web_search(b,'released');
  r := public.kaiwu_web_search(u,limits); IF (r->>'remaining')::int <> 1 THEN RAISE EXCEPTION 'release failed'; END IF;
  FOREACH p IN ARRAY ARRAY['basic','pro','enterprise'] LOOP
    UPDATE public.subscriptions SET plan=p, end_date=NULL WHERE user_id=u;
    INSERT INTO public.user_quotas(user_id,current_period_start,current_period_end) VALUES(u,now(),now()+interval '1 month')
      ON CONFLICT(user_id) DO UPDATE SET current_period_start=now(),current_period_end=now()+interval '1 month';
    r := public.kaiwu_web_search(u,limits);
    n := (limits->>p)::int;
    IF (r->>'limit')::int <> n OR (r->>'remaining')::int <> n THEN RAISE EXCEPTION 'paid period limit wrong'; END IF;
  END LOOP;
  UPDATE public.subscriptions SET end_date=now()-interval '1 second' WHERE user_id=u;
  r := public.kaiwu_web_search(u,limits); IF (r->>'allowed')::boolean OR (r->>'remaining')::int <> 0 THEN RAISE EXCEPTION 'expired member regains trial'; END IF;
END $$;
ROLLBACK;
SELECT 'ALL PASSED; ALL TEST MUTATIONS ROLLED BACK' AS quota_validation;
