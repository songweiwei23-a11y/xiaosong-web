-- 内容配比 + 禁忌设置（2026-10-02）
--
-- content_mix：这个号的默认内容配比。形如
--   {"preset":"auto"}                      系统按账号阶段推荐
--   {"preset":"balanced"}                  预设：traffic 引流优先 / balanced 均衡 / convert 成交优先
--   {"preset":"custom","custom":{"流量型":50,"人设型":20,"变现型":30}}
--   规则见 lib/content-mix.ts
--
-- taboo_settings：行业禁忌的开关和补充（第二步上线时用，先把列建好，省得再跑一次）。形如
--   {"disabled":["餐饮-最正宗"],"extra":["不说加盟"]}
--
-- 两列都可以为空：为空就按系统推荐 / 默认全开。

alter table public.user_profiles add column if not exists content_mix jsonb;
alter table public.user_profiles add column if not exists taboo_settings jsonb;

-- 让 PostgREST 立刻认出新列（不然要等它自己刷新缓存）
notify pgrst, 'reload schema';
