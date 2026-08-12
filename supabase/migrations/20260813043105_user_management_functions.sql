-- =============================================
-- 用户管理核心函数（企业级）
-- 创建时间: 2026-08-13 04:31:05
-- =============================================

-- 1. 封禁用户账号
CREATE OR REPLACE FUNCTION ban_user_account(
    p_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    -- 更新profiles表的account_status
    UPDATE profiles
    SET 
        account_status = 'banned',
        banned_at = NOW(),
        banned_reason = p_reason,
        banned_by = p_admin_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 停用所有订阅
    UPDATE subscriptions
    SET 
        status = 'inactive',
        updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';
    
    -- 记录日志
    INSERT INTO admin_action_logs (admin_id, action, target_user_id, details, created_at)
    VALUES (p_admin_id, 'BAN_USER', p_user_id, json_build_object('reason', p_reason), NOW());
    
    RAISE NOTICE 'User % banned by admin %', p_user_id, p_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 解封用户账号
CREATE OR REPLACE FUNCTION unban_user_account(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- 恢复账号状态
    UPDATE profiles
    SET 
        account_status = 'normal',
        banned_at = NULL,
        banned_reason = NULL,
        banned_by = NULL,
        updated_at = NOW()
    WHERE user_id = p_user_id AND account_status = 'banned';
    
    -- 恢复订阅（如果未过期）
    UPDATE subscriptions
    SET 
        status = 'active',
        updated_at = NOW()
    WHERE user_id = p_user_id 
      AND status = 'inactive'
      AND (end_date IS NULL OR end_date > NOW());
    
    RAISE NOTICE 'User % unbanned', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 软删除用户（保留数据但禁止访问）
CREATE OR REPLACE FUNCTION soft_delete_user(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- 标记为已删除
    UPDATE profiles
    SET 
        account_status = 'deleted',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 停用所有订阅
    UPDATE subscriptions
    SET 
        status = 'cancelled',
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 清空配额（防止继续使用）
    UPDATE user_quotas
    SET 
        remaining_quota = 0,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RAISE NOTICE 'User % soft deleted', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 重置用户配额
CREATE OR REPLACE FUNCTION reset_user_quota(
    p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_plan TEXT;
    v_limits JSONB;
BEGIN
    -- 获取用户的订阅计划
    SELECT plan INTO v_plan
    FROM subscriptions
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- 如果没有订阅，使用免费计划
    IF v_plan IS NULL THEN
        v_plan := 'free';
    END IF;
    
    -- 根据计划设置配额限制
    v_limits := CASE v_plan
        WHEN 'free' THEN '{"script": 5, "topic": 10, "positioning": 5, "freeChat": 20, "storyboard": 5, "review": 5, "title": 10, "dealReason": 5}'::jsonb
        WHEN 'basic' THEN '{"script": 50, "topic": 100, "positioning": 50, "freeChat": 200, "storyboard": 50, "review": 50, "title": 100, "dealReason": 50}'::jsonb
        WHEN 'pro' THEN '{"script": 500, "topic": 1000, "positioning": 500, "freeChat": 2000, "storyboard": 500, "review": 500, "title": 1000, "dealReason": 500}'::jsonb
        ELSE '{"script": 5, "topic": 10, "positioning": 5, "freeChat": 20, "storyboard": 5, "review": 5, "title": 10, "dealReason": 5}'::jsonb
    END;
    
    -- 重置配额
    UPDATE user_quotas
    SET 
        remaining_quota = (v_limits->>'script')::int,
        period_start = NOW(),
        period_end = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 如果不存在配额记录，则插入
    INSERT INTO user_quotas (user_id, remaining_quota, period_start, period_end, created_at, updated_at)
    SELECT p_user_id, (v_limits->>'script')::int, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM user_quotas WHERE user_id = p_user_id);
    
    RAISE NOTICE 'User % quota reset to plan %', p_user_id, v_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 添加必要的字段（如果不存在）
DO $$
BEGIN
    -- 在profiles表添加account_status相关字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='account_status') THEN
        ALTER TABLE profiles ADD COLUMN account_status TEXT DEFAULT 'normal';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='banned_at') THEN
        ALTER TABLE profiles ADD COLUMN banned_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='banned_reason') THEN
        ALTER TABLE profiles ADD COLUMN banned_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='banned_by') THEN
        ALTER TABLE profiles ADD COLUMN banned_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deleted_at') THEN
        ALTER TABLE profiles ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    
    -- 创建索引以提高查询性能
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_account_status') THEN
        CREATE INDEX idx_profiles_account_status ON profiles(account_status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_user_id_status') THEN
        CREATE INDEX idx_profiles_user_id_status ON profiles(user_id, account_status);
    END IF;
END $$;

-- 授予执行权限给认证用户
GRANT EXECUTE ON FUNCTION ban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION unban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_quota TO authenticated;

-- 完成
SELECT 'User management functions created successfully' AS status;