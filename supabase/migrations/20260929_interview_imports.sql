-- 前采建档的历史记录：每次提取一行（2026-09-29）
--
-- 存原文和提取结果，编导可以回来接着核对、改、写入；
-- 提取中途切走了页面，结果也会存在这里，不会白花一次次数。
-- 只能通过服务端接口 /api/interview/* 读写（service_role），浏览器直接读写一律拒绝。
-- 可以重复执行

CREATE TABLE IF NOT EXISTS interview_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 档案名称（新建时是建议的名字，写入后是实际写进去的档案名）
  profile_name TEXT NOT NULL DEFAULT '',
  -- 提取时选的"写进哪个档案"；新建档案时为空
  target_profile_id UUID,
  source TEXT NOT NULL DEFAULT '',
  -- 提取结果（对话修改过的也存这里）
  extraction JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 写进了哪个档案、什么时候；没写入时为空
  saved_profile_id UUID,
  saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interview_imports_user_created ON interview_imports (user_id, created_at DESC);

ALTER TABLE interview_imports ENABLE ROW LEVEL SECURITY;

-- 清空既有策略再决定（策略之间是"或"，漏掉一条宽松的，新限制就形同虚设）
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interview_imports'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.interview_imports', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝

SELECT 'interview_imports 已建好' AS 结果;
