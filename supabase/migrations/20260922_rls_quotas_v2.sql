-- user_quotas / subscriptions 的行级安全（第二版）
--
-- 【第一版为什么没生效】20260922_rls_quotas.sql 用的是
-- `DROP POLICY IF EXISTS "<猜的名字>"`，只覆盖了几个常见的默认命名。
-- 实际存在的宽松策略叫别的名字，没被删掉——而 Postgres 的策略是
-- 「或」的关系，只要还有一条 USING (true)，新加的「只能读自己」
-- 就形同虚设。实测：迁移跑完之后，未登录仍然能读全表、能改别人的额度。
--
-- 这一版不猜名字：先把这两张表上的**所有**策略枚举出来删干净，
-- 再建唯一需要的那条。
--
-- 【为什么只留 SELECT】代码里所有对这两张表的写入都在服务端、
-- 用 service_role 完成（lib/api-guard.ts 的额度扣减、各 admin 接口、
-- 订单审核开通会员）。service_role 天然绕过 RLS，不受这里影响。
-- 客户端只有 lib/history.ts 读自己那行，所以「只能读自己、一律不能写」
-- 既够用又最紧。

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_quotas', 'subscriptions')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
    RAISE NOTICE '已删除策略 %.% -> %', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;
END $$;

ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 只允许登录用户读自己那一行。没有 INSERT/UPDATE/DELETE 策略，
-- 意味着这三种操作对任何非 service_role 的连接一律拒绝。
CREATE POLICY "own quota read" ON public.user_quotas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own subscription read" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 跑完之后应当只剩这两条策略，且都是 SELECT。
-- 结果会直接显示在 SQL Editor 的输出里，方便核对。
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_quotas', 'subscriptions')
ORDER BY tablename, policyname;
