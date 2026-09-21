-- Dify 会话映射表
--
-- 背景：此前 /api/dify/stream 不向 Dify 传 conversation_id，每次生成都是
-- 一次全新对话，模型不知道上一条生成过什么。代码里另有一套"手动记忆"
-- （取最近 5 轮拼进 query），但触发条件依赖前端传 sessionId，而 8 个功能页
-- 从未传过，因此从未生效。
--
-- 改为使用 Dify 原生会话后，需要把 Dify 返回的 conversation_id 持久化，
-- 下次请求带上以延续同一轮对话。
--
-- 会话粒度 = 用户 + 账号档案 + 功能。
-- 代运营场景下一个用户会管多个账号，档案 A 的脚本记忆不应混入档案 B；
-- 不同功能（脚本/选题/分镜）的上下文也应各自独立，否则互相干扰。
-- profile_id 可为空（用户尚未建档案时），故用 scope_key 承载组合键，
-- 避免 Postgres 中 NULL 不参与唯一约束比较导致的重复行。

CREATE TABLE IF NOT EXISTS dify_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 形如 "脚本生成:<profile_id>" 或 "脚本生成:default"
  scope_key TEXT NOT NULL,

  -- 便于排查与后续按维度统计，不参与唯一性判定
  task_type TEXT NOT NULL,
  profile_id UUID,

  -- Dify 侧的会话标识
  conversation_id TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_dify_conv_lookup
  ON dify_conversations(user_id, scope_key);

-- 会话长期不用即失效，保留查询入口便于清理
CREATE INDEX IF NOT EXISTS idx_dify_conv_updated
  ON dify_conversations(updated_at);

ALTER TABLE dify_conversations ENABLE ROW LEVEL SECURITY;

-- 仅本人可见。服务端走 service_role，不受此策略限制。
DROP POLICY IF EXISTS "own dify conversations" ON dify_conversations;
CREATE POLICY "own dify conversations" ON dify_conversations
  FOR ALL USING (auth.uid() = user_id);
