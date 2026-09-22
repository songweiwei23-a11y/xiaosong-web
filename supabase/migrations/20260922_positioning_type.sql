-- 账号定位分成三种：六维地基、商业定位（变现深挖）、内容定位（内容深挖）。
--
-- 为什么要加这一列：三种定位都存在 account_positioning 里，但没有类型标记的话
-- 它们会混在一起。各创作板块通过 useCreatorContext 取"这个号的定位"时，
-- 拿的是最新一条——很可能拿到一份商业定位，而不是六维地基。
-- 那样脚本、选题拿到的账号方向就是错的，而且完全看不出来。
--
-- 默认值设成「账号定位」，现有 3 条记录自动归到六维地基这一类，不用手工回填。

alter table public.account_positioning
  add column if not exists positioning_type text not null default '账号定位';

-- 只允许这三种。写错值不会报错、只会让筛选查不到，用约束挡在源头
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_positioning_type_check'
      and conrelid = 'public.account_positioning'::regclass
  ) then
    alter table public.account_positioning
      add constraint account_positioning_type_check
      check (positioning_type in ('账号定位', '商业定位', '内容定位'));
  end if;
end $$;

-- 按「档案 + 类型」取最新一条是最主要的查询路径
create index if not exists idx_account_positioning_profile_type
  on public.account_positioning (profile_id, positioning_type, created_at desc);

-- 回填：默认值只对新行生效，已有行如果是 null 要补上
update public.account_positioning
set positioning_type = '账号定位'
where positioning_type is null;

-- 自检：应当返回 3 种类型的计数，且现有记录全部是「账号定位」
select positioning_type, count(*) as 条数
from public.account_positioning
group by positioning_type
order by positioning_type;
