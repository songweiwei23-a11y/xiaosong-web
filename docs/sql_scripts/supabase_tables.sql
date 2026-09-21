-- 创建成交理由分析表
CREATE TABLE IF NOT EXISTS deal_reasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT NOT NULL,
  store_type TEXT NOT NULL,
  store_features TEXT,
  target_customer TEXT,
  analysis_result TEXT,
  selected_reasons JSONB NOT NULL, -- 保存选中的成交理由ID数组
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_deal_reasons_user_id ON deal_reasons(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_reasons_created_at ON deal_reasons(created_at DESC);

-- 启用行级安全策略(RLS)
ALTER TABLE deal_reasons ENABLE ROW LEVEL SECURITY;

-- 创建策略:用户只能看到自己的数据
CREATE POLICY "Users can view their own deal reasons"
  ON deal_reasons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deal reasons"
  ON deal_reasons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deal reasons"
  ON deal_reasons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deal reasons"
  ON deal_reasons FOR DELETE
  USING (auth.uid() = user_id);

-- 创建脚本历史记录表
CREATE TABLE IF NOT EXISTS script_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_type TEXT NOT NULL,
  input_data JSONB NOT NULL,
  result TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_history_user_id ON script_history(user_id);
CREATE INDEX IF NOT EXISTS idx_script_history_created_at ON script_history(created_at DESC);

ALTER TABLE script_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history"
  ON script_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history"
  ON script_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 创建用户配置表
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  quota_limit INTEGER DEFAULT 5,
  quota_used INTEGER DEFAULT 0,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 创建自动更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为表添加自动更新时间戳触发器
CREATE TRIGGER update_deal_reasons_updated_at BEFORE UPDATE ON deal_reasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
