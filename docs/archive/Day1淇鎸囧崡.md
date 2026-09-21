# 🔧 Day 1 修复指南

## 已完成 ✅

### 1. 修复生成历史页面崩溃 BUG
- **文件**: `xiaosong-web/app/history/page.tsx`
- **问题**: React key 使用了不稳定的模板字符串 `key={`history-${item.id}`}`
- **修复**: 改为稳定的 `key={item.id}`
- **状态**: ✅ 已修复，所有中文乱码也已修正

### 2. 文案乱码修复
- **影响**: 生成历史页面的所有中文文案
- **状态**: ✅ 已修复，文件重新保存为 UTF-8 编码

## 待执行 ⚠️

### 3. 数据库表补全（需要手动操作）

**问题**: `user_quotas` 和 `subscriptions` 表在 Supabase 数据库中不存在

**解决步骤**:

#### 步骤 1: 访问 Supabase SQL Editor
打开浏览器，访问:
```
https://supabase.com/dashboard/project/nxxbzdstmtuyplcwrrhs/editor
```

#### 步骤 2: 执行 SQL 脚本
1. 点击左侧 "SQL Editor"
2. 点击 "+ New query"
3. 打开本地文件 `xiaosong-web/数据库修复脚本.sql`
4. 复制全部内容
5. 粘贴到 Supabase SQL Editor
6. 点击 "Run" 执行

#### 步骤 3: 验证结果
执行完成后，应该看到:
```
========================================
数据完整性检查结果
========================================
用户总数:        3
Profile记录:     3
Quota记录:       3
Subscription记录: 3

✅ 数据完整！所有用户都有完整记录
========================================
```

以及用户详细信息表格，每个用户的 Profile、Quota、Subscription 都应该显示 ✓

#### 步骤 4: 重启 Next.js 服务器
在本地终端执行:
```powershell
# 如果服务器正在运行，先停止（Ctrl+C）
# 然后重新启动
cd xiaosong-web
npm run dev
```

#### 步骤 5: 验证功能
1. 访问管理后台: `http://localhost:3000/admin/users`
2. 检查用户列表，确保每个用户都有:
   - ✓ Profile
   - ✓ Quota
   - ✓ Subscription
3. 访问生成历史页面: `http://localhost:3000/history`
4. 确认页面正常加载，没有崩溃

---

## SQL 脚本内容说明

该脚本会执行以下操作:

1. **创建 user_quotas 表**
   - 存储每个用户的功能使用次数
   - 包含9种功能的计数器
   - 自动月度重置机制

2. **创建 subscriptions 表**
   - 存储用户的订阅信息
   - 支持4种套餐: free, basic, pro, enterprise
   - 包含状态管理: active, inactive, expired

3. **补全现有用户数据**
   - 为3个现有用户自动创建 user_quotas 记录（初始值为0）
   - 为3个现有用户自动创建免费版订阅记录

4. **创建自动触发器**
   - 新用户注册时自动创建 user_quotas
   - 新用户注册时自动创建免费订阅

5. **启用 RLS (行级安全)**
   - 用户只能查看自己的配额和订阅
   - Service Role 可以管理所有数据

---

## 如果遇到问题

### 问题1: SQL 执行失败
- 检查是否有权限访问 Supabase 项目
- 确认使用的是正确的项目 ID

### 问题2: 表已存在错误
- SQL 脚本使用了 `IF NOT EXISTS`，不会重复创建
- 如果还是报错，可能是部分表已存在，继续执行即可

### 问题3: 数据仍然显示为0
- 刷新 Supabase 缓存: 在 SQL Editor 执行 `NOTIFY pgrst, 'reload schema';`
- 重启 Next.js 开发服务器
- 清除浏览器缓存

---

## Day 1 总结

✅ **已完成**:
- 修复生成历史页面 React key BUG
- 修复所有中文乱码
- 创建完整的数据库修复 SQL 脚本

⏳ **待执行**:
- 在 Supabase 控制台执行 SQL 脚本（需要您手动操作）
- 验证数据完整性

📅 **下一步 (Day 2)**:
- 登录页面适配夜间主题
- 登录页面添加"返回首页"按钮
- 选题策划添加"个人要求"输入框
- 脚本生成增加"自定义时长"和"AI推荐"模式

---

## 联系方式
如果在执行 SQL 脚本时遇到任何问题，请截图错误信息。
