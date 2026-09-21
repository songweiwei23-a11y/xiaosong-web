-- 完整的数据库初始化脚本
-- 用于补全现有用户的 user_quotas 和 subscriptions 数据

-- 步骤1: 确保 subscriptions 表存在
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 步骤2: 为现有用户补全 user_quotas
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
  current_period_end,
  created_at,
  updated_at
)
SELECT 
  id,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  NOW(),
  NOW() + INTERVAL '1 month',
  NOW(),
  NOW()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 步骤3: 为现有用户补全 subscriptions（免费版）
INSERT INTO subscriptions (
  user_id,
  plan,
  status,
  start_date,
  created_at,
  updated_at
)
SELECT 
  id,
  'free',
  'active',
  NOW(),
  NOW(),
  NOW()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 步骤4: 验证数据完整性
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
  
  RAISE NOTICE '=== 数据完整性检查 ===';
  RAISE NOTICE '用户总数: %', user_count;
  RAISE NOTICE 'Profile记录: %', profile_count;
  RAISE NOTICE 'Quota记录: %', quota_count;
  RAISE NOTICE 'Subscription记录: %', subscription_count;
  
  IF user_count = profile_count AND user_count = quota_count AND user_count = subscription_count THEN
    RAISE NOTICE '✅ 数据完整！所有用户都有完整记录';
  ELSE
    RAISE WARNING '⚠️ 数据不完整，请检查！';
  END IF;
END $$;

-- 步骤5: 显示用户完整信息
SELECT 
  u.email AS "邮箱",
  p.profile_name AS "姓名",
  CASE 
    WHEN p.user_id IS NOT NULL THEN '✓'
    ELSE '✗'
  END AS "Profile",
  CASE 
    WHEN q.user_id IS NOT NULL THEN '✓'
    ELSE '✗'
  END AS "Quota",
  CASE 
    WHEN s.user_id IS NOT NULL THEN '✓'
    ELSE '✗'
  END AS "Subscription",
  COALESCE(s.plan, 'N/A') AS "套餐",
  COALESCE(s.status, 'N/A') AS "状态"
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN user_quotas q ON u.id = q.user_id
LEFT JOIN subscriptions s ON u.id = s.user_id
ORDER BY u.created_at;
