-- 补上最后三张表的行级安全
--
-- 地毯式扫描时逐表探测未登录读取，发现还有三张是敞着的：
--
--   admin_roles      1 行 —— 谁是管理员、他的 user_id 和角色，一览无余
--   user_settings    1 行 —— 谁的订阅档位、额度上限与已用量
--   system_settings  3 行 —— 站点配置，以及一份早已失效的价格与额度快照
--
-- 单看每一条都不致命（anon key 本来就是公开的，这些也不是密码），
-- 但它们合起来就是一份踩点清单：知道管理员是哪个 UUID，
-- 就知道该往哪个账号使劲。没有任何理由把它们摆在外面。
--
-- 之前修 user_quotas / subscriptions 时用的是「DROP 几个猜的策略名」，
-- 结果漏掉了实际存在的那条宽松策略，改完等于没改。这次一律先枚举清空。

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('admin_roles', 'user_settings', 'system_settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

/*
 * admin_roles 与 user_settings：只允许读自己那一行。
 *
 * 必须留 SELECT，不能一刀切：middleware 判断能不能进后台、
 * lib/admin-auth.ts 的 requireAdmin、/api/admin/check-role
 * 都是用「带用户 Cookie 的 anon 客户端」去读自己那行的。
 * 全禁掉的话管理员自己也进不了后台。
 *
 * 写入一概不开：授权与撤权走 /api/admin/permissions，那里用 service_role，
 * 不受 RLS 约束。
 */
CREATE POLICY "own admin role read" ON public.admin_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own settings read" ON public.user_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

/*
 * system_settings 不建任何策略 = 除 service_role 外一律拒绝。
 *
 * 现在没有任何代码读它：里面的价格和额度快照从来没生效过
 * （真实值在 lib/config/plans.ts），设置页也已经改成只读展示。
 * 表先留着不删，万一日后要做「数据库里的配置」还用得上，
 * 但没有理由让它对外可见。
 */

-- 跑完确认：应当只剩两条 SELECT 策略，system_settings 一条都没有
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('admin_roles', 'user_settings', 'system_settings')
ORDER BY tablename;
