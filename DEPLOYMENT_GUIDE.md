# 部署到腾讯云服务器指南

## 📋 部署前检查清单

- [ ] 本地测试全部通过
- [ ] 代码已提交到Git仓库
- [ ] 备份云端服务器当前版本
- [ ] 确认.env.local配置正确

## 🚀 部署步骤

### 步骤1：提交代码到GitHub

```powershell
# 在本地执行
cd "C:\Users\30430\Desktop\编导知识大全\小宋\xiaosong-web"

# 查看修改的文件
git status

# 添加所有更改
git add .

# 提交
git commit -m "feat: 添加邀请码机制，优化免费额度

- 新用户注册必须使用邀请码
- 降低免费额度防止白嫖（脚本3次/月，选题5次/月等）
- 老用户is_legacy_user=true保留原额度
- 付费用户可生成邀请码（basic:3个, pro:10个, enterprise:50个）
- 邀请码自动过期（1个月）
- 新增API: /api/invitation/validate, /api/invitation/generate, /api/invitation/use
- 优化注册页面UI，添加邀请码输入框"

# 推送到GitHub
git push origin main
```

### 步骤2：SSH登录腾讯云服务器

```bash
# 使用你的方式登录，例如：
ssh ubuntu@your-server-ip
```

### 步骤3：备份当前版本（重要！）

```bash
# 进入项目目录
cd ~/xiaosong-web

# 创建备份
cp -r ~/xiaosong-web ~/xiaosong-web-backup-$(date +%Y%m%d-%H%M%S)

# 确认备份成功
ls -la ~/xiaosong-web-backup*
```

### 步骤4：拉取最新代码

```bash
cd ~/xiaosong-web

# 拉取最新代码
git pull origin main

# 确认拉取成功
git log -1
```

### 步骤5：检查环境变量

```bash
# 查看.env.local是否存在
cat ~/xiaosong-web/.env.local

# 确认包含以下配置：
# - DIFY_API_KEY
# - DIFY_CHATBOT_API_KEY
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - ADMIN_SETUP_SECRET
```

### 步骤6：安装依赖（如有新增）

```bash
cd ~/xiaosong-web
npm install
```

### 步骤7：重新构建

```bash
cd ~/xiaosong-web

# 删除旧的构建文件
rm -rf .next

# 重新构建
npm run build

# 确认构建成功
echo $?  # 应该返回0
```

### 步骤8：重启PM2服务

```bash
# 停止服务
pm2 stop xiaosong-web

# 重启服务
pm2 start npm --name "xiaosong-web" -- start

# 或者直接重启
pm2 restart xiaosong-web

# 查看状态
pm2 status

# 查看日志（确认无错误）
pm2 logs xiaosong-web --lines 50
```

### 步骤9：验证部署

```bash
# 检查端口监听
ss -tlnpu | grep :3000

# 测试API
curl http://localhost:3000/api/invitation/validate -X POST \
  -H "Content-Type: application/json" \
  -d '{"code":"XS-TEST123"}'
```

### 步骤10：浏览器验证

1. 打开：http://your-domain.com/login
2. 切换到"注册"标签
3. 确认看到邀请码输入框
4. 测试注册流程

## 🔧 常见部署问题

### 问题1：构建失败 - 模块找不到

**症状**：
```
Error: Cannot find module '@/lib/...'
```

**解决**：
```bash
cd ~/xiaosong-web
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 问题2：PM2服务无法启动

**症状**：
```
pm2 status 显示 errored
```

**解决**：
```bash
# 查看详细错误
pm2 logs xiaosong-web --err --lines 100

# 删除并重新启动
pm2 delete xiaosong-web
cd ~/xiaosong-web
pm2 start npm --name "xiaosong-web" -- start
pm2 save
```

### 问题3：端口3000被占用

**症状**：
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决**：
```bash
# 查找占用进程
lsof -i :3000

# 或者
netstat -tlnp | grep :3000

# 杀死进程
kill -9 <PID>

# 重启PM2
pm2 restart xiaosong-web
```

### 问题4：API返回500错误

**症状**：
注册时提示"服务器错误"

**解决**：
```bash
# 1. 检查日志
pm2 logs xiaosong-web --lines 100

# 2. 检查环境变量
cat .env.local

# 3. 测试数据库连接
# 在Supabase Dashboard执行：
SELECT * FROM invitation_codes LIMIT 1;

# 4. 重启服务
pm2 restart xiaosong-web
```

## 🔄 回滚步骤（如果部署失败）

```bash
# 1. 停止当前服务
pm2 stop xiaosong-web

# 2. 恢复备份
cd ~
rm -rf xiaosong-web
mv xiaosong-web-backup-YYYYMMDD-HHMMSS xiaosong-web

# 3. 重启服务
cd ~/xiaosong-web
pm2 restart xiaosong-web

# 4. 验证
pm2 status
curl http://localhost:3000
```

## ✅ 部署成功标志

- [ ] pm2 status 显示 online
- [ ] 端口3000正常监听
- [ ] 访问网站无报错
- [ ] 登录页面显示邀请码输入框
- [ ] API测试返回正确结果
- [ ] PM2日志无错误

## 📊 部署后监控

```bash
# 实时查看日志
pm2 logs xiaosong-web

# 查看服务状态
pm2 monit

# 查看详细信息
pm2 describe xiaosong-web
```

## 🔐 安全提醒

1. **不要**将.env.local提交到Git
2. **确保**SUPABASE_SERVICE_ROLE_KEY保密
3. **定期**更新依赖包
4. **启用**防火墙规则
5. **监控**异常登录尝试

## 📞 紧急联系

如部署遇到无法解决的问题：
1. 立即回滚到备份版本
2. 保留错误日志
3. 检查Supabase Dashboard日志
4. 联系技术支持
