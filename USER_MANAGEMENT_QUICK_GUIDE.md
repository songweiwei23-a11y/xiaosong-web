# 用户管理前端整合 - 快速修改指南

## 📝 修改1: API增强（15分钟）

### 文件: app/api/admin/users/route.ts

找到 POST 方法中的 switch (action) 语句，在现有的 case 之后、default 之前添加以下代码：

```typescript
      case 'ban_user':
        // 封禁用户
        const banReason = body.reason;
        
        if (!banReason || banReason.trim() === '') {
          return NextResponse.json({ error: '请提供封禁原因' }, { status: 400 });
        }

        if (userId === admin.userId) {
          return NextResponse.json({ error: '不能封禁自己' }, { status: 400 });
        }

        const { error: banError } = await supabase
          .rpc('ban_user_account', {
            p_user_id: userId,
            p_admin_id: admin.userId,
            p_reason: banReason
          });

        if (banError) {
          console.error('[用户管理] 封禁失败:', banError);
          return NextResponse.json({ error: banError.message || '封禁失败' }, { status: 500 });
        }

        await logAdminAction(admin.userId, 'ban_user' as any, {
          targetUserId: userId,
          reason: banReason
        });

        return NextResponse.json({ success: true, message: '用户已封禁' });

      case 'unban_user':
        // 解封用户
        const { error: unbanError } = await supabase
          .rpc('unban_user_account', {
            p_user_id: userId
          });

        if (unbanError) {
          console.error('[用户管理] 解封失败:', unbanError);
          return NextResponse.json({ error: unbanError.message || '解封失败' }, { status: 500 });
        }

        await logAdminAction(admin.userId, 'unban_user' as any, {
          targetUserId: userId
        });

        return NextResponse.json({ success: true, message: '用户已解封' });

      case 'delete_user':
        // 软删除用户
        const deleteReason = body.deleteReason;
        
        if (!deleteReason || deleteReason.trim() === '') {
          return NextResponse.json({ error: '请提供删除原因' }, { status: 400 });
        }

        if (userId === admin.userId) {
          return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
        }

        const { error: deleteError } = await supabase
          .rpc('soft_delete_user', {
            p_user_id: userId
          });

        if (deleteError) {
          console.error('[用户管理] 删除失败:', deleteError);
          return NextResponse.json({ error: deleteError.message || '删除失败' }, { status: 500 });
        }

        await logAdminAction(admin.userId, 'delete_user' as any, {
          targetUserId: userId,
          reason: deleteReason
        });

        return NextResponse.json({ success: true, message: '用户已删除' });

      case 'force_logout':
        // 强制登出
        try {
          const { error: logoutError } = await supabase.auth.admin.signOut(userId);
          
          if (logoutError) {
            console.error('[用户管理] 强制登出失败:', logoutError);
            return NextResponse.json({ error: logoutError.message || '强制登出失败' }, { status: 500 });
          }

          await logAdminAction(admin.userId, 'force_logout' as any, {
            targetUserId: userId
          });

          return NextResponse.json({ success: true, message: '用户已强制登出' });
        } catch (err: any) {
          console.error('[用户管理] 强制登出异常:', err);
          return NextResponse.json({ error: err.message || '强制登出失败' }, { status: 500 });
        }
```

### 位置说明
在文件中搜索 `switch (action)` 或 `case 'reset_quota':`，在最后一个 case 之后、`default:` 之前添加上述代码。

---

## 📝 修改2: 前端UI增强（20分钟）

### 文件: app/admin/users/page.tsx

#### 步骤1: 更新 User 类型定义（在文件顶部附近）

找到 `type User = {` 的定义，添加以下字段：

```typescript
type User = {
  user_id: string;
  email: string;
  full_name: string;
  membership_level: string;
  subscription_status: string;
  subscription_end: string | null;
  account_status: string;        // 新增
  banned_at: string | null;      // 新增
  banned_reason: string | null;  // 新增
  quota_details: { ... };
  // ... 其他字段
};
```

#### 步骤2: 添加图标导入（在文件顶部）

找到 `import { ... } from "lucide-react";`，添加新图标：

```typescript
import { 
  Search, Edit2, ChevronLeft, ChevronRight, Loader2, RefreshCw, 
  AlertCircle, Crown, Ban, Unlock, RotateCcw, Eye,
  Power, Trash2  // 新增这两个
} from "lucide-react";
```

#### 步骤3: 添加处理函数（在组件内部，与其他 handle 函数放在一起）

```typescript
  // 封禁用户
  const handleBanUser = async (userId: string) => {
    const reason = prompt('请输入封禁原因：');
    if (!reason || reason.trim() === '') {
      notify('封禁原因不能为空');
      return;
    }

    const confirmed = await confirmDialog(`确定要封禁该用户吗？\n原因：${reason}`, {
      tone: 'danger',
      confirmText: '确定封禁',
      title: '封禁用户'
    });

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'ban_user',
          reason
        }),
      });

      if (response.ok) {
        notify('用户已封禁');
        fetchUsers();
      } else {
        const errorData = await response.json();
        notify(errorData.error || '封禁失败');
      }
    } catch (error) {
      console.error('封禁失败:', error);
      notify('封禁失败');
    }
  };

  // 解封用户
  const handleUnbanUser = async (userId: string) => {
    const confirmed = await confirmDialog('确定要解封该用户吗？', {
      tone: 'warning',
      confirmText: '确定解封',
      title: '解封用户'
    });

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'unban_user'
        }),
      });

      if (response.ok) {
        notify('用户已解封');
        fetchUsers();
      } else {
        const errorData = await response.json();
        notify(errorData.error || '解封失败');
      }
    } catch (error) {
      console.error('解封失败:', error);
      notify('解封失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    const reason = prompt('请输入删除原因：');
    if (!reason || reason.trim() === '') {
      notify('删除原因不能为空');
      return;
    }

    const confirmed = await confirmDialog(`确定要删除该用户吗？\n原因：${reason}`, {
      tone: 'danger',
      confirmText: '确定删除',
      title: '删除用户'
    });

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'delete_user',
          deleteReason: reason
        }),
      });

      if (response.ok) {
        notify('用户已删除');
        fetchUsers();
      } else {
        const errorData = await response.json();
        notify(errorData.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      notify('删除失败');
    }
  };

  // 强制登出
  const handleForceLogout = async (userId: string) => {
    const confirmed = await confirmDialog('确定要强制该用户登出吗？', {
      tone: 'warning',
      confirmText: '确定登出',
      title: '强制登出'
    });

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'force_logout'
        }),
      });

      if (response.ok) {
        notify('用户已强制登出');
      } else {
        const errorData = await response.json();
        notify(errorData.error || '强制登出失败');
      }
    } catch (error) {
      console.error('强制登出失败:', error);
      notify('强制登出失败');
    }
  };
```

#### 步骤4: 更新状态徽章函数

找到 `getStatusBadge` 函数，替换为：

```typescript
  const getAccountStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string }> = {
      normal: { 
        label: '正常', 
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
      },
      banned: { 
        label: '已封禁', 
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
      },
      deleted: { 
        label: '已删除', 
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' 
      },
    };
    const config = configs[status] || configs.normal;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };
```

#### 步骤5: 更新表格的操作列

在表格中找到操作列（通常在最后），替换为：

```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm">
  <div className="flex items-center gap-2">
    {/* 编辑 */}
    <button
      onClick={() => {
        setSelectedUser(user);
        setShowEditModal(true);
      }}
      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
      title="编辑"
    >
      <Edit2 className="w-4 h-4" />
    </button>

    {/* 封禁/解封 */}
    {user.account_status === 'normal' ? (
      <button
        onClick={() => handleBanUser(user.user_id)}
        className="text-red-600 hover:text-red-800 dark:text-red-400"
        title="封禁"
      >
        <Ban className="w-4 h-4" />
      </button>
    ) : user.account_status === 'banned' ? (
      <button
        onClick={() => handleUnbanUser(user.user_id)}
        className="text-green-600 hover:text-green-800 dark:text-green-400"
        title="解封"
      >
        <Unlock className="w-4 h-4" />
      </button>
    ) : null}

    {/* 重置配额 */}
    {user.account_status !== 'deleted' && (
      <button
        onClick={() => handleResetQuota(user.user_id)}
        className="text-orange-600 hover:text-orange-800 dark:text-orange-400"
        title="重置配额"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    )}

    {/* 强制登出 */}
    {user.account_status === 'normal' && (
      <button
        onClick={() => handleForceLogout(user.user_id)}
        className="text-purple-600 hover:text-purple-800 dark:text-purple-400"
        title="强制登出"
      >
        <Power className="w-4 h-4" />
      </button>
    )}

    {/* 删除 */}
    {user.account_status !== 'deleted' && (
      <button
        onClick={() => handleDeleteUser(user.user_id)}
        className="text-gray-600 hover:text-gray-800 dark:text-gray-400"
        title="删除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    )}
  </div>
</td>
```

#### 步骤6: 更新状态显示列

在表格中找到显示状态的地方，将 `getStatusBadge` 改为 `getAccountStatusBadge`：

```tsx
<td className="px-6 py-4 whitespace-nowrap">
  {getAccountStatusBadge(user.account_status)}
</td>
```

---

## ✅ 完成检查清单

- [ ] 修改 app/api/admin/users/route.ts（添加4个case）
- [ ] 修改 app/admin/users/page.tsx 的 User 类型
- [ ] 添加 Power 和 Trash2 图标导入
- [ ] 添加4个handle函数
- [ ] 更新 getAccountStatusBadge 函数
- [ ] 更新表格操作列
- [ ] 更新状态显示列
- [ ] 运行 npm run build 验证无错误
- [ ] 运行 npm run dev 测试功能

---

## 🔍 验证方法

```bash
# 1. 构建验证
npm run build

# 2. 启动开发服务器
npm run dev

# 3. 访问用户管理
浏览器打开: http://localhost:3000/admin/users

# 4. 测试功能
- 尝试封禁一个用户
- 查看状态是否变为"已封禁"
- 尝试解封
- 测试其他按钮
```

---

这就是完整的修改步骤！按照这个指南一步步操作即可！
