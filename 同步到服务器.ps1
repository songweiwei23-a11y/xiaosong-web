param([switch]$Yes)

$ErrorActionPreference = "Stop"
$server = "ubuntu@122.51.234.155"
$deployPath = "/var/www/xiaosong-web"
$key = "C:\Users\DELL\Desktop\song.pem"
$sshOptions = @("-i", $key, "-o", "BatchMode=yes", "-o", "ConnectTimeout=12")
$buildTag = "BUILD_" + (Get-Date -Format "yyyyMMddHHmmssfff")
$archiveName = "kaiwu-$buildTag.tar.gz"
$archiveLocal = Join-Path $env:TEMP $archiveName
$runnerLocal = Join-Path $env:TEMP "kaiwu-$buildTag.sh"
$jobDir = "$deployPath/.deployments"
$logFile = "$jobDir/$buildTag.log"
$resultFile = "$jobDir/$buildTag.result"

$payload = @(
    "app", "components", "hooks", "lib", "types", "supabase", "public", "tests",
    "middleware.ts", "instrumentation.ts", "next.config.js", "postcss.config.js",
    "tailwind.config.js", "tsconfig.json", "components.json", "package.json", "package-lock.json"
)

Push-Location $PSScriptRoot
try {
    if (!(Test-Path -LiteralPath $key -PathType Leaf)) { throw "SSH 密钥文件不存在。" }
    $commit = (git rev-parse HEAD | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$') { throw "无法确认源码 HEAD。" }
    $dirty = git status --short
    if ($LASTEXITCODE -ne 0) { throw "无法读取工作区状态。" }
    Write-Host "发布编号 $buildTag，源码 HEAD $commit。"
    if ($dirty) { Write-Host "将发布当前工作区。归档 SHA256 用于确认实际发布的文件。" -ForegroundColor Yellow }
    if (-not $Yes -and (Read-Host "输入 y 开始正式站发布") -ne "y") { exit 0 }

    $existing = @($payload | Where-Object { Test-Path -LiteralPath $_ })
    & "$env:windir\System32\tar.exe" -czf $archiveLocal @existing
    if ($LASTEXITCODE -ne 0) { throw "源码打包失败。" }
    $hash = (Get-FileHash -LiteralPath $archiveLocal -Algorithm SHA256).Hash.ToLowerInvariant()
    $runner = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "scripts/deploy-kaiwu-release.sh")).Replace([string][char]13, "")
    [IO.File]::WriteAllText($runnerLocal, $runner, (New-Object System.Text.UTF8Encoding($false)))

    scp @sshOptions $archiveLocal $runnerLocal "${server}:/tmp/"
    if ($LASTEXITCODE -ne 0) { throw "上传失败，发布任务尚未启动。" }
    $remoteRunner = "/tmp/kaiwu-$buildTag.sh"
    $execute = "bash $remoteRunner $deployPath $buildTag /tmp/$archiveName $hash $commit"
    $job = 'status=0; {0} || status=$?; echo $status > {1}; rm -f -- /tmp/{2} {3}' -f $execute, $resultFile, $archiveName, $remoteRunner
    $launch = "mkdir -p $jobDir && (umask 077 && nohup bash -c '$job' </dev/null >$logFile 2>&1 &)"
    ssh @sshOptions $server $launch
    if ($LASTEXITCODE -ne 0) { throw "未能确认发布任务启动。可查询 $logFile。" }

    Write-Host "服务器正在独立目录构建，旧版继续提供服务。日志 $logFile"
    $status = ""
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        Start-Sleep -Seconds 10
        $response = ssh @sshOptions $server "if test -s $resultFile; then cat $resultFile; fi"
        if ($LASTEXITCODE -eq 0 -and "$response" -match '^\d+$') {
            $status = "$response"
            break
        }
        if ($attempt % 6 -eq 5) { Write-Host "已等候 $(($attempt + 1) * 10) 秒，发布任务继续在服务器后台运行。" }
    }
    ssh @sshOptions $server "tail -n 18 $logFile"
    if ($status -ne "0") {
        throw "发布任务未通过。请查看 $logFile 中的发布或回滚结果。"
    }
    Write-Host "正式站构建编号和健康检查已通过。" -ForegroundColor Green
} finally {
    foreach ($item in @($archiveLocal, $runnerLocal)) {
        if (Test-Path -LiteralPath $item -PathType Leaf) { Remove-Item -LiteralPath $item -Force }
    }
    Pop-Location
}
