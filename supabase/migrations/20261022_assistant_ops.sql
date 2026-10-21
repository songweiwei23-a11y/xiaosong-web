-- 开物助理：任务存根（服务重启后能告诉用户「没有做完」，并记用量给管理员看）、回答反馈（有用 / 没用）、笔记。
-- 只用服务端（service role）读写，三张表都开启 RLS 且不建策略，和 assistant_memories 一样。
-- 可以重复执行（IF NOT EXISTS）。执行前请先备份。
-- 表没建好时：助理照常对话，只是任务存根、反馈、笔记暂时不可用（界面会如实提示）。

create table if not exists public.assistant_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete set null,
  request_id text,
  status text not null default 'running' check (status in ('running', 'done', 'error', 'stopped', 'interrupted')),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists assistant_jobs_user_idx
  on public.assistant_jobs (user_id, created_at desc);

create index if not exists assistant_jobs_created_idx
  on public.assistant_jobs (created_at desc);

alter table public.assistant_jobs enable row level security;

create table if not exists public.assistant_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid,
  helpful boolean not null,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists assistant_feedback_created_idx
  on public.assistant_feedback (created_at desc);

alter table public.assistant_feedback enable row level security;

create table if not exists public.assistant_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists assistant_notes_user_idx
  on public.assistant_notes (user_id, created_at desc);

alter table public.assistant_notes enable row level security;
