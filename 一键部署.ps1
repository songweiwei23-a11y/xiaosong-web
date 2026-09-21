# 一键部署：推送代码 -> 同步到服务器 -> 等待就绪 -> 校验
#
# 把「git push」和「同步到服务器」串起来，避免两步之间遗漏。
# 之前出现过代码已推送但没同步、以及同步后立刻访问撞上重启窗口的情况。
$ErrorActionPreference = "Stop"
$projectPath = "E:\小宋\腾讯云生产版同步_20260918"

$Host.UI.RawUI.WindowTitle = "小宋工作台 - 一键部署"
Set-Location $projectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   一键部署到腾讯云" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- 1. 本地检查 ----------
Write-Host "[1/4] 本地检查..." -ForegroundColor Yellow

$dirty = git status --short 2>$null
if ($dirty) {
    Write-Host "有未提交的改动：" -ForegroundColor Yellow
    $dirty | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "  未提交的改动不会被部署（打包的是工作区文件，但 git 记录会对不上）。" -ForegroundColor Yellow
    $go = Read-Host "  仍要继续吗? (y/n)"
    if ($go -ne "y") { exit 0 }
}

$ahead = git rev-list --count origin/main..main 2>$null
Write-Host "  待推送提交: $ahead" -ForegroundColor Gray

# ---------- 2. 类型检查与测试 ----------
# 构建失败会让服务器端 set -e 中途退出，留下"解压了新代码但没构建"的状态。
# 本地先拦住，比在生产环境上试错代价小得多。
Write-Host ""
Write-Host "[2/4] 类型检查与测试..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "  类型检查未通过，已中止部署" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  类型检查通过" -ForegroundColor Green

npx vitest run 2>&1 | Select-Object -Last 4
if ($LASTEXITCODE -ne 0) {
    Write-Host "  测试未通过，已中止部署" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  测试通过" -ForegroundColor Green

# ---------- 3. 推送 ----------
Write-Host ""
Write-Host "[3/4] 推送到 GitHub..." -ForegroundColor Yellow
if ($ahead -eq "0") {
    Write-Host "  没有待推送的提交，跳过" -ForegroundColor Gray
} else {
    git push --force-with-lease origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  推送失败，已中止部署" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "  推送成功" -ForegroundColor Green
}

# ---------- 4. 同步到服务器 ----------
Write-Host ""
Write-Host "[4/4] 同步到服务器（含构建、重启、就绪等待）..." -ForegroundColor Yellow
Write-Host ""
& "$projectPath\同步到服务器.ps1"
