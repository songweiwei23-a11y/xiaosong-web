-- =============================================
-- 修复ban_user_account函数 - 适配admin_action_logs表结构
-- =============================================

DROP FUNCTION IF EXISTS ban_user_account(UUID, UUID, TEXT);

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
    
    -- 记录日志（使用正确的字段名）
    INSERT INTO admin_action_logs (
        admin_id, 
        action_type,      -- NOT NULL 字段
        target_type,      -- NOT NULL 字段
        target_id, 
        details, 
        created_at
    )
    VALUES (
        p_admin_id, 
        'BAN_USER',       -- action_type
        'USER',           -- target_type
        p_user_id,        -- target_id
        json_build_object('reason', p_reason),
        NOW()
    );
    
    RAISE NOTICE 'User % banned by admin %', p_user_id, p_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新授权
GRANT EXECUTE ON FUNCTION ban_user_account TO authenticated;

SELECT 'ban_user_account fixed for real table structure' AS status;