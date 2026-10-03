-- 实时监控：只订阅一个无业务正文的版本信号；统计函数仅 service_role 可调用。
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_monitor_signal (
  id integer PRIMARY KEY CHECK (id = 1),
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.admin_monitor_signal(id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.admin_monitor_signal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_monitor_signal FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_monitor_signal TO service_role;
CREATE OR REPLACE FUNCTION public.notify_admin_monitor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.admin_monitor_signal SET revision = revision + 1, updated_at = clock_timestamp() WHERE id = 1;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admin_monitor() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['funnel_events','script_history','usage_events','payment_orders','user_profiles','subscriptions','works'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS admin_monitor_changed ON public.%I', t);
      EXECUTE format('CREATE TRIGGER admin_monitor_changed AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.notify_admin_monitor()', t);
    END IF;
  END LOOP;
  DROP TRIGGER IF EXISTS admin_monitor_changed ON auth.users;
  CREATE TRIGGER admin_monitor_changed AFTER INSERT OR UPDATE OR DELETE ON auth.users
    FOR EACH STATEMENT EXECUTE FUNCTION public.notify_admin_monitor();
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_monitor_signal') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_monitor_signal;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_funnel_counts(p_since timestamptz, p_now timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH signups AS (
    SELECT id FROM auth.users WHERE created_at >= p_since AND created_at <= p_now
  ), visitors AS (
    SELECT kind, count(DISTINCT visitor_id) AS n FROM public.funnel_events
    WHERE created_at >= p_since AND created_at <= p_now GROUP BY kind
  )
  SELECT jsonb_build_object(
    'landing_view', COALESCE((SELECT n FROM visitors WHERE kind = 'landing_view'), 0),
    'landing_try', COALESCE((SELECT n FROM visitors WHERE kind = 'landing_try'), 0),
    'register_view', COALESCE((SELECT n FROM visitors WHERE kind = 'register_view'), 0),
    'signup', (SELECT count(*) FROM signups),
    'activated', (SELECT count(DISTINCT e.user_id) FROM public.usage_events e JOIN signups s ON s.id = e.user_id
      WHERE e.created_at >= p_since AND e.created_at <= p_now
      AND e.feature IN ('positioning','topic','script','storyboard','review','title','opening','growth','dealReason','interview','breakdown','remix')),
    'paid', (SELECT count(DISTINCT o.user_id) FROM public.payment_orders o JOIN signups s ON s.id = o.user_id
      WHERE o.status = 'approved' AND COALESCE(o.reviewed_at, o.created_at) >= p_since AND COALESCE(o.reviewed_at, o.created_at) <= p_now)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_funnel_counts(timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_funnel_counts(timestamptz,timestamptz) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
