-- 用户功能额度追踪表
-- 记录每个用户各项功能的使用次数

CREATE TABLE IF NOT EXISTS user_quotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 功能使用次数（每月重置）
  knowledge_used INTEGER DEFAULT 0,
  positioning_used INTEGER DEFAULT 0,
  topic_used INTEGER DEFAULT 0,
  script_used INTEGER DEFAULT 0,
  free_chat_used INTEGER DEFAULT 0,
  storyboard_used INTEGER DEFAULT 0,
  review_used INTEGER DEFAULT 0,
  title_used INTEGER DEFAULT 0,
  deal_reason_used INTEGER DEFAULT 0,
  
  -- 时间戳
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 索引
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_period_end ON user_quotas(current_period_end);

-- RLS 策略
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的额度
CREATE POLICY "Users can view own quotas"
  ON user_quotas FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以更新自己的额度（通过API）
CREATE POLICY "Users can update own quotas"
  ON user_quotas FOR UPDATE
  USING (auth.uid() = user_id);

-- 管理员可以查看所有用户额度
CREATE POLICY "Admins can view all quotas"
  ON user_quotas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

-- 自动创建用户额度记录的触发器
CREATE OR REPLACE FUNCTION create_user_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_quotas (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_quota
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_quota();

-- 每月重置额度的函数
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE user_quotas
  SET 
    knowledge_used = 0,
    positioning_used = CASE 
      WHEN (SELECT plan FROM subscriptions WHERE user_id = user_quotas.user_id) = 'free' 
      THEN positioning_used  -- 免费版的定位是一次性的，不重置
      ELSE 0 
    END,
    topic_used = 0,
    script_used = 0,
    free_chat_used = 0,
    storyboard_used = 0,
    review_used = 0,
    title_used = 0,
    deal_reason_used = 0,
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 month',
    updated_at = NOW()
  WHERE current_period_end < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 初始化现有用户的额度
INSERT INTO user_quotas (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 注释
COMMENT ON TABLE user_quotas IS '用户功能使用额度追踪表';
COMMENT ON COLUMN user_quotas.positioning_used IS '账号定位使用次数（免费版一次性）';
COMMENT ON COLUMN user_quotas.current_period_start IS '当前计费周期开始时间';
COMMENT ON COLUMN user_quotas.current_period_end IS '当前计费周期结束时间';