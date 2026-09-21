-- ==========================================
-- 一键修复管理员权限（请在 Supabase SQL 编辑器中执行）
-- ==========================================

-- 步骤1: 临时关闭 RLS，方便操作
ALTER TABLE admin_roles DISABLE ROW LEVEL SECURITY;

-- 步骤2: 清理旧数据
DELETE FROM admin_roles WHERE email = 'song.weiwei23@gmail.com';

-- 步骤3: 插入你的管理员权限
INSERT INTO admin_roles (user_id, email, role, is_active, permissions)
SELECT 
  id,
  'song.weiwei23@gmail.com',
  'developer',
  true,
  '{"manage_users": true, "manage_content": true, "manage_system": true, "view_analytics": true, "manage_admins": true}'::jsonb
FROM auth.users
WHERE email = 'song.weiwei23@gmail.com';

-- 步骤4: 创建允许用户读取自己角色的策略
DROP POLICY IF EXISTS "Allow users to read their own admin role" ON admin_roles;

CREATE POLICY "Allow users to read their own admin role"
ON admin_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 步骤5: 重新启用 RLS（但有了策略就能访问了）
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- 验证结果
SELECT 
  ar.email,
  ar.role,
  ar.is_active,
  'SUCCESS' as status
FROM admin_roles ar
WHERE ar.email = 'song.weiwei23@gmail.com';

