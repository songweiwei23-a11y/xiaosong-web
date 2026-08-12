-- =============================================
-- 修复版：适配真实的user_quotas表结构
-- =============================================

-- 1. 删除并重建soft_delete_user函数
DROP FUNCTION IF EXISTS soft_delete_user(UUID);

CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 标记为已删除
    UPDATE user_profiles
    SET 
        account_status = 'deleted',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 停用所有订阅
    UPDATE subscriptions
    SET status = 'cancelled', updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 注意：user_quotas表使用xxx_used字段，不需要清零（保留使用记录）
    -- 删除账号后，中间件会阻止访问
    
    RAISE NOTICE 'User % soft deleted', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 删除并重建reset_user_quota函数
DROP FUNCTION IF EXISTS reset_user_quota(UUID);

CREATE OR REPLACE FUNCTION reset_user_quota(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 将所有使用量重置为0
    UPDATE user_quotas
    SET 
        knowledge_used = 0,
        positioning_used = 0,
        topic_used = 0,
        script_used = 0,
        free_chat_used = 0,
        storyboard_used = 0,
        review_used = 0,
        title_used = 0,
        deal_reason_used = 0,
        current_period_start = NOW(),
        current_period_end = NOW() + INTERVAL '30 days',
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 如果不存在记录，插入新的
    INSERT INTO user_quotas (
        user_id,
        knowledge_used, positioning_used, topic_used, script_used,
        free_chat_used, storyboard_used, review_used, title_used, deal_reason_used,
        current_period_start, current_period_end, last_reset_at,
        created_at, updated_at
    )
    SELECT 
        p_user_id,
        0, 0, 0, 0, 0, 0, 0, 0, 0,
        NOW(), NOW() + INTERVAL '30 days', NOW(),
        NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM user_quotas WHERE user_id = p_user_id);
    
    RAISE NOTICE 'User % quota reset', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 重新授权
GRANT EXECUTE ON FUNCTION soft_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_quota TO authenticated;

SELECT 'Functions fixed for real schema' AS status;