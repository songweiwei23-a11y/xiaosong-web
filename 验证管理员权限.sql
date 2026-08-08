-- ==========================================
-- 管理员权限验证与修复脚本
-- ==========================================

-- 1. 查看当前 admin_roles 表的数据
SELECT 
  id,
  user_id,
  email,
  role,
  is_active,
  created_at
FROM admin_roles
ORDER BY created_at DESC;

-- 2. 查找 song.weiwei23@gmail.com 对应的 user_id
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'song.weiwei23@gmail.com';

-- 3. 如果上面找到了 user_id，运行下面的命令确保管理员权限存在
-- 替换 YOUR_USER_ID 为上面查询到的 user_id

-- 删除可能存在的旧记录（避免重复）
DELETE FROM admin_roles 
WHERE email = 'song.weiwei23@gmail.com';

-- 插入新的管理员记录（请将 YOUR_USER_ID 替换为实际的用户 UUID）
INSERT INTO admin_roles (user_id, email, role, is_active, permissions)
SELECT 
  id,
  'song.weiwei23@gmail.com',
  'developer',
  true,
  '{"manage_users": true, "manage_content": true, "manage_system": true, "view_analytics": true, "manage_admins": true}'::jsonb
FROM auth.users
WHERE email = 'song.weiwei23@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET 
  role = 'developer',
  is_active = true,
  updated_at = now();

-- 4. 验证插入成功
SELECT 
  ar.id,
  ar.email,
  ar.role,
  ar.is_active,
  au.id as auth_user_id
FROM admin_roles ar
JOIN auth.users au ON ar.user_id = au.id
WHERE ar.email = 'song.weiwei23@gmail.com';

-- 5. 临时禁用 admin_roles 表的 RLS（用于测试）
ALTER TABLE admin_roles DISABLE ROW LEVEL SECURITY;

-- 6. 为 admin_roles 创建宽松的策略（允许登录用户读取自己的角色）
DROP POLICY IF EXISTS "Users can read their own admin role" ON admin_roles;

CREATE POLICY "Users can read their own admin role"
ON admin_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 7. 重新启用 RLS
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

