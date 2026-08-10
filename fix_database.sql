-- 补全数据库脚本
-- 1. 为现有用户创建 user_quotas 记录
INSERT INTO user_quotas (user_id, current_period_start, current_period_end)
SELECT 
  id,
  NOW(),
  NOW() + INTERVAL '1 month'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2. 为现有用户创建免费版订阅记录
INSERT INTO subscriptions (user_id, plan, status, created_at, updated_at)
SELECT 
  id,
  'free',
  'active',
  NOW(),
  NOW()
FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 3. 验证数据
SELECT 
  u.email,
  p.profile_name,
  q.knowledge_used,
  q.script_used,
  s.plan,
  s.status
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN user_quotas q ON u.id = q.user_id
LEFT JOIN subscriptions s ON u.id = s.user_id
ORDER BY u.created_at;
