# 邀请码Admin后台整合方案

## 📋 整合概述

将邀请码管理功能完整集成到Admin后台，让管理员可以：
- ✅ 批量生成邀请码（不受会员限制）
- ✅ 查看所有邀请码列表（分页、筛选、搜索）
- ✅ 作废/删除邀请码
- ✅ 查看统计数据（使用率、转化率）
- ✅ 导出邀请码列表
- ✅ 查看操作日志

---

## 🎯 实施计划（4个阶段）

### 阶段1：数据库优化（10分钟）
扩展表结构，添加管理功能字段

### 阶段2：Admin API开发（30分钟）
创建4个管理员专用API端点

### 阶段3：Admin页面开发（40分钟）
创建邀请码管理页面

### 阶段4：测试和文档（20分钟）
功能测试和使用文档

**总预计时间**：100分钟

---

## 📊 阶段1：数据库优化

### 1.1 修改 invitation_codes 表

添加以下字段：
```sql
ALTER TABLE invitation_codes
ADD COLUMN created_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN notes TEXT,
ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
```

字段说明：
- `created_by_admin`: 是否由管理员生成
- `notes`: 管理员备注（如：公开活动邀请码）
- `is_public`: 是否为公开邀请码（用于活动）

### 1.2 创建 admin_action_logs 表

```sql
CREATE TABLE admin_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'generate', 'revoke', 'delete'
  target_type TEXT NOT NULL, -- 'invitation_code'
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_action_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);
```

---

## 🔧 阶段2：Admin API开发

### 2.1 API端点列表

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/admin/invitation/generate` | POST | 批量生成邀请码 | Admin |
| `/api/admin/invitation/list` | GET | 查询邀请码列表 | Admin |
| `/api/admin/invitation/revoke` | POST | 作废邀请码 | Admin |
| `/api/admin/invitation/stats` | GET | 统计数据 | Admin |

### 2.2 API详细设计

#### 2.2.1 批量生成邀请码

**端点**: `POST /api/admin/invitation/generate`

**请求体**:
```json
{
  "count": 10,
  "planType": "free",
  "expiresInDays": 30,
  "notes": "2026年8月活动专用",
  "isPublic": true
}
```

**响应**:
```json
{
  "success": true,
  "codes": [
    {
      "id": "uuid",
      "code": "XS-ABC123",
      "planType": "free",
      "expiresAt": "2026-09-13T..."
    }
  ],
  "message": "成功生成10个邀请码"
}
```

**功能**:
- 不受会员限制
- 支持批量生成（1-500个）
- 自动去重检查
- 记录操作日志

#### 2.2.2 查询邀请码列表

**端点**: `GET /api/admin/invitation/list`

**查询参数**:
```
?page=1
&pageSize=20
&status=active
&planType=free
&search=XS-ABC
&createdBy=admin
```

**响应**:
```json
{
  "success": true,
  "data": {
    "codes": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

#### 2.2.3 作废邀请码

**端点**: `POST /api/admin/invitation/revoke`

**请求体**:
```json
{
  "codes": ["XS-ABC123", "XS-DEF456"],
  "reason": "活动结束"
}
```

**响应**:
```json
{
  "success": true,
  "revokedCount": 2,
  "message": "成功作废2个邀请码"
}
```

#### 2.2.4 统计数据

**端点**: `GET /api/admin/invitation/stats`

**响应**:
```json
{
  "success": true,
  "stats": {
    "total": 100,
    "active": 60,
    "used": 30,
    "expired": 10,
    "byPlanType": {
      "free": 80,
      "basic": 15,
      "pro": 5
    },
    "usageRate": 30,
    "recentUsage": [
      { "date": "2026-08-13", "count": 5 }
    ]
  }
}
```

---

## 🎨 阶段3：Admin页面开发

### 3.1 页面结构

创建：`app/admin/invitations/page.tsx`

**页面布局**:
```
┌─────────────────────────────────────────┐
│  邀请码管理                              │
├─────────────────────────────────────────┤
│  [统计卡片区域]                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│  │总数│ │已用│ │剩余│ │使用率│         │
│  └────┘ └────┘ └────┘ └────┘          │
├─────────────────────────────────────────┤
│  [操作栏]                                │
│  [批量生成] [导出] [搜索框] [筛选]      │
├─────────────────────────────────────────┤
│  [邀请码列表表格]                        │
│  Code      状态  类型  创建者  使用时间  │
│  XS-ABC123 已用  Free  Admin  2026-08-13│
│  XS-DEF456 可用  Basic User   -         │
│  ...                                     │
├─────────────────────────────────────────┤
│  [分页控件]                              │
└─────────────────────────────────────────┘
```

### 3.2 核心功能组件

#### 3.2.1 统计卡片
- 总数、已使用、剩余、使用率
- 实时刷新

#### 3.2.2 批量生成对话框
- 输入数量（1-500）
- 选择plan_type
- 设置过期天数
- 添加备注
- 公开/私有选择

#### 3.2.3 邀请码表格
- 列：邀请码、状态、会员类型、创建者、使用者、创建时间、使用时间、过期时间、备注、操作
- 排序：按创建时间降序
- 筛选：状态、会员类型、创建者
- 搜索：按邀请码搜索
- 操作：复制、作废、删除

#### 3.2.4 批量操作
- 批量选择
- 批量作废
- 批量导出

---

## 🔐 权限验证

所有Admin API使用统一的权限验证：

```typescript
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(request: Request) {
  // 验证管理员权限
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: '需要管理员权限' },
      { status: 403 }
    );
  }
  
  // 业务逻辑...
}
```

---

## 📝 操作日志

所有管理员操作都记录日志：

```typescript
async function logAdminAction(
  adminId: string,
  actionType: string,
  details: any
) {
  await supabase.from('admin_action_logs').insert({
    admin_id: adminId,
    action_type: actionType,
    target_type: 'invitation_code',
    details: details,
  });
}
```

日志示例：
```json
{
  "admin_id": "uuid",
  "action_type": "generate",
  "target_type": "invitation_code",
  "details": {
    "count": 10,
    "planType": "free",
    "codes": ["XS-ABC123", ...]
  }
}
```

---

## 🧪 阶段4：测试清单

### 功能测试
- [ ] 批量生成邀请码（1个、10个、100个）
- [ ] 列表查询（分页、筛选、搜索）
- [ ] 作废邀请码（单个、批量）
- [ ] 统计数据正确性
- [ ] 导出功能

### 权限测试
- [ ] 非管理员无法访问
- [ ] 管理员可以访问所有功能
- [ ] 操作日志正确记录

### UI测试
- [ ] 响应式设计
- [ ] 深色模式支持
- [ ] 加载状态
- [ ] 错误提示

---

## 📂 文件结构

```
app/
├── admin/
│   └── invitations/
│       └── page.tsx          # 邀请码管理主页面
├── api/
    └── admin/
        └── invitation/
            ├── generate/
            │   └── route.ts  # 批量生成API
            ├── list/
            │   └── route.ts  # 列表查询API
            ├── revoke/
            │   └── route.ts  # 作废API
            └── stats/
                └── route.ts  # 统计API
```

---

## 🎯 导航菜单更新

在 `app/admin/layout.tsx` 中添加：

```typescript
import { Ticket } from "lucide-react";

const adminNavigation = [
  { name: "管理概览", href: "/admin", icon: Home },
  { name: "订单审核", href: "/admin/orders", icon: ShoppingCart },
  { name: "收款二维码", href: "/admin/qrcodes", icon: QrCode },
  { name: "用户管理", href: "/admin/users", icon: Users },
  { name: "会员管理", href: "/admin/subscriptions", icon: BarChart },
  { name: "邀请码管理", href: "/admin/invitations", icon: Ticket }, // 新增
  { name: "系统设置", href: "/admin/settings", icon: Settings },
];
```

---

## 🚀 实施步骤

### 步骤1：执行数据库迁移（5分钟）
在Supabase Dashboard执行SQL脚本

### 步骤2：创建Admin API（30分钟）
按顺序创建4个API端点

### 步骤3：创建Admin页面（40分钟）
开发邀请码管理界面

### 步骤4：更新导航菜单（5分钟）
添加入口链接

### 步骤5：测试（20分钟）
执行完整测试清单

---

## 📊 预期效果

### 管理员体验
- ⏱️ 生成100个邀请码：从手动10分钟 → 自动10秒
- 📊 查看使用情况：从无 → 实时统计
- 🔍 查找邀请码：从数据库查询 → 搜索框即时
- 📝 操作追踪：从无 → 完整日志

### 系统价值
- 提升管理效率 10倍
- 降低误操作风险
- 增强数据可见性
- 完善审计追踪

---

## ✅ 验收标准

1. ✅ 管理员可以批量生成邀请码
2. ✅ 可以查看所有邀请码列表并筛选
3. ✅ 可以作废不需要的邀请码
4. ✅ 统计数据实时更新
5. ✅ 所有操作有日志记录
6. ✅ 非管理员无法访问
7. ✅ UI美观，响应式设计
8. ✅ 深色模式支持

---

## 🎉 整合完成后

邀请码管理将成为Admin后台的标准功能，与其他管理功能（用户管理、订单审核等）无缝集成。

**管理员可以：**
- 为营销活动快速生成公开邀请码
- 监控邀请码使用情况
- 及时作废泄露的邀请码
- 分析邀请转化数据

**准备开始实施？请确认！**
