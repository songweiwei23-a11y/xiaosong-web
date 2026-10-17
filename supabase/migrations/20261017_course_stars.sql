-- 抖音新手课每一关拿到的星星：每个人每关一行（见 lib/newbie-course.ts）
--
-- 存在数据库里，换手机、换电脑也能看到自己拿过的星。
-- 只能通过服务端接口 /api/course-stars 读写（service_role），浏览器直接读写一律拒绝。
-- 这张表没建之前，页面只把星星存在访客本机，不影响学。
-- 星星只升不降，由接口按关取大；这里不做检查，过关规则不用这张表。

CREATE TABLE IF NOT EXISTS course_stars (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_no INTEGER NOT NULL CHECK (lesson_no >= 1 AND lesson_no <= 50),
  stars INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0 AND stars <= 3),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_no)
);

ALTER TABLE course_stars ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'course_stars'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.course_stars', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝

SELECT 'course_stars 已建好' AS 结果;
