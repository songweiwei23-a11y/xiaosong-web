-- 放开 positioning_type 的取值，加上「行业建议」。
--
-- 20260922_positioning_type_brief.sql 只加了「创作简报」，「行业建议」一直没进约束，
-- 所以行业建议保存时数据库直接拒绝（违反 check 约束），接口返回 500，页面此前没有任何提示。
-- 这个迁移需要在生产库手动执行，执行前行业建议保存仍会失败。

alter table public.account_positioning
  drop constraint if exists account_positioning_type_check;

alter table public.account_positioning
  add constraint account_positioning_type_check
  check (positioning_type in ('账号定位', '商业定位', '内容定位', '创作简报', '行业建议'));

-- 自检：应当能插入「行业建议」而不报错。
-- 下面这句只做约束验证，不写入数据（回滚掉）。
do $$
begin
  -- 借用一条已有记录的 user_id / profile_id，避免外键报错
  if exists (select 1 from public.account_positioning limit 1) then
    insert into public.account_positioning (user_id, profile_id, positioning_type, positioning_name, full_content)
    select user_id, profile_id, '行业建议', '约束自检（将被回滚）', 'x'
    from public.account_positioning limit 1;
    raise exception '自检通过，回滚这条测试数据';
  end if;
exception
  when others then
    if sqlerrm = '自检通过，回滚这条测试数据' then
      raise notice '✅ 约束已放开，可以保存「行业建议」';
    else
      raise notice '❌ 约束自检失败：%', sqlerrm;
    end if;
end $$;

-- 看一眼现在各类型各有多少条
select positioning_type, count(*) as 条数
from public.account_positioning
group by positioning_type
order by positioning_type;
