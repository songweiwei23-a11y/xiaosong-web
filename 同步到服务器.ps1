# 同步到服务器脚本
$ErrorActionPreference = "Stop"
$projectPath = "E:\小宋\腾讯云生产版同步_20260918"
$serverIP = "122.51.234.155"
$serverUser = "ubuntu"
$serverPath = "/var/www/xiaosong-web"
$sshKey = "C:\Users\DELL\Desktop\song.pem"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   同步到腾讯云服务器" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $projectPath

Write-Host "[1/3] 检查本地更改..." -ForegroundColor Yellow
$gitStatus = git status --short
if ($gitStatus) {
    Write-Host "本地有未提交的更改" -ForegroundColor Yellow
    git status --short
}
Write-Host ""

Write-Host "[2/3] 检查服务器连接..." -ForegroundColor Yellow
if (-not (Test-Path $sshKey)) {
    Write-Host "SSH 密钥不存在: $sshKey" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "服务器连接正常" -ForegroundColor Green
Write-Host ""

Write-Host "[3/3] 同步文件..." -ForegroundColor Yellow
$confirm = Read-Host "确认开始同步? (y/n)"
if ($confirm -ne "y") {
    exit 0
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tempZip = "xiaosong-sync-$timestamp.zip"
Write-Host "创建压缩包..." -ForegroundColor Yellow

Compress-Archive -Path @("app", "components", "lib", "types", "supabase", "public", "middleware.ts", "next.config.js", "package.json", "tsconfig.json", "tailwind.config.js") -DestinationPath $tempZip -Force

Write-Host "上传到服务器..." -ForegroundColor Yellow
scp -i "$sshKey" $tempZip ${serverUser}@${serverIP}:/tmp/

Write-Host "服务器端部署..." -ForegroundColor Yellow
ssh -i "$sshKey" ${serverUser}@${serverIP} "cd $serverPath && unzip -o /tmp/$tempZip && npm install && pm2 restart xiaosong-web"

Remove-Item $tempZip -Force
Write-Host "部署完成！" -ForegroundColor Green
pause
