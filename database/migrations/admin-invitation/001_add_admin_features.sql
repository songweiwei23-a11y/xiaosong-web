-- ============================================
-- 邀请码Admin功能数据库优化
-- 执行时间: 2026-08-13
-- 说明: 为邀请码系统添加管理员功能支持
-- ============================================

-- 1. 扩展 invitation_codes 表，添加管理字段
-- ============================================

ALTER TABLE invitation_codes
ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN invitation_codes.created_by_admin IS '是否由管理员生成';
COMMENT ON COLUMN invitation_codes.notes IS '管理员备注（如：2026年8月活动专用）';
COMMENT ON COLUMN invitation_codes.is_public IS '是否为公开邀请码（用于营销活动）';

-- 2. 创建管理员操作日志表
-- ============================================

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('generate', 'revoke', 'delete', 'update')),
  target_type TEXT NOT NULL DEFAULT 'invitation_code',
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE admin_action_logs IS '管理员操作日志表';
COMMENT ON COLUMN admin_action_logs.admin_id IS '执行操作的管理员ID';
COMMENT ON COLUMN admin_action_logs.action_type IS '操作类型：generate=生成, revoke=作废, delete=删除, update=更新';
COMMENT ON COLUMN admin_action_logs.target_type IS '目标类型（固定为invitation_code）';
COMMENT ON COLUMN admin_action_logs.target_id IS '目标邀请码ID';
COMMENT ON COLUMN admin_action_logs.details IS '操作详情（JSON格式）';

-- 3. 创建索引，提升查询性能
-- ============================================

-- invitation_codes 表索引
CREATE INDEX IF NOT EXISTS idx_invitation_codes_created_by_admin 
  ON invitation_codes(created_by_admin) 
  WHERE created_by_admin = TRUE;

CREATE INDEX IF NOT EXISTS idx_invitation_codes_is_public 
  ON invitation_codes(is_public) 
  WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_invitation_codes_status_plan 
  ON invitation_codes(status, plan_type);

-- admin_action_logs 表索引
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_id 
  ON admin_action_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at 
  ON admin_action_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action_type 
  ON admin_action_logs(action_type);

-- 4. 更新RLS策略（Row Level Security）
-- ============================================

-- 允许认证用户读取日志（仅自己的）
DROP POLICY IF EXISTS "Users can view their own admin logs" ON admin_action_logs;
CREATE POLICY "Users can view their own admin logs" 
  ON admin_action_logs FOR SELECT 
  USING (auth.uid() = admin_id);

-- 允许插入日志（系统级）
DROP POLICY IF EXISTS "Service role can insert admin logs" ON admin_action_logs;
CREATE POLICY "Service role can insert admin logs" 
  ON admin_action_logs FOR INSERT 
  WITH CHECK (true);

-- 5. 数据完整性检查函数
-- ============================================

CREATE OR REPLACE FUNCTION check_invitation_code_integrity()
RETURNS TABLE(
  issue_type TEXT,
  issue_count BIGINT,
  description TEXT
) AS $$
BEGIN
  -- 检查过期但状态仍为active的邀请码
  RETURN QUERY
  SELECT 
    'expired_but_active'::TEXT,
    COUNT(*)::BIGINT,
    '过期但状态仍为active的邀请码'::TEXT
  FROM invitation_codes
  WHERE status = 'active' 
    AND expires_at < NOW();

  -- 检查已使用但没有used_by的邀请码
  RETURN QUERY
  SELECT 
    'used_without_user'::TEXT,
    COUNT(*)::BIGINT,
    '已使用但没有使用者的邀请码'::TEXT
  FROM invitation_codes
  WHERE status = 'used' 
    AND used_by IS NULL;

  -- 检查重复的邀请码
  RETURN QUERY
  SELECT 
    'duplicate_codes'::TEXT,
    COUNT(*)::BIGINT,
    '重复的邀请码'::TEXT
  FROM (
    SELECT code, COUNT(*) as cnt
    FROM invitation_codes
    GROUP BY code
    HAVING COUNT(*) > 1
  ) duplicates;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_invitation_code_integrity IS '检查邀请码数据完整性';

-- 6. 自动清理过期邀请码函数
-- ============================================

CREATE OR REPLACE FUNCTION auto_expire_invitation_codes()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE invitation_codes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_expire_invitation_codes IS '自动将过期的邀请码标记为expired';

-- 7. 验证和测试
-- ============================================

-- 验证表结构
DO $$
BEGIN
  -- 检查新字段是否添加成功
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitation_codes' 
    AND column_name IN ('created_by_admin', 'notes', 'is_public')
  ) THEN
    RAISE NOTICE '✓ invitation_codes 表字段添加成功';
  ELSE
    RAISE EXCEPTION '✗ invitation_codes 表字段添加失败';
  END IF;

  -- 检查日志表是否创建成功
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'admin_action_logs'
  ) THEN
    RAISE NOTICE '✓ admin_action_logs 表创建成功';
  ELSE
    RAISE EXCEPTION '✗ admin_action_logs 表创建失败';
  END IF;

  RAISE NOTICE '✓ 数据库迁移完成！';
END $$;

-- 8. 初始数据更新（可选）
-- ============================================

-- 将系统初始生成的100个邀请码标记为管理员生成
UPDATE invitation_codes
SET created_by_admin = TRUE,
    notes = '系统初始化生成',
    is_public = TRUE
WHERE created_at < NOW() - INTERVAL '1 day'
  AND created_by_admin IS NULL;

-- ============================================
-- 迁移完成
-- ============================================
