-- 创作进度：导入的文件（任意格式读出的文字，只给分析用）和账号作品概况（配比、三类反馈、规划）。
-- 只用服务端（service role）读写，所以两张表都开启 RLS 且不建策略，和 user_signals 一样。
-- 可以重复执行（IF NOT EXISTS）。执行前请先备份。

create table if not exists public.account_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  filename text not null,
  kind text not null,
  status text not null,
  note text,
  byte_size integer not null default 0,
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists account_materials_profile_idx
  on public.account_materials (user_id, profile_id, created_at desc);

alter table public.account_materials enable row level security;

create table if not exists public.account_work_insights (
  profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  insight jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.account_work_insights enable row level security;
