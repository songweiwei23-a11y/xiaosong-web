-- 【草稿，未执行】清理代码里已经不再引用的表（2026-10-10 后台巡检 P2-13）
--
-- 执行顺序：
--   1) 先跑下面的「依赖检查」。返回 0 行才往下走。有结果就先别删，找出是谁在用。
--   2) 备份：把要删的表整张复制一份（保留 30 天后再删）。
--   3) 确认备份行数和线上一致，再取消注释 drop 语句执行。
--
-- 线上当前行数（2026-10-10 只读探测）：
--   user_subscriptions           6 行（和 subscriptions 一样多，但代码里没有任何引用）
--   usage_records                0 行
--   payments                     0 行
--   system_config                7 行（代码里没有引用；注意不要和 system_settings 混淆，后者在用）
--   quota_plans_backup_20260812  1 行（备份表，8 月的）
--   admin_action_logs            1 行（历史记录；后台在用的是 admin_logs）
--   support_tickets              0 行
--
-- 注意：user_subscriptions 有 6 行、内容可能和 subscriptions 一样，删之前请再核对一次内容。

-- 1) 依赖检查：视图、函数、触发器里有没有引用这些表
select 'view' as kind, v.viewname::text as name
from pg_views v
where v.schemaname = 'public'
  and (v.definition ilike '%user_subscriptions%' or v.definition ilike '%usage_records%'
    or v.definition ilike '%public.payments%' or v.definition ilike '%system_config%'
    or v.definition ilike '%quota_plans_backup%' or v.definition ilike '%admin_action_logs%'
    or v.definition ilike '%support_tickets%')
union all
select 'function', p.proname::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.prosrc ilike '%user_subscriptions%' or p.prosrc ilike '%usage_records%'
    or p.prosrc ilike '%public.payments%' or p.prosrc ilike '%system_config%'
    or p.prosrc ilike '%quota_plans_backup%' or p.prosrc ilike '%admin_action_logs%'
    or p.prosrc ilike '%support_tickets%')
union all
select 'trigger', t.tgname::text
from pg_trigger t
where not t.tgisinternal
  and t.tgrelid::regclass::text in ('user_subscriptions', 'usage_records', 'payments', 'system_config',
    'quota_plans_backup_20260812', 'admin_action_logs', 'support_tickets');

-- 2) 备份（每张表一份，名字带日期）
-- create table if not exists public.bak_20261010_user_subscriptions as select * from public.user_subscriptions;
-- create table if not exists public.bak_20261010_usage_records as select * from public.usage_records;
-- create table if not exists public.bak_20261010_payments as select * from public.payments;
-- create table if not exists public.bak_20261010_system_config as select * from public.system_config;
-- create table if not exists public.bak_20261010_quota_plans_backup_20260812 as select * from public.quota_plans_backup_20260812;
-- create table if not exists public.bak_20261010_admin_action_logs as select * from public.admin_action_logs;
-- create table if not exists public.bak_20261010_support_tickets as select * from public.support_tickets;

-- 3) 删除（确认备份无误后再取消注释，且不可逆，只能从备份恢复）
-- drop table if exists public.user_subscriptions;
-- drop table if exists public.usage_records;
-- drop table if exists public.payments;
-- drop table if exists public.system_config;
-- drop table if exists public.quota_plans_backup_20260812;
-- drop table if exists public.admin_action_logs;
-- drop table if exists public.support_tickets;
