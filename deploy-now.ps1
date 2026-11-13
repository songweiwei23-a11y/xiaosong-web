# 开物助理升级 - 一键部署到服务器
# 直接运行：.\deploy-now.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 开始部署开物助理升级到线上服务器..." -ForegroundColor Green
Write-Host ""

$SSH_KEY = "$env:USERPROFILE\Desktop\song.pem"
$SERVER = "ubuntu@122.51.234.155"
$PROJECT_PATH = "/home/ubuntu/xiaosong-web"

Write-Host "服务器: $SERVER" -ForegroundColor Cyan
Write-Host "项目路径: $PROJECT_PATH" -ForegroundColor Cyan
Write-Host ""

# 执行部署
Write-Host "正在执行部署命令..." -ForegroundColor Yellow

$commands = @(
    "cd $PROJECT_PATH",
    "echo '📥 1. 拉取最新代码...'",
    "git pull origin main",
    "echo '📦 2. 安装依赖...'",
    "npm install",
    "echo '🔨 3. 构建项目...'",
    "npm run build",
    "echo '🔄 4. 重启服务...'",
    "pm2 restart xiaosong-web || pm2 start npm --name xiaosong-web -- start",
    "pm2 save",
    "echo '✅ 部署完成！'"
)

$script = $commands -join "; "

try {
    ssh -i $SSH_KEY $SERVER $script
    
    Write-Host ""
    Write-Host "🎉 部署成功！" -ForegroundColor Green
    Write-Host "开物助理的所有新功能已上线！" -ForegroundColor Green
    Write-Host ""
    Write-Host "升级内容：" -ForegroundColor Cyan
    Write-Host "  ✅ 悬浮助手按钮" -ForegroundColor White
    Write-Host "  ✅ 新用户引导" -ForegroundColor White
    Write-Host "  ✅ 智能主动提示" -ForegroundColor White
    Write-Host "  ✅ 上下文理解" -ForegroundColor White
    Write-Host "  ✅ 习惯记忆" -ForegroundColor White
    Write-Host "  ✅ 主动建议" -ForegroundColor White
    Write-Host "  ✅ 问题分析" -ForegroundColor White
    Write-Host "  ✅ 月度报告" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "❌ 部署过程中出现错误：" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "请尝试手动登录服务器执行：" -ForegroundColor Yellow
    Write-Host "  ssh -i `"$SSH_KEY`" $SERVER" -ForegroundColor White
    Write-Host "  cd $PROJECT_PATH" -ForegroundColor White
    Write-Host "  git pull origin main" -ForegroundColor White
    Write-Host "  npm install" -ForegroundColor White
    Write-Host "  npm run build" -ForegroundColor White
    Write-Host "  pm2 restart xiaosong-web" -ForegroundColor White
}