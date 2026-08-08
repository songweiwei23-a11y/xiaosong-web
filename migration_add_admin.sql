-- 添加is_admin字段到user_settings表
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_settings_is_admin ON user_settings(is_admin);

-- 将你的账号设置为管理员(需要替换为实际的user_id)
-- 运行此SQL前,先在Supabase后台找到你的user_id,然后替换下面的'YOUR_USER_ID'
-- UPDATE user_settings SET is_admin = TRUE WHERE user_id = 'YOUR_USER_ID';

-- 示例:如果你的邮箱是song.weiwei23@gmail.com,可以这样查找user_id:
-- SELECT id FROM auth.users WHERE email = 'song.weiwei23@gmail.com';
-- 然后执行:
-- UPDATE user_settings SET is_admin = TRUE WHERE user_id = '找到的user_id';
