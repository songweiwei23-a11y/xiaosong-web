-- ============================================
-- 用户管理模块修复 - 数据库扩展
-- 执行时间: 2026-08-13
-- 说明: 添加账号状态管理字段
-- ============================================

-- 1. 添加账号状态相关字段到 user_profiles 表
-- ============================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'normal' CHECK (account_status IN ('normal', 'banned', 'deleted')),
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS banned_reason TEXT,
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 添加注释
COMMENT ON COLUMN user_profiles.account_status IS '账号状态：normal=正常, banned=已封禁, deleted=已删除';
COMMENT ON COLUMN user_profiles.banned_at IS '封禁时间';
COMMENT ON COLUMN user_profiles.banned_reason IS '封禁原因';
COMMENT ON COLUMN user_profiles.banned_by IS '封禁操作者（管理员用户ID）';
COMMENT ON COLUMN user_profiles.deleted_at IS '删除时间（软删除）';

-- 2. 创建索引提升查询性能
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status 
  ON user_profiles(account_status);

CREATE INDEX IF NOT EXISTS idx_user_profiles_banned_at 
  ON user_profiles(banned_at) 
  WHERE banned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted_at 
  ON user_profiles(deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- 3. 初始化现有用户的账号状态
-- ============================================

UPDATE user_profiles
SET account_status = 'normal'
WHERE account_status IS NULL;

-- 4. 创建账号状态视图（方便查询）
-- ============================================

CREATE OR REPLACE VIEW v_user_account_status AS
SELECT 
  up.user_id,
  up.email,
  up.profile_name,
  up.account_status,
  up.banned_at,
  up.banned_reason,
  up.banned_by,
  up.deleted_at,
  ba.email as banned_by_email,
  CASE 
    WHEN up.account_status = 'normal' THEN '正常'
    WHEN up.account_status = 'banned' THEN '已封禁'
    WHEN up.account_status = 'deleted' THEN '已删除'
    ELSE '未知'
  END as status_label
FROM user_profiles up
LEFT JOIN user_profiles ba ON up.banned_by = ba.user_id;

COMMENT ON VIEW v_user_account_status IS '用户账号状态视图（包含状态标签和封禁操作者信息）';

-- 5. 创建封禁用户的辅助函数
-- ============================================

CREATE OR REPLACE FUNCTION ban_user_account(
  p_user_id UUID,
  p_admin_id UUID,
  p_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- 检查用户是否存在
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  -- 检查是否已经被封禁
  IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id AND account_status = 'banned') THEN
    RAISE EXCEPTION '用户已经被封禁';
  END IF;

  -- 封禁用户
  UPDATE user_profiles
  SET 
    account_status = 'banned',
    banned_at = NOW(),
    banned_reason = p_reason,
    banned_by = p_admin_id
  WHERE user_id = p_user_id;

  RAISE NOTICE '✓ 用户 % 已被封禁', p_user_id;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '封禁用户失败: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ban_user_account IS '封禁用户账号';

-- 6. 创建解封用户的辅助函数
-- ============================================

CREATE OR REPLACE FUNCTION unban_user_account(
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- 检查用户是否存在
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  -- 检查是否被封禁
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id AND account_status = 'banned') THEN
    RAISE EXCEPTION '用户未被封禁';
  END IF;

  -- 解封用户
  UPDATE user_profiles
  SET 
    account_status = 'normal',
    banned_at = NULL,
    banned_reason = NULL,
    banned_by = NULL
  WHERE user_id = p_user_id;

  RAISE NOTICE '✓ 用户 % 已解封', p_user_id;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '解封用户失败: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION unban_user_account IS '解封用户账号';

-- 7. 创建软删除用户的辅助函数
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_user(
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- 检查用户是否存在
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  -- 软删除用户
  UPDATE user_profiles
  SET 
    account_status = 'deleted',
    deleted_at = NOW()
  WHERE user_id = p_user_id;

  RAISE NOTICE '✓ 用户 % 已标记为删除', p_user_id;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '删除用户失败: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION soft_delete_user IS '软删除用户账号（仅标记，不实际删除数据）';

-- 8. 验证和测试
-- ============================================

DO $$
DECLARE
  total_users INTEGER;
  normal_users INTEGER;
BEGIN
  -- 统计用户数量
  SELECT COUNT(*) INTO total_users FROM user_profiles;
  SELECT COUNT(*) INTO normal_users FROM user_profiles WHERE account_status = 'normal';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✓ 数据库扩展完成';
  RAISE NOTICE '✓ 总用户数: %', total_users;
  RAISE NOTICE '✓ 正常用户数: %', normal_users;
  RAISE NOTICE '✓ 已添加字段: account_status, banned_at, banned_reason, banned_by, deleted_at';
  RAISE NOTICE '✓ 已创建索引: 3个';
  RAISE NOTICE '✓ 已创建视图: v_user_account_status';
  RAISE NOTICE '✓ 已创建函数: ban_user_account, unban_user_account, soft_delete_user';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- ============================================
-- 迁移完成
-- ============================================
