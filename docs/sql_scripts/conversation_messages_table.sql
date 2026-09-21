-- 对话历史表
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- 对话会话信息
  session_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  
  -- 消息内容
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_user ON conversation_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_profile ON conversation_messages(profile_id);

-- RLS 策略
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的对话
CREATE POLICY "用户查看自己的对话消息"
  ON conversation_messages FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的对话
CREATE POLICY "用户创建自己的对话消息"
  ON conversation_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的对话
CREATE POLICY "用户删除自己的对话消息"
  ON conversation_messages FOR DELETE
  USING (auth.uid() = user_id);

-- 清理函数：自动删除7天前的对话历史（可选）
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_messages
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE conversation_messages IS '对话历史表 - 存储用户与AI的对话记录，用于实现对话记忆';
