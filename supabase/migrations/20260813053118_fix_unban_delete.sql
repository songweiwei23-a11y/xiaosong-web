-- =============================================
-- 修复解封和删除函数
-- =============================================

-- 1. 解封用户 - 不记录日志（避免参数问题）
DROP FUNCTION IF EXISTS unban_user_account(UUID);
CREATE OR REPLACE FUNCTION unban_user_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET account_status = 'normal', banned_at = NULL, banned_reason = NULL, 
        banned_by = NULL, updated_at = NOW()
    WHERE user_id = p_user_id AND account_status = 'banned';
    
    UPDATE subscriptions
    SET status = 'active', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'inactive' 
      AND (end_date IS NULL OR end_date > NOW());
    
    RAISE NOTICE 'User % unbanned', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 删除用户 - 不记录日志
DROP FUNCTION IF EXISTS soft_delete_user(UUID);
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET account_status = 'deleted', deleted_at = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
    
    UPDATE subscriptions
    SET status = 'cancelled', updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RAISE NOTICE 'User % soft deleted', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权
GRANT EXECUTE ON FUNCTION unban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user TO authenticated;

SELECT 'unban and delete functions fixed' AS status;