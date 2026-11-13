# 开物项目一键部署到服务器
# 使用方法：.\deploy-to-server.ps1

$ErrorActionPreference = "Stop"

# ================================
# 配置信息（请根据实际情况修改）
# ================================
$SSH_KEY = "$env:USERPROFILE\Desktop\song.pem"
$SERVER_USER = "ubuntu"  # 或 root，根据您的服务器
$SERVER_HOST = "YOUR_SERVER_IP"  # 请填写您的服务器IP
$PROJECT_PATH = "/var/www/xiaosong-web"  # 服务器上的项目路径
$PM2_APP_NAME = "xiaosong-web"  # PM2 进程名称

# ================================
# 部署流程
# ================================

Write-Host "🚀 开始部署开物项目到服务器..." -ForegroundColor Green

# 检查密钥文件
if (-not (Test-Path $SSH_KEY)) {
    Write-Host "❌ 错误：找不到SSH密钥文件: $SSH_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "✅ SSH密钥文件已找到" -ForegroundColor Green

# 检查是否已配置服务器信息
if ($SERVER_HOST -eq "YOUR_SERVER_IP") {
    Write-Host "❌ 错误：请先在脚本中配置服务器IP地址" -ForegroundColor Red
    Write-Host "   编辑 deploy-to-server.ps1，修改 SERVER_HOST 变量" -ForegroundColor Yellow
    exit 1
}

# SSH 连接命令
$SSH_CMD = "ssh -i `"$SSH_KEY`" $SERVER_USER@$SERVER_HOST"

Write-Host "`n📡 连接到服务器: $SERVER_USER@$SERVER_HOST" -ForegroundColor Cyan

# 执行部署命令
Write-Host "`n执行以下步骤：" -ForegroundColor Cyan
Write-Host "1. 进入项目目录"
Write-Host "2. 拉取最新代码"
Write-Host "3. 安装依赖"
Write-Host "4. 构建项目"
Write-Host "5. 重启服务"

$DEPLOY_SCRIPT = @"
set -e
echo '📂 进入项目目录...'
cd $PROJECT_PATH

echo '🔄 拉取最新代码...'
git pull origin main

echo '📦 检查并安装依赖...'
npm install

echo '🔨 构建项目...'
npm run build

echo '🔄 重启服务...'
if command -v pm2 &> /dev/null; then
    pm2 restart $PM2_APP_NAME || pm2 start npm --name $PM2_APP_NAME -- start
    pm2 save
    echo '✅ PM2 服务已重启'
else
    echo '⚠️  未检测到 PM2，请手动重启服务'
fi

echo '✅ 部署完成！'
"@

# 执行部署
Invoke-Expression "$SSH_CMD '$DEPLOY_SCRIPT'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 部署成功！" -ForegroundColor Green
    Write-Host "开物助理的所有更新已部署到线上服务器！" -ForegroundColor Green
} else {
    Write-Host "`n❌ 部署失败，请检查错误信息" -ForegroundColor Red
    exit 1
}
