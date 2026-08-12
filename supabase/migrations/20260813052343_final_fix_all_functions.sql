-- =============================================
-- 最终修复：所有用户管理函数（使用正确的action_type）
-- =============================================

-- 1. 封禁用户
DROP FUNCTION IF EXISTS ban_user_account(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION ban_user_account(
    p_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET account_status = 'banned', banned_at = NOW(), banned_reason = p_reason, 
        banned_by = p_admin_id, updated_at = NOW()
    WHERE user_id = p_user_id;
    
    UPDATE subscriptions
    SET status = 'inactive', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';
    
    -- 使用 'update' 作为action_type
    INSERT INTO admin_action_logs (admin_id, action_type, target_type, target_id, details, created_at)
    VALUES (p_admin_id, 'update', 'USER', p_user_id, 
            json_build_object('action', 'ban', 'reason', p_reason), NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 解封用户
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
    
    -- 使用 'update' 作为action_type
    INSERT INTO admin_action_logs (admin_id, action_type, target_type, target_id, details, created_at)
    VALUES (current_setting('app.current_user_id')::uuid, 'update', 'USER', p_user_id,
            json_build_object('action', 'unban'), NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 删除用户
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
    
    -- 使用 'delete' 作为action_type
    INSERT INTO admin_action_logs (admin_id, action_type, target_type, target_id, details, created_at)
    VALUES (current_setting('app.current_user_id')::uuid, 'delete', 'USER', p_user_id,
            json_build_object('action', 'soft_delete'), NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 重置配额（保持不变，不记录日志）
DROP FUNCTION IF EXISTS reset_user_quota(UUID);
CREATE OR REPLACE FUNCTION reset_user_quota(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_quotas
    SET knowledge_used = 0, positioning_used = 0, topic_used = 0, script_used = 0,
        free_chat_used = 0, storyboard_used = 0, review_used = 0, title_used = 0, 
        deal_reason_used = 0,
        current_period_start = NOW(), current_period_end = NOW() + INTERVAL '30 days',
        last_reset_at = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
    
    INSERT INTO user_quotas (user_id, knowledge_used, positioning_used, topic_used, script_used,
        free_chat_used, storyboard_used, review_used, title_used, deal_reason_used,
        current_period_start, current_period_end, last_reset_at, created_at, updated_at)
    SELECT p_user_id, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        NOW(), NOW() + INTERVAL '30 days', NOW(), NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM user_quotas WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权
GRANT EXECUTE ON FUNCTION ban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION unban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_quota TO authenticated;

SELECT 'All functions fixed with correct action_type values' AS status;