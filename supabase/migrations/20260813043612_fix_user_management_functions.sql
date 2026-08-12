-- =============================================
-- 修复版：先删除旧函数，再创建新函数
-- =============================================

-- 1. 删除可能存在的旧函数（避免类型冲突）
DROP FUNCTION IF EXISTS ban_user_account(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS unban_user_account(UUID);
DROP FUNCTION IF EXISTS soft_delete_user(UUID);
DROP FUNCTION IF EXISTS reset_user_quota(UUID);

-- 2. 创建新函数
CREATE OR REPLACE FUNCTION ban_user_account(
    p_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET 
        account_status = 'banned',
        banned_at = NOW(),
        banned_reason = p_reason,
        banned_by = p_admin_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    UPDATE subscriptions
    SET status = 'inactive', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';
    
    INSERT INTO admin_action_logs (admin_id, action, target_user_id, details, created_at)
    VALUES (p_admin_id, 'BAN_USER', p_user_id, json_build_object('reason', p_reason), NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unban_user_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET account_status = 'normal', banned_at = NULL, banned_reason = NULL, banned_by = NULL, updated_at = NOW()
    WHERE user_id = p_user_id AND account_status = 'banned';
    
    UPDATE subscriptions
    SET status = 'active', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'inactive' AND (end_date IS NULL OR end_date > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET account_status = 'deleted', deleted_at = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
    
    UPDATE subscriptions
    SET status = 'cancelled', updated_at = NOW()
    WHERE user_id = p_user_id;
    
    UPDATE user_quotas
    SET remaining_quota = 0, updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_user_quota(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_plan TEXT;
BEGIN
    SELECT plan INTO v_plan FROM subscriptions
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;
    
    IF v_plan IS NULL THEN v_plan := 'free'; END IF;
    
    UPDATE user_quotas
    SET remaining_quota = 100, period_start = NOW(), period_end = NOW() + INTERVAL '30 days', updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 添加字段（如果不存在）
DO $$
BEGIN
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
END $$;

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_status ON profiles(user_id, account_status);

-- 5. 授权
GRANT EXECUTE ON FUNCTION ban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION unban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_quota TO authenticated;

SELECT 'User management functions fixed successfully' AS status;