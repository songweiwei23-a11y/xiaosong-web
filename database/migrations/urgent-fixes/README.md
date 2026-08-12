# 紧急修复执行指南

## 📋 执行概览

**修复内容**: 3个紧急问题  
**预计时间**: 10-15分钟  
**执行环境**: Supabase Dashboard SQL Editor  

---

## 🚀 执行步骤

### 步骤1: 登录Supabase Dashboard
1. 访问：https://supabase.com/dashboard
2. 选择项目：nxxbzdstmtuyplcwrrhs
3. 点击左侧菜单：SQL Editor

---

### 步骤2: 执行修复脚本（按顺序）

#### 修复1: 批量标记老用户 ✅
**文件**: `database/migrations/urgent-fixes/001_mark_legacy_users.sql`

**作用**: 
- 添加 `is_legacy_user` 字段
- 将所有现有用户标记为老用户
- 保护老用户的高额度权益

**执行**:
1. 点击 "New query"
2. 复制整个 `001_mark_legacy_users.sql` 内容
3. 粘贴到编辑器
4. 点击 "Run"

**预期结果**:
```
✓ 已标记 X 个老用户
显示统计表格
```

---

#### 修复2: Admin邀请码功能扩展 ✅
**文件**: `database/migrations/admin-invitation/001_add_admin_features.sql`

**作用**:
- 添加管理字段（created_by_admin, notes, is_public）
- 创建操作日志表（admin_action_logs）
- 创建索引和RLS策略

**执行**:
1. 新建查询
2. 复制整个 `001_add_admin_features.sql` 内容
3. 粘贴并运行

**预期结果**:
```
✓ invitation_codes 表字段添加成功
✓ admin_action_logs 表创建成功
✓ 数据库迁移完成！
```

---

#### 修复3: 配额月度重置逻辑 ✅
**文件**: `database/migrations/urgent-fixes/002_quota_monthly_reset.sql`

**作用**:
- 添加 `last_reset_at` 字段
- 创建自动重置检查函数
- 创建安全的额度获取和增加函数

**执行**:
1. 新建查询
2. 复制整个 `002_quota_monthly_reset.sql` 内容
3. 粘贴并运行

**预期结果**:
```
✓ 配额月度重置逻辑已实现
✓ 关键函数: check_and_reset_monthly_quota, get_user_quota_used, increment_quota_used_v2
✓ 管理函数: admin_reset_all_quotas
✓ 重置逻辑测试通过
```

---

## ✅ 验证修复

### 验证1: 老用户标记
```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_legacy_user = TRUE) as legacy_users,
  COUNT(*) FILTER (WHERE is_legacy_user = FALSE) as new_users
FROM user_profiles;
```

**预期**: 
- legacy_users > 0（有老用户）
- new_users = 0（目前没有新用户）

---

### 验证2: Admin表和字段
```sql
-- 检查 invitation_codes 新字段
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'invitation_codes' 
AND column_name IN ('created_by_admin', 'notes', 'is_public');

-- 检查 admin_action_logs 表
SELECT COUNT(*) FROM admin_action_logs;
```

**预期**: 
- 3个字段都存在
- admin_action_logs 表可查询（初始为0条）

---

### 验证3: 月度重置函数
```sql
-- 测试获取用户额度（会自动检查重置）
SELECT get_user_quota_used(
  (SELECT user_id FROM user_profiles LIMIT 1),
  'script'
);

-- 检查 last_reset_at 字段
SELECT COUNT(*) 
FROM user_quotas 
WHERE last_reset_at IS NOT NULL;
```

**预期**: 
- 返回数字（0或已使用次数）
- 所有记录都有 last_reset_at

---

## 🔧 如果遇到错误

### 错误1: 字段已存在
```
ERROR: column "xxx" of relation "xxx" already exists
```
**解决**: 正常，说明字段已经存在，可以继续

### 错误2: 函数已存在
```
ERROR: function "xxx" already exists
```
**解决**: 脚本使用了 `CREATE OR REPLACE`，不应该报此错
如果报错，可以先删除：
```sql
DROP FUNCTION IF EXISTS function_name CASCADE;
```
然后重新执行

### 错误3: 权限不足
```
ERROR: permission denied
```
**解决**: 确认使用的是 Service Role Key，不是 Anon Key

---

## 📊 修复完成检查清单

执行完成后，请确认：

- [ ] 修复1执行成功，看到老用户数量
- [ ] 修复2执行成功，看到成功消息
- [ ] 修复3执行成功，看到函数创建消息
- [ ] 验证SQL全部通过
- [ ] 无严重错误（警告可忽略）

---

## 🎯 修复后的效果

### 1. 老用户保护 ✅
- 所有现有用户 `is_legacy_user = TRUE`
- 继续享有旧的高额度
- 不受邀请码新额度影响

### 2. Admin管理完善 ✅
- 可以批量生成邀请码
- 可以查看统计和列表
- 可以作废邀请码
- 有完整的操作日志

### 3. 额度自动重置 ✅
- 每月1号自动重置所有用户额度
- 使用时自动检查，无需定时任务
- 管理员可手动重置（紧急情况）

---

## 🚀 修复完成后

### 立即可做：
1. ✅ 本地测试（npm run dev）
2. ✅ 测试邀请码注册流程
3. ✅ 测试Admin管理页面
4. ✅ 测试额度显示和使用

### 准备部署：
1. 提交代码到Git
2. 部署到腾讯云
3. 生产环境验证

---

## ⚠️ 重要提醒

1. **必须按顺序执行**：001 → 002 → 003
2. **仔细检查结果**：每个脚本执行后看提示消息
3. **保留备份**：Supabase自动备份，但建议手动导出重要表
4. **测试后部署**：确认本地测试通过再部署云端

---

**准备就绪！可以开始执行了！** 🚀
