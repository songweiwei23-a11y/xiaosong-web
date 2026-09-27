-- 转化漏斗的匿名事件：首页打开、首页试用、打开注册页（见 lib/funnel.ts）
--
-- 只记一个随机的访客编号（存在访客自己浏览器里），不记 IP、不记任何个人信息。
-- 只能通过服务端接口 /api/funnel 写入（service_role），浏览器直接读写一律拒绝。

CREATE TABLE IF NOT EXISTS funnel_events (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('landing_view', 'landing_try', 'register_view')),
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 后台按"最近 N 天、按事件"统计，这是唯一的查询方式
CREATE INDEX IF NOT EXISTS idx_funnel_events_time ON funnel_events (created_at DESC, kind);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'funnel_events'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.funnel_events', pol.policyname);
  END LOOP;
END $$;

-- 不建任何策略 = 除 service_role 外一律拒绝

SELECT 'funnel_events 已建好' AS 结果;
