# 邀请码功能测试清单

## ✅ 已完成工作

### 1. 数据库迁移（Supabase - 远程已完成）
- ✅ 创建 invitation_codes 表
- ✅ 创建 invitation_relationships 表
- ✅ 创建 quota_plans 表（新额度配置）
- ✅ 备份旧额度到 quota_plans_backup_20260812
- ✅ 生成100个初始邀请码（XS-XXXXXX格式）
- ✅ 设置RLS安全策略
- ✅ 创建数据库函数 get_user_quota_limit

### 2. 后端API开发（本地已完成）
- ✅ /api/invitation/validate - 验证邀请码
- ✅ /api/invitation/generate - 生成和查询邀请码
- ✅ /api/invitation/use - 使用邀请码
- ✅ lib/quota-checker.ts - 新的额度检查工具

### 3. 前端页面更新（本地已完成）
- ✅ app/login/page.tsx - 添加邀请码输入框
- ✅ 注册时强制要求邀请码
- ✅ 注册成功后根据邀请码plan_type设置会员等级

### 4. 构建验证
- ✅ 本地构建成功（npm run build）
- ✅ 开发服务器运行中（http://localhost:3000）

## 🧪 本地测试步骤

### 测试前准备
1. 确认开发服务器正在运行
   ```powershell
   # 如果未运行，执行：
   cd "C:\Users\30430\Desktop\编导知识大全\小宋\xiaosong-web"
   npm run dev
   ```

2. 获取有效邀请码
   - 登录 Supabase Dashboard: https://supabase.com/dashboard
   - 进入项目: nxxbzdstmtuyplcwrrhs
   - 打开 SQL Editor
   - 执行查询：
     ```sql
     SELECT code, plan_type, status, expires_at 
     FROM invitation_codes 
     WHERE status = 'active' 
     LIMIT 10;
     ```
   - 复制任意一个code（如：XS-ABC123）

### 测试1：邀请码验证API
1. 打开浏览器访问：http://localhost:3000/test-invitation
2. 输入有效邀请码
3. 点击"验证邀请码"
4. **预期结果**：
   ```json
   {
     "status": 200,
     "data": {
       "valid": true,
       "planType": "free",
       "expiresAt": "..."
     }
   }
   ```

### 测试2：注册流程（新用户+邀请码）
1. 打开：http://localhost:3000/login
2. 点击"注册"标签
3. 填写信息：
   - 邮箱：test-new-user@example.com
   - 密码：123456
   - 邀请码：[从数据库获取的有效码]
4. 点击"注册账户"
5. **预期结果**：
   - 提示"注册成功！您已获得体验版权限。请切换到登录标签页进行登录。"
   - 邀请码在数据库中状态变为'used'
   - user_profiles表中创建记录，is_legacy_user=false

### 测试3：注册流程（无邀请码）
1. 打开：http://localhost:3000/login
2. 点击"注册"标签
3. 填写邮箱和密码，**不填邀请码**
4. 点击"注册账户"
5. **预期结果**：
   - 提示"请输入邀请码"（红色错误提示）
   - 注册被阻止

### 测试4：注册流程（无效邀请码）
1. 打开：http://localhost:3000/login
2. 点击"注册"标签
3. 输入邀请码：INVALID-CODE
4. 点击"注册账户"
5. **预期结果**：
   - 提示"邀请码无效"或"邀请码不存在"

### 测试5：老用户登录（验证不受影响）
1. 使用已存在的老账户登录
2. **预期结果**：
   - 正常登录，不需要邀请码
   - 仍然享有旧的高额度

### 测试6：额度检查（可选）
1. 登录后访问 Dashboard
2. 尝试使用各个功能（脚本生成、选题策划等）
3. **预期结果**：
   - 新用户看到新的低额度（如脚本生成3次/月）
   - 老用户仍然看到旧额度（如脚本生成10次/月）

## ✅ 测试通过标准

- [ ] API验证返回正确结果
- [ ] 新用户必须使用邀请码才能注册
- [ ] 无效邀请码被正确拒绝
- [ ] 已使用的邀请码不能重复使用
- [ ] 老用户登录不受影响
- [ ] 新用户注册后is_legacy_user=false
- [ ] 构建无错误

## 📝 测试记录

### 测试时间：____________________

### 测试1结果：
- 状态：[ ] 通过 / [ ] 失败
- 备注：_________________________________

### 测试2结果：
- 状态：[ ] 通过 / [ ] 失败
- 备注：_________________________________

### 测试3结果：
- 状态：[ ] 通过 / [ ] 失败
- 备注：_________________________________

### 测试4结果：
- 状态：[ ] 通过 / [ ] 失败
- 备注：_________________________________

### 测试5结果：
- 状态：[ ] 通过 / [ ] 失败
- 备注：_________________________________

### 测试6结果：
- 状态：[ ] 通过 / [ ] 失败
- 备注：_________________________________

## 🚀 测试通过后的下一步

1. **提交到Git**
   ```powershell
   cd "C:\Users\30430\Desktop\编导知识大全\小宋\xiaosong-web"
   git add .
   git commit -m "feat: 添加邀请码机制，防止白嫖

   - 新用户注册必须使用邀请码
   - 降低免费额度（脚本3次/月，选题5次/月等）
   - 老用户保留原额度（is_legacy_user=true）
   - 付费用户可生成邀请码（basic:3个, pro:10个, enterprise:50个）
   - 邀请码有效期1个月"
   
   git push origin main
   ```

2. **部署到腾讯云服务器**
   - SSH登录服务器
   - 拉取最新代码
   - 重新构建和重启服务

## ⚠️ 注意事项

1. **老用户保护**：所有在此次更新前注册的用户，is_legacy_user=TRUE，保留旧额度
2. **环境变量**：确认.env.local包含所有必要的配置
3. **数据库函数**：get_user_quota_limit已在Supabase中创建
4. **安全性**：邀请码生成需要付费用户权限
5. **过期处理**：邀请码默认1个月后过期

## 🐛 常见问题排查

### 问题1：注册时提示"邀请码无效"但邀请码确实存在
- 检查邀请码是否已被使用（status='used'）
- 检查邀请码是否已过期（expires_at < now）
- 检查邀请码格式（必须大写，如XS-ABC123）

### 问题2：老用户看到新的低额度
- 检查user_profiles表中is_legacy_user字段
- 应该为true，如果为false需要手动更新

### 问题3：API返回500错误
- 检查.env.local中的Supabase配置
- 查看控制台日志
- 检查数据库连接

## 📞 支持

如有问题，检查：
1. 浏览器控制台（F12）
2. VS Code终端（开发服务器日志）
3. Supabase Dashboard Logs
