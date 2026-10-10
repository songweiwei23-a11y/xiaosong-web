-- 【草稿，未接入代码，未在线上执行】订单审核与会员开通放进同一个事务（2026-10-10 后台巡检 P2-10）
--
-- 现状：app/api/admin/orders/review/route.ts 分三步写库（改订单 → 写会员 → 清额度），
--       靠代码里的回滚兜底。进程若在中间崩溃，订单可能停在 approved 而会员没开通。
-- 本函数：一个事务内完成三步；任何一步失败整体回滚，订单状态不会先变。
--
-- 套餐到期日、是否续费、额度要不要清零，仍由 lib/config/plans.ts 的 activationPlan() 算好，
-- 作为参数传进来。这样数据库函数不重复业务规则，只负责「要么全做，要么全不做」。
--
-- 接入前必须做的事：
--   1) 在线上 SQL Editor 执行本文件（或放进 supabase/migrations）；
--   2) 在本地或测试库跑通 tests/ 里的对应用例；
--   3) 再改路由去调用 supabase.rpc('admin_approve_order', ...)，并删掉原来的 rollback 逻辑。

create or replace function public.admin_approve_order(
  p_order_id uuid,
  p_admin uuid,
  p_approved boolean,
  p_note text,
  p_plan_id text,
  p_end_date timestamptz,
  p_is_renewal boolean,
  p_reset_quota boolean,
  p_quota_period_end timestamptz,
  p_quota_columns jsonb,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.payment_orders%rowtype;
  k text;
begin
  if p_admin is null then
    raise exception 'admin required' using errcode = '42501';
  end if;

  -- 锁住订单：同一单只有一个管理员能处理
  select * into o from public.payment_orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if o.status <> 'reviewing' then
    raise exception 'order_not_reviewing:%', o.status using errcode = 'P0001';
  end if;

  update public.payment_orders
     set status = case when p_approved then 'approved' else 'rejected' end,
         reviewed_at = p_now,
         reviewer_id = p_admin,
         review_note = nullif(p_note, '')
   where id = p_order_id;

  if p_approved then
    -- 会员：新开 / 升级 / 过期后重买写入套餐和到期日；续费不改 start_date
    insert into public.subscriptions (user_id, plan, status, end_date, start_date, updated_at)
    values (o.user_id, p_plan_id, 'active', p_end_date, case when p_is_renewal then null else p_now end, p_now)
    on conflict (user_id) do update
       set plan = excluded.plan,
           status = 'active',
           end_date = excluded.end_date,
           start_date = case when p_is_renewal then subscriptions.start_date else excluded.start_date end,
           updated_at = excluded.updated_at;

    -- 额度：新开 / 升级 / 重买时清零，开新一轮
    if p_reset_quota then
      insert into public.user_quotas (user_id, current_period_start, current_period_end, updated_at)
      values (o.user_id, p_now, p_quota_period_end, p_now)
      on conflict (user_id) do update
         set current_period_start = excluded.current_period_start,
             current_period_end = excluded.current_period_end,
             updated_at = excluded.updated_at;

      -- 列名来自 COUNTED_FEATURES 派生的 jsonb；%I 会按标识符转义，列名不对会报错并整体回滚
      for k in select jsonb_object_keys(p_quota_columns) loop
        execute format('update public.user_quotas set %I = 0 where user_id = $1', k) using o.user_id;
      end loop;
    end if;
  end if;

  return jsonb_build_object('orderId', p_order_id, 'status', case when p_approved then 'approved' else 'rejected' end);
end;
$$;

revoke all on function public.admin_approve_order(uuid, uuid, boolean, text, text, timestamptz, boolean, boolean, timestamptz, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_approve_order(uuid, uuid, boolean, text, text, timestamptz, boolean, boolean, timestamptz, jsonb, timestamptz) to service_role;
