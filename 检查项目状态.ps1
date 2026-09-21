# 项目状态检查脚本
$projectPath = "E:\小宋\腾讯云生产版同步_20260918"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   小宋编导工作台 - 项目状态检查" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $projectPath

# 检查 Git 状态
Write-Host "📦 Git 状态:" -ForegroundColor Yellow
try {
    $branch = git branch --show-current
    Write-Host "  当前分支: $branch" -ForegroundColor Green
    $status = git status --short
    if ($status) {
        Write-Host "  未提交的更改:" -ForegroundColor Yellow
        git status --short
    } else {
        Write-Host "  ✓ 工作区干净" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ 未初始化 Git 仓库" -ForegroundColor Yellow
}
Write-Host ""

# 检查依赖
Write-Host "📚 依赖状态:" -ForegroundColor Yellow
if (Test-Path "node_modules") {
    $nodeModulesSize = [math]::Round((Get-ChildItem node_modules -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    Write-Host "  ✓ node_modules 已安装 ($nodeModulesSize MB)" -ForegroundColor Green
} else {
    Write-Host "  ✗ node_modules 未安装" -ForegroundColor Red
}
Write-Host ""

# 检查环境配置
Write-Host "⚙️  环境配置:" -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "  ✓ .env.local 已配置" -ForegroundColor Green
} else {
    Write-Host "  ✗ .env.local 未配置" -ForegroundColor Red
}
if (Test-Path ".env.example") {
    Write-Host "  ✓ .env.example 模板存在" -ForegroundColor Green
}
Write-Host ""

# 检查关键目录
Write-Host "📁 项目结构:" -ForegroundColor Yellow
$dirs = @("app", "components", "lib", "types", "supabase")
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "  ✓ $dir/" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $dir/" -ForegroundColor Red
    }
}
Write-Host ""

# 检查运行中的进程
Write-Host "🔧 开发服务器:" -ForegroundColor Yellow
$nodeProcess = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcess) {
    Write-Host "  ✓ Node.js 进程运行中 (PID: $($nodeProcess.Id -join ', '))" -ForegroundColor Green
} else {
    Write-Host "  ✗ 开发服务器未运行" -ForegroundColor Yellow
}
Write-Host ""

# Node.js 版本
Write-Host "💻 环境信息:" -ForegroundColor Yellow
try {
    $nodeVer = node --version
    $npmVer = npm --version
    Write-Host "  Node.js: $nodeVer" -ForegroundColor Green
    Write-Host "  npm: $npmVer" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js 未安装" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "检查完成！" -ForegroundColor Cyan
Write-Host ""
pause
