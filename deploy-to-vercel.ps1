# 小宋编导工作台 - Vercel 一键部署脚本

Write-Host "🚀 开始部署到Vercel..." -ForegroundColor Green
Write-Host ""

# 检查Vercel CLI
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI 未安装" -ForegroundColor Red
    Write-Host ""
    Write-Host "请以管理员身份运行PowerShell，然后执行：" -ForegroundColor Yellow
    Write-Host "npm install -g vercel" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "安装完成后重新运行此脚本" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Vercel CLI 已安装" -ForegroundColor Green
Write-Host ""

# 登录Vercel
Write-Host "📝 请在浏览器中完成Vercel登录..." -ForegroundColor Yellow
vercel login

# 部署
Write-Host ""
Write-Host "🚀 开始部署..." -ForegroundColor Green
vercel --prod

Write-Host ""
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host "🌐 您的网站地址将显示在上方" -ForegroundColor Cyan