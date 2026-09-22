-- 放开 positioning_type 的取值，加上「创作简报」。
--
-- 上一个迁移（20260922_positioning_type.sql）把取值限死成三种：
-- 账号定位 / 商业定位 / 内容定位。现在多了一种「创作简报」——
-- 它是把账号定位转译成各板块直接可用的创作指令，存在同一张表里。
--
-- 不加这一条的后果：保存简报时数据库直接拒绝（违反 check 约束），
-- 页面上只会看到「保存失败」，很难一眼看出是约束挡的。

alter table public.account_positioning
  drop constraint if exists account_positioning_type_check;

alter table public.account_positioning
  add constraint account_positioning_type_check
  check (positioning_type in ('账号定位', '商业定位', '内容定位', '创作简报'));

-- 自检：应当能插入「创作简报」而不报错。
-- 下面这句只做约束验证，不写入数据（回滚掉）。
do $$
begin
  -- 借用一条已有记录的 user_id / profile_id，避免外键报错
  if exists (select 1 from public.account_positioning limit 1) then
    insert into public.account_positioning (user_id, profile_id, positioning_type, positioning_name, full_content)
    select user_id, profile_id, '创作简报', '约束自检（将被回滚）', 'x'
    from public.account_positioning limit 1;
    raise exception '自检通过，回滚这条测试数据';
  end if;
exception
  when others then
    if sqlerrm = '自检通过，回滚这条测试数据' then
      raise notice '✅ 约束已放开，可以保存「创作简报」';
    else
      raise notice '❌ 约束自检失败：%', sqlerrm;
    end if;
end $$;

-- 看一眼现在各类型各有多少条
select positioning_type, count(*) as 条数
from public.account_positioning
group by positioning_type
order by positioning_type;
