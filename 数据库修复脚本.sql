-- ========================================
-- 小宋编导工作台 - 数据库修复脚本
-- ========================================
-- 此脚本用于创建缺失的表并补全用户数据
-- 请在 Supabase SQL Editor 中执行
-- 访问: https://supabase.com/dashboard/project/nxxbzdstmtuyplcwrrhs/editor
-- ========================================

-- ========================================
-- 步骤1: 创建 user_quotas 表
-- ========================================
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_period_end ON user_quotas(current_period_end);

-- 启用 RLS
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- RLS 策略
DROP POLICY IF EXISTS "Users can view own quotas" ON user_quotas;
CREATE POLICY "Users can view own quotas"
  ON user_quotas FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quotas" ON user_quotas;
CREATE POLICY "Users can update own quotas"
  ON user_quotas FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage quotas" ON user_quotas;
CREATE POLICY "Service role can manage quotas"
  ON user_quotas FOR ALL
  USING (true);

-- ========================================
-- 步骤2: 创建 subscriptions 表
-- ========================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free', -- free, basic, pro, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, expired
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 启用 RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 策略
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (true);

-- ========================================
-- 步骤3: 为现有用户补全数据
-- ========================================

-- 为所有现有用户创建 user_quotas 记录
INSERT INTO user_quotas (
  user_id,
  knowledge_used,
  positioning_used,
  topic_used,
  script_used,
  free_chat_used,
  storyboard_used,
  review_used,
  title_used,
  deal_reason_used,
  current_period_start,
  current_period_end
)
SELECT 
  id,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  NOW(),
  NOW() + INTERVAL '1 month'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 为所有现有用户创建免费版订阅记录
INSERT INTO subscriptions (
  user_id,
  plan,
  status,
  start_date
)
SELECT 
  id,
  'free',
  'active',
  NOW()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ========================================
-- 步骤4: 创建触发器（自动为新用户创建记录）
-- ========================================

-- user_quotas 触发器
CREATE OR REPLACE FUNCTION create_user_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_quotas (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_quota ON auth.users;
CREATE TRIGGER on_auth_user_created_quota
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_quota();

-- subscriptions 触发器
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_subscription();

-- ========================================
-- 步骤5: 验证数据完整性
-- ========================================

-- 统计数据
DO $$
DECLARE
  user_count INTEGER;
  profile_count INTEGER;
  quota_count INTEGER;
  subscription_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM user_profiles;
  SELECT COUNT(*) INTO quota_count FROM user_quotas;
  SELECT COUNT(*) INTO subscription_count FROM subscriptions;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '数据完整性检查结果';
  RAISE NOTICE '========================================';
  RAISE NOTICE '用户总数:        %', user_count;
  RAISE NOTICE 'Profile记录:     %', profile_count;
  RAISE NOTICE 'Quota记录:       %', quota_count;
  RAISE NOTICE 'Subscription记录: %', subscription_count;
  RAISE NOTICE '';
  
  IF user_count = profile_count AND user_count = quota_count AND user_count = subscription_count THEN
    RAISE NOTICE '✅ 数据完整！所有用户都有完整记录';
  ELSE
    RAISE WARNING '⚠️ 数据不完整，部分用户缺少记录';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- 显示用户详细信息
SELECT 
  u.email AS "邮箱",
  p.profile_name AS "姓名",
  CASE WHEN p.user_id IS NOT NULL THEN '✓' ELSE '✗' END AS "Profile",
  CASE WHEN q.user_id IS NOT NULL THEN '✓' ELSE '✗' END AS "Quota",
  CASE WHEN s.user_id IS NOT NULL THEN '✓' ELSE '✗' END AS "Subscription",
  COALESCE(s.plan, 'N/A') AS "套餐",
  COALESCE(s.status, 'N/A') AS "状态"
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN user_quotas q ON u.id = q.user_id
LEFT JOIN subscriptions s ON u.id = s.user_id
ORDER BY u.created_at;

-- ========================================
-- 完成！
-- ========================================
