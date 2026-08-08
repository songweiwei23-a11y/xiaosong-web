# 小宋编导工作台 - Vercel 部署指南

## 🚀 快速部署步骤

### 前提条件
- GitHub 账号
- Vercel 账号（可用 GitHub 登录）
- 已完成本地开发和测试

---

## 第一步：准备 GitHub 仓库

### 1. 安装 Git（如果还没安装）
访问 https://git-scm.com/downloads 下载安装

### 2. 初始化 Git 仓库
在项目目录打开终端，执行：
```bash
cd xiaosong-web
git init
git add .
git commit -m "初始提交：小宋编导工作台"
```

### 3. 创建 GitHub 仓库
1. 访问 https://github.com/new
2. 仓库名称：`xiaosong-web`
3. 选择 **Private**（私有仓库，保护代码）
4. 点击 **Create repository**

### 4. 推送代码到 GitHub
```bash
git remote add origin https://github.com/你的用户名/xiaosong-web.git
git branch -M main
git push -u origin main
```

---

## 第二步：部署到 Vercel

### 1. 访问 Vercel
打开 https://vercel.com

### 2. 登录/注册
- 点击 **Sign Up** 或 **Login**
- 选择 **Continue with GitHub**
- 授权 Vercel 访问你的 GitHub

### 3. 导入项目
1. 点击 **Add New Project**
2. 选择 **Import Git Repository**
3. 找到 `xiaosong-web` 仓库，点击 **Import**

### 4. 配置环境变量
在 Vercel 项目设置中，添加以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=https://nxxbzdstmtuyplcwrrhs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务密钥
DIFY_API_KEY=app-IIt4vrWNrq4gzchKQ4ixUj9U
DIFY_API_URL=https://api.dify.ai/v1
NEXT_PUBLIC_APP_NAME=小宋编导工作台
NEXT_PUBLIC_APP_URL=你的Vercel域名（部署后会显示）
```

**重要提示：** 
- 从你的 `.env.local` 文件复制这些值
- Supabase 密钥在 Supabase 控制台的 **Settings** → **API** 中找到

### 5. 部署设置
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 6. 点击 Deploy
等待 2-3 分钟，部署完成！

---

## 第三步：配置 Supabase

部署完成后，你会得到一个 Vercel 域名，例如：
```
https://xiaosong-web-abc123.vercel.app
```

### 1. 更新 Supabase URL 配置
1. 打开 Supabase 控制台
2. 进入 **Authentication** → **URL Configuration**
3. 添加以下 URL：
   - **Site URL**: `https://你的域名.vercel.app`
   - **Redirect URLs**: 
     - `https://你的域名.vercel.app/auth/callback`
     - `https://你的域名.vercel.app/dashboard`

### 2. 更新环境变量
回到 Vercel 项目设置：
1. 点击 **Settings** → **Environment Variables**
2. 编辑 `NEXT_PUBLIC_APP_URL` 为你的 Vercel 域名
3. 点击 **Redeploy** 重新部署

---

## 第四步：绑定自定义域名（可选）

如果你有自己的域名（如 xiaosong.ai）：

### 1. 在 Vercel 添加域名
1. 进入项目 **Settings** → **Domains**
2. 输入你的域名，点击 **Add**
3. Vercel 会提示需要添加的 DNS 记录

### 2. 配置 DNS
在你的域名服务商（阿里云、腾讯云等）添加 DNS 记录：
- **类型**: CNAME
- **名称**: @ 或 www
- **值**: cname.vercel-dns.com

### 3. 等待生效
DNS 解析通常需要 5-30 分钟生效

---

## ✅ 部署完成检查清单

- [ ] 网站可以正常访问
- [ ] 用户可以注册/登录
- [ ] 所有功能正常工作
- [ ] 管理员后台可以访问
- [ ] 支付页面显示正常
- [ ] 环境变量已正确配置

---

## 🔧 常见问题

### Q1: 部署失败怎么办？
**A:** 检查以下几点：
1. 确保所有依赖都在 `package.json` 中
2. 检查环境变量是否正确配置
3. 查看 Vercel 的构建日志找到错误原因

### Q2: 国内访问很慢怎么办？
**A:** Vercel 在国内访问可能较慢，解决方案：
1. 使用 CDN 加速（Cloudflare）
2. 考虑迁移到国内服务器（阿里云/腾讯云）
3. 使用国内的 Serverless 平台

### Q3: 如何更新代码？
**A:** 
```bash
git add .
git commit -m "更新说明"
git push
```
推送到 GitHub 后，Vercel 会自动重新部署

### Q4: 如何查看访问日志？
**A:** 在 Vercel 项目中点击 **Analytics** 和 **Logs**

---

## 📞 技术支持

如遇到问题：
1. 查看 Vercel 官方文档: https://vercel.com/docs
2. 查看 Next.js 文档: https://nextjs.org/docs
3. 查看 Supabase 文档: https://supabase.com/docs

---

## 🎉 恭喜！

你的小宋编导工作台已经成功部署上线！

现在可以：
- 分享链接给用户使用
- 监控网站访问数据
- 持续优化和添加新功能

**祝你的平台运营顺利！** 🚀
