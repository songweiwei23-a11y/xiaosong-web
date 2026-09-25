-- 使用记录 + 待办事项
--
-- 【使用记录为什么要单独一张表】
-- 首页「本月已用」原来读 user_quotas 的计数器，有两个毛病：
--   1. 企业版在额度检查里直接放行，跳过了「周期到期就重置」那一步——
--      周期 9 月 9 日到期后再没重置过，首页接口看到"周期已结束"就一直显示 0；
--   2. 计数器是按 30 天滚动周期累计的，和"本月"对不上。
-- 计数器仍然管限额（它跟着订阅周期走），但"这个月用了几次"要按自然月、按真实发生的次数算，
-- 所以每次成功生成记一条，只增不删——用户删了历史记录，用过的次数也还在。

CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 计费功能代码（script / topic / positioning …），和 user_quotas 的列对应
  feature TEXT NOT NULL,
  -- 页面发来的任务名（脚本生成 / 内容定位 …），方便以后按板块看用量
  task_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_time
  ON usage_events(user_id, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- 只能看自己的；写入只由服务端（service_role，不受 RLS 限制）完成，用户不能自己加减
DROP POLICY IF EXISTS "read own usage" ON usage_events;
CREATE POLICY "read own usage" ON usage_events
  FOR SELECT USING (auth.uid() = user_id);

-- 把本月已经发生的生成补进来（按北京时间的自然月），上线当天数字就是对的。
-- 只在表还是空的时候补，重复执行这个文件不会补两遍。
INSERT INTO usage_events (user_id, feature, task_type, created_at)
SELECT user_id, 'history', task_type, created_at
FROM script_history
WHERE created_at >= (date_trunc('month', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai')
  AND user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM usage_events);


-- 待办事项：首页上自己记的事，跟着账号走，换台电脑也在
CREATE TABLE IF NOT EXISTS user_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 200),
  -- 可选：什么时候要做完
  due_at TIMESTAMPTZ,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_todos_user
  ON user_todos(user_id, done, created_at DESC);

ALTER TABLE user_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own todos" ON user_todos;
CREATE POLICY "own todos" ON user_todos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
