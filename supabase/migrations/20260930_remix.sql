-- 跨行业二创（2026-09-30）：单独一项额度，计数列 remix_used
-- 二创结果存在 script_history（task_type = '跨行业二创'），不另建表
-- 可以重复执行

alter table public.user_quotas
  add column if not exists remix_used integer not null default 0;

comment on column public.user_quotas.remix_used is '跨行业二创已用次数';
