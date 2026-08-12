# 数据库迁移执行指南

## 📋 执行步骤

### 1. 登录Supabase Dashboard
访问：https://supabase.com/dashboard
选择项目：nxxbzdstmtuyplcwrrhs

### 2. 打开SQL Editor
点击左侧菜单：SQL Editor

### 3. 执行迁移脚本
1. 点击"New query"
2. 复制 `database/migrations/admin-invitation/001_add_admin_features.sql` 的全部内容
3. 粘贴到SQL编辑器
4. 点击"Run"执行

### 4. 验证结果
执行成功后，应看到以下提示：
- ✓ invitation_codes 表字段添加成功
- ✓ admin_action_logs 表创建成功
- ✓ 数据库迁移完成！

### 5. 检查表结构（可选）
```sql
-- 检查 invitation_codes 表
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'invitation_codes' 
ORDER BY ordinal_position;

-- 检查 admin_action_logs 表
SELECT * FROM admin_action_logs LIMIT 1;

-- 运行完整性检查
SELECT * FROM check_invitation_code_integrity();
```

## ⚠️ 注意事项
- 此迁移是**非破坏性**的，只添加新字段和新表
- 不会影响现有数据
- 可以安全执行

## 🔄 回滚（如果需要）
```sql
-- 删除新增字段
ALTER TABLE invitation_codes
DROP COLUMN IF EXISTS created_by_admin,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS is_public;

-- 删除日志表
DROP TABLE IF EXISTS admin_action_logs CASCADE;

-- 删除函数
DROP FUNCTION IF EXISTS check_invitation_code_integrity CASCADE;
DROP FUNCTION IF EXISTS auto_expire_invitation_codes CASCADE;
```

执行完成后，请告诉我结果，我会继续进行阶段2！
