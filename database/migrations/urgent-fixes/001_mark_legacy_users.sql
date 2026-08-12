-- ============================================
-- 紧急修复1：批量标记老用户
-- 执行时间: 2026-08-13
-- 说明: 将所有现有用户标记为老用户，保护其权益
-- ============================================

-- 1. 检查 user_profiles 表是否有 is_legacy_user 字段
-- 如果没有，先添加字段
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_legacy_user BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN user_profiles.is_legacy_user IS '是否为老用户（邀请码系统上线前的用户）';

-- 2. 批量标记所有现有用户为老用户
-- 注意：这会将截止当前时间的所有用户标记为老用户
UPDATE user_profiles
SET is_legacy_user = TRUE
WHERE is_legacy_user IS NULL OR is_legacy_user = FALSE;

-- 3. 显示标记结果
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM user_profiles
  WHERE is_legacy_user = TRUE;
  
  RAISE NOTICE '✓ 已标记 % 个老用户', updated_count;
END $$;

-- 4. 验证标记结果
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_legacy_user = TRUE) as legacy_users,
  COUNT(*) FILTER (WHERE is_legacy_user = FALSE) as new_users
FROM user_profiles;

-- ============================================
-- 修复完成
-- ============================================
