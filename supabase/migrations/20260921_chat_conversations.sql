-- 对话内容云端存储
--
-- 背景：项目里有两处对话，内容都只存在浏览器里，换设备或刷新就没了：
--   1. 自由对话页：整个会话列表存 localStorage，换电脑/清缓存即全部丢失；
--   2. 生成后的「持续对话」弹窗：消息存在 React state，刷新页面直接清空。
--
-- 注意与 dify_conversations 的区别，两张表不重复：
--   dify_conversations 只存一个「会话指针」（Dify 侧的 conversation_id），
--   让模型记得上下文，但我们自己拿不到聊天内容；
--   本表存的是「聊天记录本身」，用于在界面上把历史对话原样恢复出来。
--
-- messages 用 jsonb 整段存放，与前端的消息数组结构一一对应。
-- 单次对话通常几十条消息，整存整取实现最简；若将来出现超长会话，
-- 再拆成独立的消息行不迟。

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'free_chat' = 自由对话页；'continuous' = 生成结果下的追问弹窗
  kind TEXT NOT NULL,

  -- 追问弹窗记录它来自哪个功能（脚本生成/选题策划…），自由对话为空
  task_type TEXT,

  -- 代运营场景下按账号档案区分，未建档案时为空
  profile_id UUID,

  title TEXT NOT NULL DEFAULT '新对话',

  -- Dify 侧会话标识，续聊时带上它才能保持记忆
  dify_conversation_id TEXT NOT NULL DEFAULT '',

  -- [{ role: 'user'|'assistant', content: string, timestamp: number|string }]
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 列表页按「我的 + 某一类 + 最近更新」查，覆盖该组合
CREATE INDEX IF NOT EXISTS idx_chat_conv_list
  ON chat_conversations(user_id, kind, updated_at DESC);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- 仅本人可见。服务端走 service_role，不受此策略限制。
DROP POLICY IF EXISTS "own chat conversations" ON chat_conversations;
CREATE POLICY "own chat conversations" ON chat_conversations
  FOR ALL USING (auth.uid() = user_id);
