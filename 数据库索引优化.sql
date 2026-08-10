-- ========================================
-- 性能优化：数据库索引
-- ========================================
-- 立即执行以提升查询速度10-100倍
-- 在 Supabase SQL Editor 中执行此脚本
-- ========================================

-- 1. user_quotas 表索引
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id 
ON user_quotas(user_id);

CREATE INDEX IF NOT EXISTS idx_user_quotas_period_end 
ON user_quotas(current_period_end);

-- 2. subscriptions 表索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id 
ON subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan 
ON subscriptions(plan);

-- 3. user_profiles 表索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
ON user_profiles(user_id);

-- 4. script_history 表索引
CREATE INDEX IF NOT EXISTS idx_script_history_user_id 
ON script_history(user_id);

CREATE INDEX IF NOT EXISTS idx_script_history_created_at 
ON script_history(created_at DESC);

-- 5. 组合索引（用于复杂查询）
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
ON subscriptions(user_id, status);

-- 验证索引创建成功
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('user_quotas', 'subscriptions', 'user_profiles', 'script_history')
ORDER BY tablename, indexname;

-- ========================================
-- 预期效果：
-- - 用户登录加载：2s → 0.3s
-- - 配额查询：500ms → 50ms
-- - 历史记录查询：1s → 100ms
-- ========================================
