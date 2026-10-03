-- 自动质检记录（2026-10-03）
--
-- 每次生成完浏览器体检一遍（踩禁忌、用了排除的信息、配比对不上、年限和人设事实卡不符），记一笔；
-- 每晚服务器拿固定档案回归一次（source = 'nightly'）。后台「质检看板」按它出趋势。规则见 lib/quality-checks.ts。
-- 只由服务端（service role）读写，开 RLS 不给任何策略：普通用户读不到也写不了。

create table if not exists public.quality_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  profile_id uuid,
  task_type text not null,
  source text not null default 'live',
  passed boolean not null,
  issues jsonb not null default '[]'::jsonb,
  sample text,
  created_at timestamptz not null default now()
);

create index if not exists quality_checks_created_at_idx on public.quality_checks (created_at desc);
create index if not exists quality_checks_source_idx on public.quality_checks (source, created_at desc);

alter table public.quality_checks enable row level security;

notify pgrst, 'reload schema';
