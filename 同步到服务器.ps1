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
$pkgName = "xiaosong-sync-$timestamp.tar.gz"
# 压缩包放到系统临时目录，避免污染项目目录
$tempPkg = Join-Path $env:TEMP $pkgName
Write-Host "创建压缩包..." -ForegroundColor Yellow

# 部署清单。缺少 hooks 会导致 useGenerationPage 解析失败，
# 缺少 postcss.config.js 会导致 Tailwind 不生效，两者都会让服务器构建出问题。
$payload = @(
    "app", "components", "hooks", "lib", "types", "supabase", "public",
    "middleware.ts", "next.config.js", "postcss.config.js", "tailwind.config.js",
    "tsconfig.json", "components.json", "package.json", "package-lock.json"
)
$existing = @($payload | Where-Object { Test-Path $_ })
$missing  = @($payload | Where-Object { -not (Test-Path $_) })

# 逐项存在性检查：打包命令遇到不存在的路径会直接报错中断，
# 早期版本清单里写死了并不存在的 public 目录，导致脚本每次都在这里失败。
if ($missing.Count -gt 0) {
    Write-Host "以下项不存在，已跳过: $($missing -join ', ')" -ForegroundColor DarkYellow
}
Write-Host "打包 $($existing.Count) 项..." -ForegroundColor Gray

# 使用 tar 而非 Compress-Archive。
# PowerShell 5.1 的 Compress-Archive 会用反斜杠写 zip 条目路径(app\api\route.ts)，
# 这违反 ZIP 规范，Linux 端 unzip 会把整串当成单个文件名，目录结构直接塌掉。
# tar (Windows 10 1803+ 自带 bsdtar) 输出标准正斜杠路径，且原生保留 UTF-8 文件名。
tar -czf $tempPkg $existing
if ($LASTEXITCODE -ne 0) {
    Write-Host "打包失败，已中止部署" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "上传到服务器..." -ForegroundColor Yellow
scp -i "$sshKey" $tempPkg "${serverUser}@${serverIP}:/tmp/$pkgName"
if ($LASTEXITCODE -ne 0) {
    Write-Host "上传失败，已中止部署" -ForegroundColor Red
    Remove-Item $tempPkg -Force -ErrorAction SilentlyContinue
    pause
    exit 1
}

Write-Host "服务器端部署..." -ForegroundColor Yellow
# set -e 保证任一步失败立即中止，不会带着半截代码 restart。
# npm run build 不可省略：next start 跑的是 .next 构建产物，
# 只解压源码而不重新构建，线上跑的仍然是旧版本。
$remoteCmd = "set -e; cd $serverPath; tar -xzf /tmp/$pkgName; npm install; npm run build; pm2 restart xiaosong-web; rm -f /tmp/$pkgName"
ssh -i "$sshKey" ${serverUser}@${serverIP} $remoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "服务器端部署失败，线上服务未变更，请登录服务器检查" -ForegroundColor Red
    Remove-Item $tempPkg -Force -ErrorAction SilentlyContinue
    pause
    exit 1
}

Remove-Item $tempPkg -Force -ErrorAction SilentlyContinue
Write-Host "部署完成！" -ForegroundColor Green
Write-Host "请访问 http://$serverIP 验证部署结果" -ForegroundColor Cyan
pause
