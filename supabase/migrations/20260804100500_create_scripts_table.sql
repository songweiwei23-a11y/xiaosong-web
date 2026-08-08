-- 创建脚本生成表
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 关联信息
  profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  positioning_id UUID REFERENCES account_positioning(id) ON DELETE SET NULL,
  topic_id UUID,  -- 暂时不设置外键约束，因为topics表可能不存在
  
  -- 脚本参数
  script_type VARCHAR(50),              -- 脚本类型：对比型、揭秘型、教程型等
  duration INTEGER,                      -- 时长（秒）
  content_form VARCHAR(50),              -- 内容形式：口播、Vlog、情景剧、采访
  
  -- 高级设置
  key_lines TEXT,                        -- 关键台词
  emotion_requirement VARCHAR(100),      -- 情绪要求
  feasibility_constraints TEXT,          -- 可落地性约束
  
  -- 生成内容
  script_content TEXT NOT NULL,          -- 生成的脚本内容
  conversation_id VARCHAR(100),          -- Dify对话ID（支持持续对话）
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_profile_id ON scripts(profile_id);
CREATE INDEX IF NOT EXISTS idx_scripts_positioning_id ON scripts(positioning_id);
CREATE INDEX IF NOT EXISTS idx_scripts_topic_id ON scripts(topic_id);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at DESC);

-- 启用RLS
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

-- 删除可能已存在的策略
DROP POLICY IF EXISTS "Users can view own scripts" ON scripts;
DROP POLICY IF EXISTS "Users can insert own scripts" ON scripts;
DROP POLICY IF EXISTS "Users can update own scripts" ON scripts;
DROP POLICY IF EXISTS "Users can delete own scripts" ON scripts;

-- RLS策略：用户只能访问自己的脚本
CREATE POLICY "Users can view own scripts"
  ON scripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scripts"
  ON scripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scripts"
  ON scripts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scripts"
  ON scripts FOR DELETE
  USING (auth.uid() = user_id);

-- 自动更新updated_at
CREATE OR REPLACE FUNCTION update_scripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scripts_updated_at ON scripts;

CREATE TRIGGER scripts_updated_at
  BEFORE UPDATE ON scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_scripts_updated_at();
