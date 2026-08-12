# API增强说明

## 需要在 app/api/admin/users/route.ts 的 POST 方法中添加以下 case

在现有的 switch (action) 语句中，找到 default case 之前，添加以下新的 case：

### 1. 封禁用户（增强版）
替换现有的 ban_user case 为：

```typescript
case 'ban_user':
  // 封禁用户 - 使用新的account_status字段
  const { reason } = body;
  
  if (!reason || reason.trim() === '') {
    return NextResponse.json({ error: '请提供封禁原因' }, { status: 400 });
  }

  // 防止封禁自己
  if (userId === admin.userId) {
    return NextResponse.json({ error: '不能封禁自己' }, { status: 400 });
  }

  // 使用数据库函数封禁用户
  const { data: banResult, error: banError } = await supabase
    .rpc('ban_user_account', {
      p_user_id: userId,
      p_admin_id: admin.userId,
      p_reason: reason
    });

  if (banError) {
    console.error('[用户管理] 封禁用户失败:', banError);
    return NextResponse.json({ error: banError.message || '封禁失败' }, { status: 500 });
  }

  // 记录管理员操作日志
  await logAdminAction(admin.userId, 'ban_user' as any, {
    targetUserId: userId,
    reason: reason
  });

  console.log(`[用户管理] 用户封禁成功: ${userId}`);
  return NextResponse.json({ success: true, message: '用户已封禁' });
```

### 2. 解封用户（增强版）
替换现有的 unban_user case 为：

```typescript
case 'unban_user':
  // 解封用户
  
  // 使用数据库函数解封用户
  const { data: unbanResult, error: unbanError } = await supabase
    .rpc('unban_user_account', {
      p_user_id: userId
    });

  if (unbanError) {
    console.error('[用户管理] 解封用户失败:', unbanError);
    return NextResponse.json({ error: unbanError.message || '解封失败' }, { status: 500 });
  }

  // 记录管理员操作日志
  await logAdminAction(admin.userId, 'unban_user' as any, {
    targetUserId: userId
  });

  console.log(`[用户管理] 用户解封成功: ${userId}`);
  return NextResponse.json({ success: true, message: '用户已解封' });
```

### 3. 删除用户（新增）

```typescript
case 'delete_user':
  // 软删除用户
  const { deleteReason } = body;
  
  if (!deleteReason || deleteReason.trim() === '') {
    return NextResponse.json({ error: '请提供删除原因' }, { status: 400 });
  }

  // 防止删除自己
  if (userId === admin.userId) {
    return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
  }

  // 使用数据库函数软删除用户
  const { data: deleteResult, error: deleteError } = await supabase
    .rpc('soft_delete_user', {
      p_user_id: userId
    });

  if (deleteError) {
    console.error('[用户管理] 删除用户失败:', deleteError);
    return NextResponse.json({ error: deleteError.message || '删除失败' }, { status: 500 });
  }

  // 记录管理员操作日志
  await logAdminAction(admin.userId, 'delete_user' as any, {
    targetUserId: userId,
    reason: deleteReason
  });

  console.log(`[用户管理] 用户删除成功: ${userId}`);
  return NextResponse.json({ success: true, message: '用户已删除' });
```

### 4. 强制登出（新增）

```typescript
case 'force_logout':
  // 强制用户登出 - 使所有会话失效
  try {
    // 使用 Supabase Admin API 登出用户
    const { error: logoutError } = await supabase.auth.admin.signOut(userId);
    
    if (logoutError) {
      console.error('[用户管理] 强制登出失败:', logoutError);
      return NextResponse.json({ error: logoutError.message || '强制登出失败' }, { status: 500 });
    }

    // 记录管理员操作日志
    await logAdminAction(admin.userId, 'force_logout' as any, {
      targetUserId: userId
    });

    console.log(`[用户管理] 用户强制登出成功: ${userId}`);
    return NextResponse.json({ success: true, message: '用户已强制登出' });
  } catch (err: any) {
    console.error('[用户管理] 强制登出异常:', err);
    return NextResponse.json({ error: err.message || '强制登出失败' }, { status: 500 });
  }
```

## GET 方法增强

在 GET 方法中，添加 account_status 字段到返回数据：

找到用户数据映射部分，添加：

```typescript
return {
  user_id: authUser.id,
  email: authUser.email || '未设置',
  full_name: profile?.profile_name || '未设置',
  avatar_url: profile?.avatar_url || null,
  membership_level: subscription?.plan || 'free',
  subscription_status: subscription?.status || 'inactive',
  subscription_end: subscription?.end_date || null,
  account_status: profile?.account_status || 'normal',  // 新增
  banned_at: profile?.banned_at || null,                // 新增
  banned_reason: profile?.banned_reason || null,        // 新增
  // ... 其他字段
};
```

## 完成

保存文件后，API增强完成！
