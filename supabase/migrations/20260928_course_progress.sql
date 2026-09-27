-- 抖音新手课的闯关进度：每个人一行，过了几关（见 lib/newbie-course.ts）
--
-- 存在数据库里，换手机、换电脑也能接着学。
-- 只能通过服务端接口 /api/course-progress 读写（service_role），浏览器直接读写一律拒绝。
-- 这张表没建之前，页面会先把进度存在访客本机，不影响学。

CREATE TABLE IF NOT EXISTS course_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  passed INTEGER NOT NULL DEFAULT 0 CHECK (passed >= 0 AND passed <= 50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'course_progress'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.course_progress', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝

SELECT 'course_progress 已建好' AS 结果;
