-- 拆解爆款（2026-09-30）：单独一项额度，计数列 breakdown_used
-- 拆解结果存在 script_history（task_type = '拆解爆款'），不另建表；视频本身不上传、不保存
-- 可以重复执行

alter table public.user_quotas
  add column if not exists breakdown_used integer not null default 0;

comment on column public.user_quotas.breakdown_used is '拆解爆款已用次数';
