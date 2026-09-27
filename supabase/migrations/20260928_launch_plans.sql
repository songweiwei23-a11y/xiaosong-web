-- 7 天起号计划：每个人一行，记什么时候开始的、哪几天做完了
--
-- 注册后给小白一条照着走的路，每天一件事，7 天发出 7 条（见 lib/launch-plan.ts）。
-- 只能通过服务端接口 /api/launch-plan 读写（service_role），浏览器直接读写一律拒绝。

CREATE TABLE IF NOT EXISTS launch_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_days INTEGER[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE launch_plans ENABLE ROW LEVEL SECURITY;

-- 清空既有策略再决定（策略之间是"或"，漏掉一条宽松的，新限制就形同虚设）
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'launch_plans'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.launch_plans', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝

SELECT 'launch_plans 已建好' AS 结果;
