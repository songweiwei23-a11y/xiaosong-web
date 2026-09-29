-- 前采建档（2026-09-29）
-- 1. 额度：单独一项「前采建档」，计数列 interview_used
-- 2. 档案：存前采原文和提取出的要点，做定位时能参考客户原话
-- 可以重复执行

alter table public.user_quotas
  add column if not exists interview_used integer not null default 0;

alter table public.user_profiles
  add column if not exists interview_notes text,
  add column if not exists interview_highlights text;

comment on column public.user_quotas.interview_used is '前采建档已用次数';
comment on column public.user_profiles.interview_notes is '前采原文（多轮按日期追加），用户可在档案编辑页删除';
comment on column public.user_profiles.interview_highlights is '前采要点：档案字段装不下的事实和客户原话，一行一条；会进账号定位的提示词';
