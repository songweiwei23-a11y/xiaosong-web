-- =============================================
-- 用户管理函数（正确版本 - 使用user_profiles）
-- =============================================

-- 1. 删除旧函数
DROP FUNCTION IF EXISTS ban_user_account(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS unban_user_account(UUID);
DROP FUNCTION IF EXISTS soft_delete_user(UUID);
DROP FUNCTION IF EXISTS reset_user_quota(UUID);

-- 2. 添加必要字段到user_profiles表
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='account_status') THEN
        ALTER TABLE user_profiles ADD COLUMN account_status TEXT DEFAULT 'normal';
        COMMENT ON COLUMN user_profiles.account_status IS '账号状态: normal, banned, deleted';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='banned_at') THEN
        ALTER TABLE user_profiles ADD COLUMN banned_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='banned_reason') THEN
        ALTER TABLE user_profiles ADD COLUMN banned_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='banned_by') THEN
        ALTER TABLE user_profiles ADD COLUMN banned_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='deleted_at') THEN
        ALTER TABLE user_profiles ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status ON user_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_status ON user_profiles(user_id, account_status);

-- 4. 封禁用户函数
CREATE OR REPLACE FUNCTION ban_user_account(
    p_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    -- 更新user_profiles表
    UPDATE user_profiles
    SET 
        account_status = 'banned',
        banned_at = NOW(),
        banned_reason = p_reason,
        banned_by = p_admin_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 停用订阅
    UPDATE subscriptions
    SET status = 'inactive', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';
    
    -- 记录日志
    INSERT INTO admin_action_logs (admin_id, action, target_user_id, details, created_at)
    VALUES (p_admin_id, 'BAN_USER', p_user_id, json_build_object('reason', p_reason), NOW());
    
    RAISE NOTICE 'User % banned by admin %', p_user_id, p_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 解封用户函数
CREATE OR REPLACE FUNCTION unban_user_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET 
        account_status = 'normal',
        banned_at = NULL,
        banned_reason = NULL,
        banned_by = NULL,
        updated_at = NOW()
    WHERE user_id = p_user_id AND account_status = 'banned';
    
    -- 恢复订阅（如果未过期）
    UPDATE subscriptions
    SET status = 'active', updated_at = NOW()
    WHERE user_id = p_user_id 
      AND status = 'inactive'
      AND (end_date IS NULL OR end_date > NOW());
    
    RAISE NOTICE 'User % unbanned', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 软删除用户函数
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET 
        account_status = 'deleted',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    UPDATE subscriptions
    SET status = 'cancelled', updated_at = NOW()
    WHERE user_id = p_user_id;
    
    UPDATE user_quotas
    SET remaining_quota = 0, updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RAISE NOTICE 'User % soft deleted', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 重置用户配额函数
CREATE OR REPLACE FUNCTION reset_user_quota(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_plan TEXT;
BEGIN
    SELECT plan INTO v_plan FROM subscriptions
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;
    
    IF v_plan IS NULL THEN 
        v_plan := 'free'; 
    END IF;
    
    -- 重置配额
    UPDATE user_quotas
    SET 
        remaining_quota = 100,
        period_start = NOW(),
        period_end = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 如果不存在，插入新记录
    INSERT INTO user_quotas (user_id, remaining_quota, period_start, period_end, created_at, updated_at)
    SELECT p_user_id, 100, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM user_quotas WHERE user_id = p_user_id);
    
    RAISE NOTICE 'User % quota reset', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 授权
GRANT EXECUTE ON FUNCTION ban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION unban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_quota TO authenticated;

-- 9. 更新现有用户的account_status默认值
UPDATE user_profiles SET account_status = 'normal' WHERE account_status IS NULL;

SELECT 'User management functions created successfully - using user_profiles table' AS status;