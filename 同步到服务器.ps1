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

# 构建对内存敏感，这台机器物理内存只有 2G。没有 swap 时一旦吃紧，
# 内核既杀不掉也换不出，表现为 SSH 与网站同时失联，只能去控制台强制重启。
$swap = (ssh -i "$sshKey" ${serverUser}@${serverIP} "free -m | awk '/Swap:/ {print \$2}'" | Out-String).Trim()
if ($swap -eq "0") {
    Write-Host ""
    Write-Host "服务器没有 swap，构建可能把机器压死。建议先执行：" -ForegroundColor Red
    Write-Host "  sudo fallocate -l 2G /swapfile; sudo chmod 600 /swapfile; sudo mkswap /swapfile; sudo swapon /swapfile" -ForegroundColor Gray
    $go = Read-Host "仍要继续吗? (y/n)"
    if ($go -ne "y") { exit 0 }
} else {
    Write-Host "  swap: ${swap}MB" -ForegroundColor Gray
}
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
# 解压与依赖安装。这一步很快，放在前台执行。
# 注意：绝不要在这里 rm -rf .next。服务器只有 2G 内存，删掉缓存会触发全量
# 构建，内存峰值直接把机器压死——SSH 和网站一起失联，只能去控制台强制重启。
# 保留缓存做增量构建，内存占用低得多。
$prepCmd = "set -e; cd $serverPath; tar -xzf /tmp/$pkgName; npm install --silent; rm -f /tmp/$pkgName; echo PREP_OK"
$prep = ssh -i "$sshKey" ${serverUser}@${serverIP} $prepCmd
if ($LASTEXITCODE -ne 0 -or ($prep | Out-String) -notmatch "PREP_OK") {
    Write-Host "解压或依赖安装失败，线上服务未变更" -ForegroundColor Red
    Remove-Item $tempPkg -Force -ErrorAction SilentlyContinue
    pause
    exit 1
}

# 构建放后台跑，不随 SSH 会话生死。
# 曾经因为构建期间 SSH 断开，构建半途而废并在 .next 里留下锁，
# 之后每次构建都被"Another next build process is already running"挡住。
# NODE_OPTIONS 限制 V8 堆上限，给系统留出余量。
Write-Host "  在服务器上构建（后台执行，不受连接中断影响）..." -ForegroundColor Gray
$buildCmd = "cd $serverPath; rm -f /tmp/build.log; NODE_OPTIONS=--max-old-space-size=1400 nohup npm run build > /tmp/build.log 2>&1 & echo BUILD_STARTED"
ssh -i "$sshKey" ${serverUser}@${serverIP} $buildCmd | Out-Null

$built = $false
for ($b = 1; $b -le 40; $b++) {
    Start-Sleep -Seconds 15
    $log = (ssh -i "$sshKey" ${serverUser}@${serverIP} "tail -25 /tmp/build.log 2>/dev/null" | Out-String)

    if ($log -match "Failed to compile|error TS\d+|Another next build process") {
        Write-Host "  构建失败：" -ForegroundColor Red
        $log -split "`n" | Select-Object -Last 12 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Write-Host "  线上仍在跑旧版本，未受影响" -ForegroundColor Yellow
        pause
        exit 1
    }
    # 构建结束会输出路由表，用它作为完成标志
    if ($log -match "Route \(app\)|\(Static\)\s+prerendered") {
        $built = $true
        Write-Host "  构建完成（约 $($b * 15) 秒）" -ForegroundColor Green
        break
    }
    if ($b % 4 -eq 0) { Write-Host "    构建中… 已等待 $($b * 15) 秒" -ForegroundColor DarkGray }
}

if (-not $built) {
    Write-Host "  构建超过 10 分钟仍未结束，请登录服务器查看 /tmp/build.log" -ForegroundColor Red
    pause
    exit 1
}

ssh -i "$sshKey" ${serverUser}@${serverIP} "pm2 restart xiaosong-web"
if ($LASTEXITCODE -ne 0) {
    Write-Host "重启失败，请登录服务器检查" -ForegroundColor Red
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
