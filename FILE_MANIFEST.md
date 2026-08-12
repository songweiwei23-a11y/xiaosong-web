# 邀请码机制 - 文件清单

## 📂 新增文件

### API端点（后端）
- `app/api/invitation/validate/route.ts` - 邀请码验证API
- `app/api/invitation/use/route.ts` - 邀请码使用API  
- `app/api/invitation/generate/route.ts` - 邀请码生成API

### 工具库
- `lib/quota-checker.ts` - 新的额度检查工具

### 测试页面
- `app/test-invitation/page.tsx` - 邀请码测试页面

### 文档
- `IMPLEMENTATION_REPORT.md` - 完整实施报告
- `TEST_CHECKLIST.md` - 测试清单
- `DEPLOYMENT_GUIDE.md` - 部署指南
- `NEXT_STEPS.md` - 下一步行动指南
- `test-invitation.ps1` - PowerShell测试脚本

## 🔧 修改文件

- `app/login/page.tsx` - 添加邀请码输入框和注册逻辑

## 🗄️ 数据库变更（Supabase）

### 新增表
- `invitation_codes` - 邀请码管理
- `invitation_relationships` - 邀请关系追踪
- `quota_plans` - 新额度配置

### 备份表
- `quota_plans_backup_20260812` - 旧额度备份

### 数据库函数
- `get_user_quota_limit(p_user_id, p_feature)` - 获取用户额度限制

### 初始数据
- 100个邀请码（XS-XXXXXX格式）
- 4种会员套餐配置（free/basic/pro/enterprise）

## 📊 核心变更统计

| 类型 | 数量 |
|------|------|
| 新增API | 3个 |
| 新增页面 | 1个 |
| 修改页面 | 1个 |
| 新增工具 | 1个 |
| 新增表 | 3个 |
| 新增函数 | 1个 |
| 新增文档 | 5个 |
| 新增代码行 | ~700行 |

## 🔗 关键路径

### 用户路径
- 访问：`/login` → 注册标签 → 输入邀请码 → 注册成功

### API路径
- `POST /api/invitation/validate` - 验证邀请码
- `POST /api/invitation/use` - 使用邀请码
- `POST /api/invitation/generate` - 生成邀请码
- `GET /api/invitation/generate?userId=xxx` - 查询邀请码

### 测试路径
- `/test-invitation` - 快速测试页面

## 🎯 功能实现

### 1. 新用户注册（必须邀请码）
```
用户输入邮箱+密码+邀请码
  ↓
验证邀请码（/api/invitation/validate）
  ↓
创建账户（Supabase Auth）
  ↓
使用邀请码（/api/invitation/use）
  ↓
设置会员等级+is_legacy_user=false
  ↓
注册成功
```

### 2. 邀请码生成（付费用户）
```
付费用户请求生成邀请码
  ↓
检查用户会员等级
  ↓
检查本月已生成数量
  ↓
生成邀请码（XS-XXXXXX）
  ↓
保存到数据库（status=active）
  ↓
返回邀请码
```

### 3. 额度检查（新旧分离）
```
用户使用功能
  ↓
调用 checkUserQuota(userId, feature)
  ↓
查询 user_profiles.is_legacy_user
  ↓
如果 is_legacy_user=true
  ↓ 返回旧额度（高）
如果 is_legacy_user=false
  ↓ 返回新额度（低）
```

## 📋 额度对比表

| 功能 | 老额度 | 新额度 | 降幅 |
|------|--------|--------|------|
| 脚本生成 | 10次/月 | 3次/月 | -70% |
| 选题策划 | 20次/月 | 5次/月 | -75% |
| 账号定位 | 15次/月 | 3次/月 | -80% |
| 分镜脚本 | 8次/月 | 2次/月 | -75% |
| 审稿优化 | 10次/月 | 3次/月 | -70% |
| 标题封面 | 15次/月 | 3次/月 | -80% |
| 自由对话 | 50次/月 | 15次/月 | -70% |
| 成交理由 | 10次/月 | 3次/月 | -70% |
| 知识库 | 30次/月 | 10次/月 | -67% |

## 🔐 安全特性

- ✅ 邀请码唯一性检查
- ✅ 邀请码过期时间（1个月）
- ✅ 邀请码一次性使用
- ✅ 生成数量限制（按会员等级）
- ✅ RLS安全策略
- ✅ 老用户保护机制
- ✅ API输入验证

## 🧪 测试覆盖

- [ ] 邀请码验证API
- [ ] 新用户注册（带邀请码）
- [ ] 邀请码状态更新
- [ ] 无邀请码注册阻止
- [ ] 无效邀请码阻止
- [ ] 老用户不受影响

## 📖 文档说明

| 文档 | 内容 |
|------|------|
| `IMPLEMENTATION_REPORT.md` | 完整实施报告，包括技术架构、业务影响、风险评估 |
| `TEST_CHECKLIST.md` | 详细测试步骤、成功标准、问题排查 |
| `DEPLOYMENT_GUIDE.md` | 部署操作指南、常见问题、回滚步骤 |
| `NEXT_STEPS.md` | 下一步行动指南（测试→提交→部署） |

## 🎯 项目目标达成

| 目标 | 状态 | 说明 |
|------|------|------|
| 防止白嫖 | ✅ 已实现 | 新用户必须邀请码 |
| 降低额度 | ✅ 已实现 | 降低70-80% |
| 保护老用户 | ✅ 已实现 | is_legacy_user机制 |
| 付费激励 | ✅ 已实现 | 会员可生成邀请码 |
| 本地构建 | ✅ 通过 | npm run build成功 |
| 云端部署 | ⏳ 待测试 | 等待本地测试通过 |

## 🚀 部署准备度

- ✅ 代码开发完成
- ✅ 本地构建成功
- ✅ 开发服务器运行
- ✅ 文档齐全
- ⏳ 功能测试（待执行）
- ⏳ Git提交（待执行）
- ⏳ 云端部署（待执行）

**当前进度**: 80% （开发完成，待测试部署）

## 📞 支持资源

- **Supabase Dashboard**: https://supabase.com/dashboard
- **项目仓库**: GitHub（待提交）
- **云端服务器**: ubuntu@VM-0-8-ubuntu（腾讯云）
- **本地测试**: http://localhost:3000

---

**文件清单生成时间**: 2026年8月13日  
**清单版本**: v1.0
