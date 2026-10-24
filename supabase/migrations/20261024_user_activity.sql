-- 用户动态流水（2026-10-24）：登录、注册、生成、对话、保存定位、充值下单，都由数据库触发器记一条。
-- 实时监控的「最近活跃」「实时动态」和按人查看的时间线，都从这张表读，各板块看到的是同一份记录。
-- 记流水失败只写 warning，不影响登录、生成和保存本身。只由服务端（service role）读写，开 RLS 不给策略。

create table if not exists public.user_activity (
  id bigserial primary key,
  user_id uuid not null,
  kind text not null,
  label text not null default '',
  ref_kind text,
  ref_id text,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_user_idx on public.user_activity (user_id, created_at desc);
create index if not exists user_activity_time_idx on public.user_activity (created_at desc);

alter table public.user_activity enable row level security;

create or replace function public.user_activity_add(
  p_user text, p_kind text, p_label text, p_ref_kind text, p_ref_id text, p_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_activity (user_id, kind, label, ref_kind, ref_id, created_at)
  values (p_user::uuid, p_kind, coalesce(p_label, ''), p_ref_kind, p_ref_id, coalesce(p_at, now()));
exception when others then
  raise warning 'user_activity 记录失败: %', sqlerrm;
end $$;

create or replace function public.trg_activity_login() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.user_activity_add(new.id::text, 'login', '登录', null, null, new.last_sign_in_at);
  return new;
end $$;

create or replace function public.trg_activity_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.user_activity_add(new.id::text, 'signup', '注册', null, null, new.created_at);
  return new;
end $$;

create or replace function public.trg_activity_history() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    perform public.user_activity_add(new.user_id::text, 'generation', coalesce(new.task_type, '未知功能'), 'history', new.id::text, new.created_at);
  end if;
  return new;
end $$;

create or replace function public.trg_activity_usage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    perform public.user_activity_add(new.user_id::text, 'usage', coalesce(new.task_type, new.feature, '未知功能'), 'usage', new.id::text, new.created_at);
  end if;
  return new;
end $$;

create or replace function public.trg_activity_positioning() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    perform public.user_activity_add(new.user_id::text, 'positioning', coalesce(new.positioning_type, '账号定位'), null, new.id::text, new.created_at);
  end if;
  return new;
end $$;

create or replace function public.trg_activity_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    perform public.user_activity_add(new.user_id::text, 'order', coalesce(new.plan_name, new.plan_id, '充值'), 'order', new.id::text, new.created_at);
  end if;
  return new;
end $$;

drop trigger if exists user_activity_login on auth.users;
create trigger user_activity_login after update of last_sign_in_at on auth.users
  for each row when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.trg_activity_login();

drop trigger if exists user_activity_signup on auth.users;
create trigger user_activity_signup after insert on auth.users
  for each row execute function public.trg_activity_signup();

drop trigger if exists user_activity_history on public.script_history;
create trigger user_activity_history after insert on public.script_history
  for each row when (new.input_data->>'canvasOf' is null)
  execute function public.trg_activity_history();

drop trigger if exists user_activity_usage on public.usage_events;
create trigger user_activity_usage after insert on public.usage_events
  for each row execute function public.trg_activity_usage();

drop trigger if exists user_activity_positioning on public.account_positioning;
create trigger user_activity_positioning after insert on public.account_positioning
  for each row execute function public.trg_activity_positioning();

drop trigger if exists user_activity_order on public.payment_orders;
create trigger user_activity_order after insert on public.payment_orders
  for each row execute function public.trg_activity_order();

-- 回填近 30 天的历史（只在流水表是空的时候做一次）。登录只能回填每人最近一次登录，之前的登录已经无从查起。
do $$
begin
  if not exists (select 1 from public.user_activity) then
    insert into public.user_activity (user_id, kind, label, ref_kind, ref_id, created_at)
    select user_id, 'generation', coalesce(task_type, '未知功能'), 'history', id::text, created_at
      from public.script_history
     where created_at >= now() - interval '30 days' and user_id is not null and input_data->>'canvasOf' is null;
    insert into public.user_activity (user_id, kind, label, ref_kind, ref_id, created_at)
    select user_id, 'usage', coalesce(task_type, feature, '未知功能'), 'usage', id::text, created_at
      from public.usage_events
     where created_at >= now() - interval '30 days' and user_id is not null;
    insert into public.user_activity (user_id, kind, label, ref_kind, ref_id, created_at)
    select user_id, 'positioning', coalesce(positioning_type, '账号定位'), null, id::text, created_at
      from public.account_positioning
     where created_at >= now() - interval '30 days' and user_id is not null;
    insert into public.user_activity (user_id, kind, label, ref_kind, ref_id, created_at)
    select user_id, 'order', coalesce(plan_name, plan_id, '充值'), 'order', id::text, created_at
      from public.payment_orders
     where created_at >= now() - interval '30 days' and user_id is not null;
    insert into public.user_activity (user_id, kind, label, ref_kind, ref_id, created_at)
    select id, 'signup', '注册', null, null, created_at
      from auth.users
     where created_at >= now() - interval '30 days';
    insert into public.user_activity (user_id, kind, label, ref_kind, ref_id, created_at)
    select id, 'login', '登录', null, null, last_sign_in_at
      from auth.users
     where last_sign_in_at >= now() - interval '30 days';
  end if;
end $$;

notify pgrst, 'reload schema';
