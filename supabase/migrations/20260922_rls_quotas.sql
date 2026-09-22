-- 给 user_quotas 和 subscriptions 补上行级安全
--
-- 【问题】这两张表目前未登录就能读全表，而且能写。
-- anon key 是公开在前端 JS 里的（NEXT_PUBLIC_ 前缀，本来就该公开），
-- 所以等于任何人都可以：
--   1. 读到所有用户的套餐、周期和九项用量
--   2. PATCH 任意用户的额度——清零白嫖，或者刷满让对方用不了
--
-- 实测确认：未登录 PATCH user_quotas 返回 204。
--
-- 这比之前删掉的 /api/quota 接口严重得多：那只是一个入口，
-- 堵了入口表还敞着，直接打 Supabase 的 REST 接口一样能改。
--
-- 【修法】用户只能读自己那行，一律不能写。
-- 额度的增减全部由服务端用 service_role 完成（lib/api-guard.ts 的
-- incrementUsageServer），service_role 本来就绕过 RLS，不受这些策略影响。

-- ---------- user_quotas ----------
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- 先清掉可能存在的宽松策略，避免新旧并存时旧的仍然放行
DROP POLICY IF EXISTS "Enable read access for all users" ON user_quotas;
DROP POLICY IF EXISTS "Enable insert for all users" ON user_quotas;
DROP POLICY IF EXISTS "Enable update for all users" ON user_quotas;
DROP POLICY IF EXISTS "Allow all" ON user_quotas;
DROP POLICY IF EXISTS "own quota read" ON user_quotas;

-- 只读自己那行。没有 INSERT/UPDATE/DELETE 策略 = 这三种操作一律拒绝
CREATE POLICY "own quota read" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- ---------- subscriptions ----------
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON subscriptions;
DROP POLICY IF EXISTS "Enable insert for all users" ON subscriptions;
DROP POLICY IF EXISTS "Enable update for all users" ON subscriptions;
DROP POLICY IF EXISTS "Allow all" ON subscriptions;
DROP POLICY IF EXISTS "own subscription read" ON subscriptions;

CREATE POLICY "own subscription read" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ---------- 顺带检查其余几张表 ----------
-- account_positioning 和 scripts 这次没测到，一并加固；
-- 已经有同名策略时 DROP ... IF EXISTS 会先清掉，不会重复创建报错。
ALTER TABLE account_positioning ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own positioning" ON account_positioning;
CREATE POLICY "own positioning" ON account_positioning
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own scripts" ON scripts;
CREATE POLICY "own scripts" ON scripts
  FOR ALL USING (auth.uid() = user_id);
