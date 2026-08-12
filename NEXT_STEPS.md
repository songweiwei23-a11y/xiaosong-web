# 🎯 下一步行动指南

## ✅ 当前状态

**开发完成度**: 100%  
**本地构建**: ✅ 成功  
**开发服务器**: ✅ 运行中 (http://localhost:3000)  
**待测试**: 6项功能测试  
**待部署**: 腾讯云服务器

---

## 🚀 立即行动（按顺序执行）

### 第1步：获取测试邀请码（5分钟）

1. 打开浏览器，访问：https://supabase.com/dashboard
2. 登录你的Supabase账号
3. 选择项目：`nxxbzdstmtuyplcwrrhs`
4. 点击左侧 **SQL Editor**
5. 执行以下SQL：
   ```sql
   SELECT code, plan_type, status, expires_at 
   FROM invitation_codes 
   WHERE status = 'active' 
   LIMIT 5;
   ```
6. 复制任意一个 `code` 值（如：XS-ABC123）

---

### 第2步：本地功能测试（15分钟）

#### 测试A：邀请码验证API
1. 打开浏览器：http://localhost:3000/test-invitation
2. 粘贴邀请码，点击"验证邀请码"
3. ✅ 确认返回：`{ "valid": true, ... }`

#### 测试B：新用户注册（带邀请码）
1. 打开：http://localhost:3000/login
2. 点击"注册"标签
3. 填写：
   - 邮箱：`test-user-001@example.com`
   - 密码：`test123456`
   - 邀请码：[刚才复制的邀请码]
4. 点击"注册账户"
5. ✅ 确认提示："注册成功！您已获得体验版权限。"

#### 测试C：验证邀请码已使用
1. 回到 Supabase SQL Editor
2. 执行：
   ```sql
   SELECT * FROM invitation_codes WHERE code = 'XS-ABC123';
   ```
3. ✅ 确认 `status = 'used'`，`used_by` 有值

#### 测试D：无邀请码注册（应该失败）
1. 回到注册页面
2. 只填写邮箱和密码，**不填邀请码**
3. 点击"注册账户"
4. ✅ 确认提示："请输入邀请码"（红色错误）

#### 测试E：无效邀请码（应该失败）
1. 输入邀请码：`INVALID-CODE`
2. 点击"注册账户"
3. ✅ 确认提示："邀请码不存在"或"邀请码无效"

#### 测试F：老用户登录（不受影响）
1. 使用已有账户登录（如果有）
2. ✅ 确认正常登录，功能正常

---

### 第3步：记录测试结果（5分钟）

打开文件：`TEST_CHECKLIST.md`，填写测试结果：
- [ ] 测试A：验证API
- [ ] 测试B：新用户注册
- [ ] 测试C：邀请码状态
- [ ] 测试D：无邀请码阻止
- [ ] 测试E：无效邀请码阻止
- [ ] 测试F：老用户不受影响

---

### 第4步：提交代码到GitHub（5分钟）

```powershell
cd "C:\Users\30430\Desktop\编导知识大全\小宋\xiaosong-web"

# 查看更改
git status

# 添加所有文件
git add .

# 提交
git commit -m "feat: 添加邀请码机制，优化免费额度

- 新用户注册必须使用邀请码
- 降低免费额度防止白嫖（脚本3次/月，选题5次/月等）
- 老用户is_legacy_user=true保留原额度
- 付费用户可生成邀请码（basic:3个, pro:10个, enterprise:50个）
- 邀请码自动过期（1个月）
- 新增API: /api/invitation/validate, /api/invitation/generate, /api/invitation/use
- 优化注册页面UI，添加邀请码输入框
- 创建测试页面和完整文档"

# 推送到GitHub
git push origin main
```

---

### 第5步：部署到腾讯云（20分钟）

参考文档：`DEPLOYMENT_GUIDE.md`

**快速命令**：

```bash
# SSH登录服务器
ssh ubuntu@your-server-ip

# 备份
cp -r ~/xiaosong-web ~/xiaosong-web-backup-$(date +%Y%m%d-%H%M%S)

# 拉取代码
cd ~/xiaosong-web
git pull origin main

# 重新构建
rm -rf .next
npm install
npm run build

# 重启PM2
pm2 restart xiaosong-web

# 查看状态
pm2 status
pm2 logs xiaosong-web --lines 50
```

---

### 第6步：生产环境验证（10分钟）

1. 打开：http://your-domain.com/login
2. 确认看到邀请码输入框
3. 测试注册流程
4. 检查PM2日志无错误

---

## 📊 成功标准

全部测试通过 → Git提交成功 → 云端部署成功 → 生产验证通过

**预计总耗时**: 60分钟

---

## 📞 遇到问题？

### 如果测试失败
1. 查看浏览器控制台（F12）
2. 查看开发服务器日志
3. 检查 Supabase Dashboard Logs
4. 参考：`TEST_CHECKLIST.md` 的"常见问题排查"

### 如果部署失败
1. 参考：`DEPLOYMENT_GUIDE.md` 的"常见部署问题"
2. 检查PM2日志：`pm2 logs xiaosong-web --err`
3. 回滚到备份：按部署指南的"回滚步骤"执行

### 紧急情况
1. 停止服务器：`pm2 stop xiaosong-web`
2. 恢复备份
3. 重启服务
4. 联系技术支持

---

## 📁 相关文档

| 文档 | 用途 |
|------|------|
| `IMPLEMENTATION_REPORT.md` | 📊 完整实施报告 |
| `TEST_CHECKLIST.md` | ✅ 测试清单 |
| `DEPLOYMENT_GUIDE.md` | 🚀 部署指南 |
| `test-invitation.ps1` | 🧪 测试脚本 |

---

## 🎉 完成后

恭喜！邀请码机制已成功上线。

**下一步优化建议**：
1. 创建邀请码管理后台（Admin面板）
2. 添加邀请奖励机制
3. 数据分析Dashboard
4. A/B测试不同额度配置

**监控指标**：
- 新用户注册转化率
- 邀请码使用率
- 付费转化率提升
- 多账号注册减少率

---

**开始测试时间**: _______________  
**完成部署时间**: _______________  
**状态**: [ ] 测试中 / [ ] 已部署 / [ ] 已上线

祝部署顺利！🚀
