-- Read-only deployment verification. Expected booleans: true; legacy client write grants: false.
SELECT to_regclass('public.creation_requests') IS NOT NULL AS reservation_table_ready,
       to_regprocedure('public.kaiwu_reserve_creation(uuid,text,text,text,jsonb,jsonb)') IS NOT NULL AS reserve_rpc_ready,
       to_regprocedure('public.kaiwu_settle_creation(uuid,text,boolean,text,jsonb)') IS NOT NULL AS settle_rpc_ready;
SELECT rolname AS role,
       has_function_privilege(rolname,'public.kaiwu_reserve_creation(uuid,text,text,text,jsonb,jsonb)','EXECUTE') AS may_reserve,
       has_function_privilege(rolname,'public.kaiwu_settle_creation(uuid,text,boolean,text,jsonb)','EXECUTE') AS may_settle,
       has_table_privilege(rolname,'public.user_quotas','UPDATE') AS may_change_balance,
       has_table_privilege(rolname,'public.creation_requests','INSERT') AS may_forge_reservation
FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
SELECT relrowsecurity AS reservation_rls_enabled FROM pg_class WHERE oid='public.creation_requests'::regclass;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usage_events' AND column_name='detail') AS usage_detail_ready;
-- Behavior rehearsal including transaction rollback lives in scripts/verify-creation-quota.cjs.
-- It uses isolated in-memory PostgreSQL fixtures and never production account data.
