# 前端UI增强指南

## 1. 修复状态徽章显示

### 当前问题
```typescript
const getStatusBadge = (status: string) => {
  const configs: any = {
    active: { label: '正常', color: 'bg-green-100...' },
    inactive: { label: '已封禁', color: 'bg-red-100...' },
  };
}
```

### 修复后
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

## 2. User类型扩展

在文件顶部的 User 类型定义中添加：

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
  banned_by: string | null;      // 新增
  deleted_at: string | null;     // 新增
  // ... 其他字段
};
```

## 3. 添加新的处理函数

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
    console.error('封禁用户失败:', error);
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
    console.error('解封用户失败:', error);
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

  const confirmed = await confirmDialog(`确定要删除该用户吗？此操作不可恢复！\n原因：${reason}`, {
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
    console.error('删除用户失败:', error);
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

## 4. 更新表格中的操作列

在表格的操作列（最后一列）中，替换为：

```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm">
  <div className="flex items-center gap-2">
    {/* 编辑按钮（保留原有） */}
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

    {/* 封禁/解封按钮 */}
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

    {/* 重置配额按钮（保留原有） */}
    {user.account_status !== 'deleted' && (
      <button
        onClick={() => handleResetQuota(user.user_id)}
        className="text-orange-600 hover:text-orange-800 dark:text-orange-400"
        title="重置配额"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    )}

    {/* 强制登出按钮 */}
    {user.account_status === 'normal' && (
      <button
        onClick={() => handleForceLogout(user.user_id)}
        className="text-purple-600 hover:text-purple-800 dark:text-purple-400"
        title="强制登出"
      >
        <Power className="w-4 h-4" />
      </button>
    )}

    {/* 删除按钮（仅超级管理员） */}
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

## 5. 导入新的图标

在文件顶部的 import 中添加：

```typescript
import { 
  Search, Edit2, ChevronLeft, ChevronRight, Loader2, RefreshCw, 
  AlertCircle, Crown, Ban, Unlock, RotateCcw, Eye,
  Power,    // 新增：强制登出图标
  Trash2    // 新增：删除图标
} from "lucide-react";
```

## 6. 更新状态显示列

在表格中找到状态列，替换为：

```tsx
<td className="px-6 py-4 whitespace-nowrap">
  {getAccountStatusBadge(user.account_status)}
  {user.banned_at && (
    <div className="text-xs text-gray-500 mt-1">
      封禁时间：{new Date(user.banned_at).toLocaleDateString()}
    </div>
  )}
  {user.banned_reason && (
    <div className="text-xs text-gray-500 mt-1" title={user.banned_reason}>
      原因：{user.banned_reason.substring(0, 20)}...
    </div>
  )}
</td>
```

## 7. 添加统计卡片（可选）

在页面顶部添加统计信息：

```tsx
{/* 统计卡片 */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    <div className="text-sm text-gray-500 dark:text-gray-400">总用户数</div>
    <div className="text-2xl font-bold">{total}</div>
  </div>
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    <div className="text-sm text-gray-500 dark:text-gray-400">正常用户</div>
    <div className="text-2xl font-bold text-green-600">
      {users.filter(u => u.account_status === 'normal').length}
    </div>
  </div>
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    <div className="text-sm text-gray-500 dark:text-gray-400">已封禁</div>
    <div className="text-2xl font-bold text-red-600">
      {users.filter(u => u.account_status === 'banned').length}
    </div>
  </div>
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    <div className="text-sm text-gray-500 dark:text-gray-400">已删除</div>
    <div className="text-2xl font-bold text-gray-600">
      {users.filter(u => u.account_status === 'deleted').length}
    </div>
  </div>
</div>
```

## 完成

完成以上修改后：
1. 状态显示将正确反映账号状态
2. 添加了封禁/解封/删除/强制登出功能
3. UI更加完善，操作更加直观

记得在修改后运行 `npm run build` 验证没有编译错误！
