# 同步到服务器脚本
#
# -Yes：跳过两处确认。给非交互环境用（CI、后台窗口、被别的脚本调起）。
#       在 NonInteractive 模式下 Read-Host 会直接抛异常，脚本走不到同步那一步。
#       注意 -Yes 只跳过"确认"，不跳过检查——swap 读不到照样会红字警告。
# 外部命令(tar/scp/ssh/git/npx)向 stderr 写入时，PowerShell 5.1 会把它包成
# ErrorRecord。若 ErrorActionPreference 为 Stop，这会直接终止脚本，连后面的
# pause 都执行不到，表现就是"窗口闪退、看不到任何错误"。
# 这些命令的成败一律以 $LASTEXITCODE 判断，因此这里不能用 Stop。
param([switch]$Yes)

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
# 别改回去解析 pm2 describe 的表格：那行长这样
#   │ exec cwd          │ /var/www/xiaosong-web        │
# 末尾还有一根竖线，而 sed 's/.*│ *//' 是贪婪的，会一路吃到最后那根，
# 结果恒为空字符串——脚本每次都停在下面那句"无法读取 PM2 工作目录"，
# 还倒打一耙说进程不存在，害人去查一个根本没有的问题。
# 改读 pm2 jlist 的 JSON。这里刻意不带任何引号和方括号：
# PowerShell 5.1 把命令交给 ssh 时会重新拆词，引号到不了远端 shell。
$cwdCmd = 'pm2 jlist 2>/dev/null | tr , ''\n'' | grep pm_cwd | head -1 | sed s/.*pm_cwd...// | sed s/.$//'
$pm2Cwd = ssh -i "$sshKey" ${serverUser}@${serverIP} $cwdCmd
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
# 这里原本是 awk '/Swap:/ {print $2}'，但 $2 过不来：
# PowerShell 5.1 把命令交给 ssh 时会重新拆词，转义的 $ 到远端变成裸反斜杠，
# awk 直接报语法错，$swap 恒为空。空字符串不等于 "0"，于是永远走 else 分支，
# 打印出一句「swap: MB」——检查形同虚设，真没 swap 时也照样往下走，
# 而这台机器只有 2G 内存，没 swap 构建会把它压死。
# 改成 grep，不需要任何 $ 和引号。
$swapLine = (ssh -i "$sshKey" ${serverUser}@${serverIP} "free -m | grep -i swap" | Out-String).Trim()
$swap = if ($swapLine -match '^\S+\s+(\d+)') { $Matches[1] } else { "" }
if ($swap -eq "0" -or $swap -eq "") {
    Write-Host ""
    Write-Host $(if ($swap -eq "") { "读不到 swap 信息，无法确认内存安全。" }
                 else { "服务器没有 swap，构建可能把机器压死。" }) -ForegroundColor Red
    Write-Host "建议先执行：" -ForegroundColor Red
    Write-Host "  sudo fallocate -l 2G /swapfile; sudo chmod 600 /swapfile; sudo mkswap /swapfile; sudo swapon /swapfile" -ForegroundColor Gray
    if (-not $Yes) {
        $go = Read-Host "仍要继续吗? (y/n)"
        if ($go -ne "y") { exit 0 }
    }
} else {
    Write-Host "  swap: ${swap}MB" -ForegroundColor Gray
}
Write-Host ""

Write-Host "[3/3] 同步文件..." -ForegroundColor Yellow
if (-not $Yes) {
    $confirm = Read-Host "确认开始同步? (y/n)"
    if ($confirm -ne "y") { exit 0 }
} else {
    Write-Host "  -Yes：跳过确认" -ForegroundColor Gray
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$pkgName = "xiaosong-sync-$timestamp.tar.gz"
# 压缩包放到系统临时目录，避免污染项目目录
$tempPkg = Join-Path $env:TEMP $pkgName
Write-Host "创建压缩包..." -ForegroundColor Yellow

# 部署清单。缺少 hooks 会导致 useGenerationPage 解析失败，
# 缺少 postcss.config.js 会导致 Tailwind 不生效，两者都会让服务器构建出问题。
# 部署清单。缺少 hooks 会导致 useGenerationPage 解析失败，
# 缺少 postcss.config.js 会导致 Tailwind 不生效，两者都会让服务器构建出问题。
#
# tests 也必须传。服务器上的 npm run build 会跑 tsc，而 tsc 会把 tests/ 一起
# 类型检查。早期部署过一份 tests，之后清单里没有它，那份就永远停在旧版本——
# 一旦改动让旧测试类型不过（实测：删掉 plans.ts 里的 features 字段后，
# 服务器上那份旧 quota.test.ts 立刻让构建失败），部署就卡住，
# 而本地一切正常，很难想到是服务器上一份没人管的旧文件在拦路。
$payload = @(
    "app", "components", "hooks", "lib", "types", "supabase", "public", "tests",
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

<#
  每次构建打一个唯一标记，并要求它出现在日志里才认这次构建。

  【为什么必须这样】原来的写法是：清空日志 → 后台起构建 → 轮询 tail，
  看到 "Route (app)" 或 "(Static) prerendered" 就算构建完成。

  问题在于**构建没启动时，日志还是上一次成功构建留下的**，而那份旧日志的
  末尾恰好就有这两个标志。于是脚本第一次轮询就匹配上，报告"构建完成
  （约 15 秒）"，然后拿着旧构建去重启 pm2——
  屏幕上一路绿字"部署成功"，线上代码一个字没变。

  真实发生过：源文件 12:24 传上去了，.next 却还是 10:44 的，
  pm2 在 12:39 拿旧构建重启。用户以为发布了，功能当然没生效。

  现在：标记写在日志第一行，轮询时同时看第一行和末尾。
  标记对不上 = 这次构建根本没起来，直接报错，绝不往下走。
#>
$buildTag = "BUILD_" + (Get-Date -Format "yyyyMMddHHmmss")
$buildCmd = "cd $serverPath; rm -f /tmp/build.log; echo $buildTag > /tmp/build.log; NODE_OPTIONS=--max-old-space-size=1400 nohup npm run build >> /tmp/build.log 2>&1 & echo BUILD_STARTED"
$startOut = (ssh -i "$sshKey" ${serverUser}@${serverIP} $buildCmd | Out-String)
if ($startOut -notmatch "BUILD_STARTED") {
    Write-Host "  构建命令没能在服务器上启动，线上仍是旧版本" -ForegroundColor Red
    Write-Host "  服务器返回：$($startOut.Trim())" -ForegroundColor DarkGray
    pause
    exit 1
}

$built = $false
for ($b = 1; $b -le 40; $b++) {
    Start-Sleep -Seconds 15
    # 第一行是本次的标记，末尾是构建进度，一次取回来
    $log = (ssh -i "$sshKey" ${serverUser}@${serverIP} "head -1 /tmp/build.log 2>/dev/null; tail -25 /tmp/build.log 2>/dev/null" | Out-String)

    # 标记不在 = 日志不是这次构建写的，后面那些"完成"标志都是上一次留下的
    if ($log -notmatch [regex]::Escape($buildTag)) {
        Write-Host "  构建日志不是本次构建写的（缺少标记 $buildTag）" -ForegroundColor Red
        Write-Host "  说明构建没真正跑起来，线上仍是旧版本。请登录服务器查看 /tmp/build.log" -ForegroundColor Yellow
        pause
        exit 1
    }

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

<#
  重启前先确认 .next 真的比源码新。

  这是上面那个坑的兜底：万一构建又以别的方式"假成功"，这里还能拦住。
  判据很直接——构建产物必须晚于本次上传的源文件，否则重启的就是旧代码。
  （find -newer 直接比 mtime，比解析时间字符串稳。）
#>
# 命令里不能有引号、花括号、分号——它们过不了 PowerShell 到 ssh 的参数拆分，
# 远端会直接 "Connection closed"，而这里只会拿到空字符串，
# 表现就是"检查通过"。这道闸本身就成了假闸，比没有还糟。
# 已实测：正向（有新文件）能抓到、反向（没有）返回空。
$staleCmd = "cd $serverPath && find app lib hooks -type f -newer .next/BUILD_ID -print -quit"
$stale = ssh -i "$sshKey" ${serverUser}@${serverIP} $staleCmd
$stale = ($stale | Out-String).Trim()
if ($stale) {
    Write-Host "  构建产物比源码旧，说明这次构建没有包含最新改动：" -ForegroundColor Red
    $stale -split "`n" | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    Write-Host "  已中止，不会拿旧构建去重启。请登录服务器查看 /tmp/build.log" -ForegroundColor Yellow
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
Write-Host "[5/5] 校验线上文件是否为本次版本..." -ForegroundColor Yellow
# 旧版这里数的是 search_query / saveDifyConversationId 出现了几次——那是很久以前
# 某次 Dify 改动的痕迹。文件一个都没传上去，这两个数照样对，等于没校验。
#
# 改成逐个比对 MD5。已验证 Windows 与 Linux 算出的哈希一致（tar 原样打包，
# 不动行尾），对得上就是同一份字节。
#
# 比的是"这次上传的全部文件"，不是"HEAD 这个提交改了哪些文件"：
# 部署传的是整个工作区，而 HEAD 完全可能是一个没碰业务代码的提交
# （比如改了这个脚本本身），那样按 HEAD 取差集会得到空集合、直接跳过校验，
# 校验就又变成了摆设。186 个文件本地算哈希只要 1 秒，没必要省。
$srcDirs = @("app", "components", "hooks", "lib", "types", "supabase", "public") |
    Where-Object { Test-Path $_ }
$localHash = @{}
$rootLen = (Get-Item -LiteralPath $projectPath).FullName.Length + 1
foreach ($file in Get-ChildItem -Path $srcDirs -Recurse -File -ErrorAction SilentlyContinue) {
    # 不能用 Resolve-Path -Relative：它按通配符解析路径，而项目里有
    # app/dashboard/profiles/[id]/edit——方括号被当成字符集，这一条会静静地
    # 算不出来（返回 null），文件数从 186 变 185，少校验一个也没人发现。
    $rel = $file.FullName.Substring($rootLen) -replace '\\', '/'
    $localHash[$rel] = (Get-FileHash -LiteralPath $file.FullName -Algorithm MD5).Hash.ToLower()
}

# 用 find 让服务器自己列文件，省得把上万字符的路径拼进命令行。
# 同样不带引号：PowerShell 5.1 把命令交给 ssh 时会重新拆词。
$findCmd = "cd $serverPath; find $($srcDirs -join ' ') -type f -exec md5sum {} +"
$remote = ssh -i "$sshKey" ${serverUser}@${serverIP} $findCmd
$remoteHash = @{}
foreach ($line in ($remote -split "`n")) {
    if ($line -match '^([0-9a-f]{32})\s+\.?/?(\S+)') { $remoteHash[$Matches[2]] = $Matches[1] }
}

if ($remoteHash.Count -eq 0) {
    Write-Host "  没能从服务器读到任何哈希，校验无效——请手动确认" -ForegroundColor Red
    pause
    exit 1
}

$bad = @($localHash.Keys | Where-Object { $remoteHash[$_] -ne $localHash[$_] })
if ($bad.Count -gt 0) {
    Write-Host "  以下文件线上和本地对不上，本次改动没有真正生效：" -ForegroundColor Red
    $bad | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    if ($bad.Count -gt 20) { Write-Host "    …另有 $($bad.Count - 20) 个" -ForegroundColor Red }
    pause
    exit 1
}
Write-Host "  $($localHash.Count) 个文件全部比对一致" -ForegroundColor Green

Write-Host ""
Write-Host "部署完成，服务已就绪！" -ForegroundColor Green
Write-Host "现在可以访问 http://$serverIP 使用，不会再落到重启窗口里。" -ForegroundColor Cyan
pause
