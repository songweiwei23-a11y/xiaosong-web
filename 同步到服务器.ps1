# 同步到服务器脚本
# 外部命令(tar/scp/ssh/git/npx)向 stderr 写入时，PowerShell 5.1 会把它包成
# ErrorRecord。若 ErrorActionPreference 为 Stop，这会直接终止脚本，连后面的
# pause 都执行不到，表现就是"窗口闪退、看不到任何错误"。
# 这些命令的成败一律以 $LASTEXITCODE 判断，因此这里不能用 Stop。
$ErrorActionPreference = "Continue"

# 兜底：任何未预期的终止错误都先打出来再停住，不让窗口直接消失。
trap {
    Write-Host ""
    Write-Host "脚本异常终止：" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    if ($_.InvocationInfo) {
        Write-Host "  位置: 第 $($_.InvocationInfo.ScriptLineNumber) 行 -> $($_.InvocationInfo.Line.Trim())" -ForegroundColor DarkGray
    }
    Write-Host ""
    pause
    exit 1
}
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

# 部署目录必须与 PM2 进程的工作目录一致，否则文件传上去了、构建也成功了，
# 但 next start 用的是另一个目录里的旧产物。曾因此出现"grep 文件是新代码、
# 实际请求却是旧行为"的假象，排查了很久。
$pm2Cwd = ssh -i "$sshKey" ${serverUser}@${serverIP} "pm2 describe xiaosong-web 2>/dev/null | grep -i 'exec cwd' | sed 's/.*│ *//' | tr -d ' '"
$pm2Cwd = ($pm2Cwd | Out-String).Trim()
if (-not $pm2Cwd) {
    Write-Host "无法读取 PM2 工作目录，请确认进程 xiaosong-web 存在" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  PM2 运行目录: $pm2Cwd" -ForegroundColor Gray
Write-Host "  部署目标目录: $serverPath" -ForegroundColor Gray
if ($pm2Cwd -ne $serverPath) {
    Write-Host ""
    Write-Host "两者不一致，部署不会生效，已中止。" -ForegroundColor Red
    Write-Host "修复方式（让 PM2 指向部署目录）：" -ForegroundColor Yellow
    Write-Host "  pm2 delete xiaosong-web; cd $serverPath && pm2 start npm --name xiaosong-web -- start && pm2 save" -ForegroundColor Gray
    pause
    exit 1
}
Write-Host "服务器连接正常，运行目录与部署目录一致" -ForegroundColor Green
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

# pm2 restart 返回后服务并未立即可用：Next.js 还要几十秒才起得来，
# 期间旧进程可能仍在应答。曾因此把请求交给旧进程处理，新增逻辑没执行，
# 排查了很久才发现只是差了 24 秒。这里必须等到新进程真正接管。
Write-Host ""
Write-Host "[4/5] 等待服务就绪..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Seconds 3
    $code = ssh -i "$sshKey" ${serverUser}@${serverIP} "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ || echo 000"
    $code = ($code | Out-String).Trim()
    if ($code -match '^(200|30\d)$') {
        $ready = $true
        Write-Host "  服务已响应 (HTTP $code)，耗时约 $($i * 3) 秒" -ForegroundColor Green
        break
    }
    Write-Host "  第 $i 次探测: $code" -ForegroundColor DarkGray
}
if (-not $ready) {
    Write-Host "  服务超过 2 分钟仍未响应，请登录服务器查看 pm2 logs" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "[5/5] 校验线上代码是否为本次版本..." -ForegroundColor Yellow
$verifyCmd = "cd $serverPath; " +
  "echo search_query=`$(grep -c search_query app/api/dify/stream/route.ts); " +
  "echo conv=`$(grep -c saveDifyConversationId app/api/dify/stream/route.ts); " +
  "echo restarts=`$(pm2 jlist | grep -o '\`"restart_time\`":[0-9]*' | head -1 | cut -d: -f2)"
$verify = ssh -i "$sshKey" ${serverUser}@${serverIP} $verifyCmd
$verify -split "`n" | Where-Object { $_.Trim() } | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

Write-Host ""
Write-Host "部署完成，服务已就绪！" -ForegroundColor Green
Write-Host "现在可以访问 http://$serverIP 使用，不会再落到重启窗口里。" -ForegroundColor Cyan
pause
