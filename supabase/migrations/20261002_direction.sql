-- 创作方向（2026-10-02 新增板块，单独一项额度）
-- 用户说目的和想法，AI 基于档案把方向和思路铺开、推荐一个最佳，勾选后去选题、脚本等板块继续。
-- 可以重复执行
alter table public.user_quotas add column if not exists direction_used integer not null default 0;
notify pgrst, 'reload schema';
