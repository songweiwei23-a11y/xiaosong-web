# 项目构建测试脚本
$ErrorActionPreference = "Stop"
$projectPath = "E:\小宋\腾讯云生产版同步_20260918"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   项目构建测试 - 部署前检查" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $projectPath

# 清理旧构建
Write-Host "[1/4] 清理旧构建..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✓ 已清理 .next 目录" -ForegroundColor Green
}
Write-Host ""

# 类型检查
Write-Host "[2/4] TypeScript 类型检查..." -ForegroundColor Yellow
npm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 类型检查失败!" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✓ 类型检查通过" -ForegroundColor Green
Write-Host ""

# 构建项目
Write-Host "[3/4] 构建生产版本..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 构建失败!" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✓ 构建成功" -ForegroundColor Green
Write-Host ""

# 显示构建信息
Write-Host "[4/4] 构建信息..." -ForegroundColor Yellow
if (Test-Path ".next") {
    $buildSize = [math]::Round((Get-ChildItem .next -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    Write-Host "✓ 构建大小: $buildSize MB" -ForegroundColor Green
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "   ✓ 构建测试完成，可以部署！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$deploy = Read-Host "是否启动生产预览? (y/n)"
if ($deploy -eq "y") {
    Write-Host ""
    Write-Host "启动生产模式预览..." -ForegroundColor Yellow
    Write-Host "访问地址: http://localhost:3000" -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:3000"
    npm run start
}
