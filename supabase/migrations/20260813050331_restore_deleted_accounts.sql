-- =============================================
-- 恢复被误标记为已删除的账号
-- =============================================

-- 查看当前被标记为deleted的账号
SELECT user_id, account_status, deleted_at
FROM user_profiles
WHERE account_status = 'deleted';

-- 恢复所有被标记为deleted的账号
UPDATE user_profiles
SET 
    account_status = 'normal',
    deleted_at = NULL,
    updated_at = NOW()
WHERE account_status = 'deleted';

-- 恢复这些用户的订阅（如果有）
UPDATE subscriptions
SET 
    status = 'active',
    updated_at = NOW()
WHERE user_id IN (
    SELECT user_id 
    FROM user_profiles 
    WHERE account_status = 'normal'
    AND deleted_at IS NULL
)
AND status = 'cancelled';

-- 验证恢复结果
SELECT 
    user_id,
    account_status,
    deleted_at,
    updated_at
FROM user_profiles
WHERE account_status = 'normal'
AND updated_at > NOW() - INTERVAL '1 minute';

SELECT '账号恢复完成' AS status;