-- 账号定位表
CREATE TABLE IF NOT EXISTS account_positioning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- 定位基本信息
  positioning_name TEXT NOT NULL, -- 定位名称（如：美食探店博主、职场穿搭达人）
  positioning_description TEXT, -- 定位描述
  
  -- 核心定位要素
  core_value TEXT, -- 核心价值（我能为粉丝提供什么）
  differentiation TEXT, -- 差异化优势（我和别人有什么不同）
  target_user_profile TEXT, -- 目标用户画像
  content_direction TEXT[], -- 内容方向（多个）
  monetization_path TEXT[], -- 变现路径
  
  -- 7天测试计划
  seven_day_plan JSONB, -- 7天内容测试计划
  success_criteria TEXT, -- 判断标准
  
  -- 完整的AI生成内容
  full_content TEXT, -- 完整的账号定位方案
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true -- 是否为当前激活的定位
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_positioning_user ON account_positioning(user_id);
CREATE INDEX IF NOT EXISTS idx_positioning_profile ON account_positioning(profile_id);
CREATE INDEX IF NOT EXISTS idx_positioning_active ON account_positioning(user_id, is_active);

-- RLS 策略
ALTER TABLE account_positioning ENABLE ROW LEVEL SECURITY;

-- 用户只能看到自己的定位
CREATE POLICY "用户查看自己的定位"
  ON account_positioning FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的定位
CREATE POLICY "用户创建自己的定位"
  ON account_positioning FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的定位
CREATE POLICY "用户更新自己的定位"
  ON account_positioning FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户只能删除自己的定位
CREATE POLICY "用户删除自己的定位"
  ON account_positioning FOR DELETE
  USING (auth.uid() = user_id);

-- 触发器：更新时间戳
CREATE OR REPLACE FUNCTION update_positioning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_positioning_timestamp
  BEFORE UPDATE ON account_positioning
  FOR EACH ROW
  EXECUTE FUNCTION update_positioning_updated_at();

COMMENT ON TABLE account_positioning IS '账号定位表 - 存储用户基于档案生成的账号定位方案';
