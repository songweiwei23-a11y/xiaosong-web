# 小宋编导工作台

> AI 驱动的短视频脚本创作 SaaS 平台

## 📌 项目简介

小宋编导工作台是一个基于 AI 技术的短视频脚本创作工具，帮助创作者快速生成高质量的短视频内容。

### 核心功能

- 🎬 **脚本生成** - 专业口播稿、结构化脚本、可替换句式
- 💡 **选题策划** - 12个选题方案、优先级建议、爆款分析
- 🎥 **分镜脚本** - 详细拍摄执行表、镜头语言、剪辑节奏
- ✅ **审稿优化** - AI诊断问题、修改建议、完整修改版
- 🏷️ **标题封面** - 12个标题方案、封面文案、发布建议
- 🎯 **账号定位** - 测试方向、7天计划、判断标准
- 📚 **知识库** - 编导专业知识搜索

## 🛠️ 技术栈

- **前端框架**: Next.js 14.2.5 + TypeScript
- **UI 组件**: Tailwind CSS + Shadcn UI
- **状态管理**: Zustand
- **认证系统**: Supabase Auth
- **数据库**: Supabase (PostgreSQL)
- **AI 接口**: Dify Chatflow API
- **部署平台**: Vercel

## 💎 会员体系

| 套餐 | 价格 | 额度 | 特性 |
|------|------|------|------|
| 免费版 | ¥0 | 5次/月 | 基础功能 |
| 基础会员 | ¥29/月 | 50次/月 | 所有功能 |
| 专业会员 | ¥99/月 | 200次/月 | 高级功能 + 专属服务 |
| 企业版 | ¥599/月 | 无限 | 多账号协作 + 定制开发 |

## 🚀 快速开始

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/你的用户名/xiaosong-web.git
cd xiaosong-web
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
复制 `.env.example` 为 `.env.local`，填入你的配置：
```bash
NEXT_PUBLIC_SUPABASE_URL=你的Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务密钥
DIFY_API_KEY=你的Dify API密钥
DIFY_API_URL=https://api.dify.ai/v1
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问应用**
打开浏览器访问 http://localhost:3000

### 部署到 Vercel

详细部署步骤请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📁 项目结构

```
xiaosong-web/
├── app/                      # Next.js 应用目录
│   ├── admin/               # 管理员后台
│   │   ├── page.tsx        # 后台首页
│   │   ├── users/          # 用户管理
│   │   ├── subscriptions/  # 会员管理
│   │   ├── analytics/      # 数据统计
│   │   └── settings/       # 系统设置
│   ├── dashboard/           # 用户工作台
│   │   ├── page.tsx        # 工作台首页
│   │   ├── script/         # 脚本生成
│   │   ├── topic/          # 选题策划
│   │   ├── storyboard/     # 分镜脚本
│   │   ├── review/         # 审稿优化
│   │   ├── title/          # 标题封面
│   │   ├── positioning/    # 账号定位
│   │   ├── knowledge/      # 知识库
│   │   └── membership/     # 会员升级
│   ├── login/              # 登录页面
│   ├── payment/            # 支付页面
│   └── api/                # API 路由
├── lib/                     # 工具函数
│   └── supabase/           # Supabase 客户端
├── public/                  # 静态资源
└── middleware.ts           # 中间件（路由保护）
```

## 🗄️ 数据库表结构

### user_subscriptions（用户会员信息）
- 会员等级、状态、额度、时间等

### usage_records（使用记录）
- 功能使用历史、内容预览等

### payments（支付记录）
- 支付金额、方式、状态等

## 🔐 管理员功能

访问 `/admin` 进入管理员后台：

- **用户管理** - 查看所有用户、修改会员信息
- **会员管理** - 手动调整用户权限、重置额度
- **数据统计** - 用户增长、收入统计、功能使用排行
- **系统设置** - 价格配置、功能开关、系统参数

## 📄 开源协议

本项目采用 MIT 协议

## 👥 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

- 邮箱: admin@xiaosong.ai
- 微信: xiaosong-service

---

**让 AI 成为你的专业编导助手！** 🎬
