-- ============================================
-- 用户档案表（user_profiles）- 优化版 V3
-- 基于用户思维重新设计，专业编导/MCN适用
-- ============================================

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
  
  -- ========== 第1步：账号基础 ==========
  account_platform TEXT[],                        -- 运营平台（多选）
  account_track TEXT[],                           -- 内容赛道（多选）
  account_stage TEXT,                             -- 账号阶段
  fans_level TEXT,                                -- 粉丝量级
  
  -- ========== 第2步：目标受众 ==========
  target_gender TEXT,                             -- 主要性别
  target_age TEXT[],                              -- 年龄段（多选）
  target_region TEXT[],                           -- 地域分布（多选）
  target_occupation TEXT[],                       -- 职业标签（多选）
  target_pain_points TEXT,                        -- 核心痛点
  target_needs TEXT,                              -- 核心需求
  fan_common_questions TEXT,                      -- 粉丝常问问题（新增）
  target_interests TEXT[],                        -- 兴趣爱好（多选）
  
  -- ========== 第3步：内容定位 ==========
  content_style TEXT[],                           -- 内容风格（多选）
  content_format TEXT[],                          -- 内容形式（多选）
  content_tone TEXT,                              -- 语言风格
  content_themes TEXT,                            -- 主要选题方向
  content_value TEXT,                             -- 核心价值主张
  unique_selling_point TEXT,                      -- 差异化卖点
  viral_content_pattern TEXT,                     -- 爆款基因（新增）
  content_restrictions TEXT,                      -- 内容禁区（新增）
  
  -- ========== 第4步：竞争策略 ==========
  reference_accounts TEXT,                        -- 对标账号
  competitive_advantage TEXT,                     -- 竞争优势
  competitive_weakness TEXT,                      -- 竞争劣势（新增）
  market_opportunity TEXT,                        -- 蓝海机会（新增）
  unique_resources TEXT,                          -- 独家资源（新增）
  
  -- ========== 第5步：资源配置 ==========
  team_structure TEXT,                            -- 团队配置（新增）
  equipment TEXT[],                               -- 设备条件（新增，多选）
  shooting_location TEXT[],                       -- 拍摄场地（新增，多选）
  editing_capability TEXT,                        -- 后期能力（新增）
  video_duration TEXT[],                          -- 视频时长偏好（多选）
  budget_per_video TEXT,                          -- 单条预算（新增）
  
  -- ========== 第6步：变现路径 ==========
  monetization_model TEXT[],                      -- 变现方式（多选）
  product_category TEXT[],                        -- 产品品类（多选）
  price_range TEXT[],                             -- 价格区间（多选）
  conversion_path TEXT,                           -- 完整转化路径（新增）
  conversion_barriers TEXT,                       -- 成交障碍点（新增）
  conversion_hooks TEXT,                          -- 转化话术/钩子（新增）
  
  -- ========== 其他字段 ==========
  avoid_content TEXT,                             -- 禁忌内容（保留）
  conversation_id TEXT,                           -- Dify 对话ID
  last_conversation_at TIMESTAMPTZ,               -- 最后对话时间
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
SELECT 'user_profiles 表（V3优化版）创建成功！' as message,
       '新增字段: 爆款基因、内容禁区、团队配置、转化路径等15个专业字段' as details,
       '多选字段: 13个字段支持多选' as multi_select_info;
