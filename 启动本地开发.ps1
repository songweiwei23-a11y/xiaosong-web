# 小宋编导工作台 - 本地开发启动脚本
$ErrorActionPreference = "Stop"
$projectPath = "E:\小宋\腾讯云生产版同步_20260918"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   小宋编导工作台 - 本地开发环境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] 检查项目目录..." -ForegroundColor Yellow
if (-not (Test-Path $projectPath)) {
    Write-Host "错误: 项目目录不存在!" -ForegroundColor Red
    pause
    exit 1
}
Set-Location $projectPath
Write-Host "项目目录正常" -ForegroundColor Green
Write-Host ""

Write-Host "[2/5] 检查 Node.js 环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Node.js" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

Write-Host "[3/5] 检查项目依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装依赖..." -ForegroundColor Yellow
    npm install
}
Write-Host "依赖已安装" -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] 检查环境配置..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "警告: 未找到 .env.local 文件" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[5/5] 启动开发服务器..." -ForegroundColor Yellow
Write-Host "访问地址: http://localhost:3000" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
npm run dev
