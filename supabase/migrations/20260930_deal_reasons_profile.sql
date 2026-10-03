-- 成交理由按账号档案分别存（2026-09-30）
-- 原来一个用户只有一份，两个号共用；加 profile_id 后每个档案各一份。
-- 老数据 profile_id 为空，哪个档案先保存就认领成哪个档案的。
-- 可以重复执行

alter table if exists public.deal_reasons
  add column if not exists profile_id uuid references public.user_profiles(id) on delete cascade;

create index if not exists deal_reasons_user_profile on public.deal_reasons (user_id, profile_id);

comment on column public.deal_reasons.profile_id is '属于哪个账号档案；为空的是按档案分开之前的老数据';
