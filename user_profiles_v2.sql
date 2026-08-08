-- 更新 user_profiles 表结构，匹配前端表单字段
-- 如果表已存在，先删除
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 创建新的 user_profiles 表
CREATE TABLE user_profiles (
  -- 基础字段
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 档案名称
  profile_name TEXT NOT NULL,
  
  -- ========== 1. 基础信息 ==========
  account_platform TEXT[],                        -- 运营平台
  account_track TEXT[],                           -- 内容赛道
  account_stage TEXT,                             -- 账号阶段
  fans_level TEXT,                                -- 粉丝量级
  
  -- ========== 2. 目标受众 ==========
  target_gender TEXT,                             -- 主要性别
  target_age TEXT,                                -- 年龄段
  target_region TEXT,                             -- 地域分布
  target_occupation TEXT,                         -- 职业标签
  target_income TEXT,                             -- 收入水平
  target_pain_points TEXT,                        -- 核心痛点
  target_needs TEXT,                              -- 核心需求
  target_interests TEXT,                          -- 兴趣爱好
  
  -- ========== 3. 内容定位 ==========
  content_style TEXT[],                           -- 内容风格（可多选）
  content_format TEXT[],                          -- 内容形式（可多选）
  content_themes TEXT,                            -- 主要选题方向
  content_tone TEXT,                              -- 语言风格
  content_value TEXT,                             -- 核心价值主张
  unique_selling_point TEXT,                      -- 差异化卖点
  
  -- ========== 4. 创作偏好 ==========
  video_duration TEXT,                            -- 视频时长
  update_frequency TEXT,                          -- 更新频率
  best_post_time TEXT,                            -- 最佳发布时段
  reference_accounts TEXT,                        -- 对标账号
  avoid_content TEXT,                             -- 禁忌内容
  
  -- ========== 5. 变现模式 ==========
  monetization_model TEXT[],                      -- 变现方式（可多选）
  product_category TEXT,                          -- 产品品类
  price_range TEXT,                               -- 价格区间
  target_conversion TEXT,                         -- 转化目标
  competitive_advantage TEXT,                     -- 竞争优势
  
  -- ========== 6. 对话记忆 ==========
  conversation_id TEXT,                           -- Dify 对话ID（用于持续对话）
  last_conversation_at TIMESTAMPTZ,               -- 最后对话时间
  
  -- ========== 7. 其他 ==========
  is_active BOOLEAN DEFAULT TRUE,                 -- 是否启用
  notes TEXT                                      -- 备注说明
);

-- 创建索引
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at DESC);

-- 添加更新时间自动更新触发器
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_user_profiles_updated_at();

-- 启用 RLS（行级安全）
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看和操作自己的档案
CREATE POLICY "用户只能查看自己的档案"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能创建自己的档案"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的档案"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的档案"
  ON user_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- 验证表结构
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 显示创建成功的消息
SELECT 'user_profiles 表创建成功！' as message;
