# 小宋编导工作台 - 本地开发启动脚本
$ErrorActionPreference = "Stop"
$projectPath = "E:\小宋\腾讯云生产版同步_20260918"
$port = 3000
$url  = "http://localhost:$port"

$Host.UI.RawUI.WindowTitle = "小宋编导工作台 - 本地开发"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   小宋编导工作台 - 本地开发环境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] 检查项目目录..." -ForegroundColor Yellow
if (-not (Test-Path $projectPath)) {
    Write-Host "错误: 项目目录不存在: $projectPath" -ForegroundColor Red
    pause
    exit 1
}
Set-Location $projectPath
Write-Host "项目目录正常" -ForegroundColor Green
Write-Host ""

Write-Host "[2/5] 检查 Node.js 环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm -v
    Write-Host "Node.js $nodeVersion / npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Node.js，请先安装: https://nodejs.org" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

Write-Host "[3/5] 检查项目依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "首次运行，正在安装依赖(可能需要几分钟)..." -ForegroundColor Yellow
    npm install
    # npm 失败时不会终止脚本，必须显式检查退出码，
    # 否则会带着不完整的依赖继续启动，报一堆难以定位的模块错误。
    if ($LASTEXITCODE -ne 0) {
        Write-Host "依赖安装失败，请检查网络或 npm 配置" -ForegroundColor Red
        pause
        exit 1
    }
}
Write-Host "依赖已就绪" -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] 检查环境配置..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "错误: 未找到 .env.local" -ForegroundColor Red
    Write-Host "  Supabase 与 Dify 的密钥都在这个文件里，" -ForegroundColor Yellow
    Write-Host "  缺少它登录和所有 AI 功能都无法使用。" -ForegroundColor Yellow
    Write-Host "  可复制 .env.example 为 .env.local 后填入配置。" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host "环境配置正常" -ForegroundColor Green
Write-Host ""

Write-Host "[5/5] 启动开发服务器..." -ForegroundColor Yellow

# 端口占用检查。3000 被占用时 Next.js 会自动改用其它端口，
# 那样按 3000 轮询就永远等不到，浏览器也会开错地址。
$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
$autoOpen = $true
if ($busy) {
    Write-Host "端口 $port 已被占用" -ForegroundColor Red
    Write-Host "  可能开发服务器已在运行，可直接访问 $url 查看，" -ForegroundColor Yellow
    Write-Host "  或双击 停止开发服务器.bat 结束后重试。" -ForegroundColor Yellow
    Write-Host ""
    $go = Read-Host "仍要继续启动吗? Next.js 会自动换端口，请留意下方输出 (y/n)"
    if ($go -ne "y") { exit 0 }
    $autoOpen = $false
}

if ($autoOpen) {
    # 后台轮询，等服务真正响应了再开浏览器。
    # 早期版本固定 Start-Sleep 2 秒就打开，而 Next.js 首次编译远不止 2 秒，
    # 浏览器总是停在"无法连接"页面，得手动刷新。
    $waiter = "for (`$i=0; `$i -lt 120; `$i++) { try { `$null = Invoke-WebRequest '$url' -UseBasicParsing -TimeoutSec 2; Start-Process '$url'; break } catch { Start-Sleep -Seconds 1 } }"
    Start-Process powershell -ArgumentList "-NoProfile", "-WindowStyle", "Hidden", "-Command", $waiter -WindowStyle Hidden
    Write-Host "服务就绪后会自动打开浏览器，无需手动刷新" -ForegroundColor Gray
}

Write-Host "访问地址: $url" -ForegroundColor Green
Write-Host "停止服务: 在本窗口按 Ctrl + C" -ForegroundColor Gray
Write-Host ""

npm run dev

# 快捷方式直接调用本脚本(不再经过 .bat)，这里必须自己留住窗口，
# 否则开发服务器异常退出时窗口会瞬间关闭，看不到任何报错。
Write-Host ""
Write-Host "开发服务器已停止" -ForegroundColor Yellow
pause
