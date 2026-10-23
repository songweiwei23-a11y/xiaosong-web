-- 质检误报标记（2026-10-23）
--
-- 后台质检看板上，管理员可以把某条提醒标成「误报」或「确认有问题」，用来统计每条规则的误报率
-- （lib/quality-feedback.ts）。只由服务端（service role）读写，开 RLS 不给任何策略。

create table if not exists public.quality_feedback (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  rule_key text not null,
  rule_kind text not null,
  verdict text not null check (verdict in ('false_positive', 'true_positive')),
  admin_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists quality_feedback_rule_idx on public.quality_feedback (rule_key, created_at desc);

alter table public.quality_feedback enable row level security;

notify pgrst, 'reload schema';
