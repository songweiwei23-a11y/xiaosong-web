-- Legacy owner-executed views can bypass their underlying tables' RLS.
-- Neither view is used by current client routes. Keep admin/server access only.
BEGIN;
REVOKE ALL ON public.v_user_account_status, public.archive_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_user_account_status, public.archive_summary TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
