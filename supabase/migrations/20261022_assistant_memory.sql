-- 开物助理：长期对话（对话、消息、摘要）和记忆（助理记下来的长期有用的事）。
-- 只用服务端（service role）读写，所以三张表都开启 RLS 且不建策略，和 account_materials 一样。
-- 可以重复执行（IF NOT EXISTS）。执行前请先备份。

create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '新对话',
  summary text not null default '',
  summarized_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_threads_user_idx
  on public.assistant_threads (user_id, updated_at desc);

alter table public.assistant_threads enable row level security;

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_thread_idx
  on public.assistant_messages (thread_id, created_at);

alter table public.assistant_messages enable row level security;

create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_memories_user_idx
  on public.assistant_memories (user_id, created_at desc);

alter table public.assistant_memories enable row level security;
