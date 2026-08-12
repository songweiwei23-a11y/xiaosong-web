-- ============================================
-- 紧急修复：统一执行脚本
-- 执行顺序: 按编号依次执行
-- ============================================

-- 修复1: 批量标记老用户
-- 位置: database/migrations/urgent-fixes/001_mark_legacy_users.sql
-- 说明: 保护老用户权益

-- 修复2: Admin邀请码功能扩展
-- 位置: database/migrations/admin-invitation/001_add_admin_features.sql
-- 说明: 添加管理字段和操作日志表

-- 修复3: 配额月度重置（见下方）

-- ============================================
-- 以下为完整的执行顺序
-- ============================================

-- 第1步：标记老用户
\i database/migrations/urgent-fixes/001_mark_legacy_users.sql

-- 第2步：Admin邀请码功能
\i database/migrations/admin-invitation/001_add_admin_features.sql

-- 第3步：配额月度重置（见下一个文件）
