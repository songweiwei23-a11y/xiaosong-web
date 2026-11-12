# 一键部署：推送当前分支 -> 同步到服务器 -> 等待就绪 -> 校验
#
# 把「git push」和「同步到服务器」串起来，避免两步之间遗漏。
# 之前出现过代码已推送但没同步、以及同步后立刻访问撞上重启窗口的情况。
# 服务器同步打包的是本地文件，不从 GitHub pull。推送是让远程的当前分支
# 记下即将发布的提交；这一步失败就停，不继续同步。
# 只做普通快进推送，推的是当前分支，不是 main。
# 比较之前先获取当前分支，更新本机的 origin/分支；获取失败就停，不用旧缓存。
# 远程还没有这个分支时按新分支普通推送。
# 本地落后于远程就停，请先 pull，避免把线上回退。
# 线上发布分支见 $expectedBranch，对不上会先问一声。
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
# 线上正在跑的分支。换发布分支时只改这里。
$expectedBranch = "sync/local-20261111"

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

$branch = "$(git rev-parse --abbrev-ref HEAD 2>$null)".Trim()
if (-not $branch -or $branch -eq "HEAD") {
    Write-Host "当前不在任何分支上（游离 HEAD），无法确定要推送哪个分支。" -ForegroundColor Red
    Write-Host "请先切换到 $expectedBranch 再发布。" -ForegroundColor Yellow
    pause
    exit 1
}
# 分支名若以加号或减号开头，或带冒号、两点、@{ ，会被 git 当成改写目标。正常分支名不会这样。
if ($branch.StartsWith("+") -or $branch.StartsWith("-") -or $branch.Contains(":") -or $branch.Contains("..") -or $branch.Contains("@{")) {
    Write-Host "分支名「$branch」不能用于普通推送，已中止。" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "  当前分支: $branch" -ForegroundColor Gray
if ($branch -cne $expectedBranch) {
    Write-Host ""
    Write-Host "当前分支是「$branch」，线上发布分支是「$expectedBranch」。" -ForegroundColor Yellow
    Write-Host "继续只会普通推送当前分支「$branch」（快进，不强推），不会改其他分支。" -ForegroundColor Yellow
    Write-Host "服务器同步的是当前工作区里的文件。如果这不是要发布的代码，请先切换到 $expectedBranch。" -ForegroundColor Yellow
    $go = Read-Host "  仍要继续吗? (y/n)"
    if ($go -ne "y") { exit 0 }
}

# 先拿到远程同名分支的最新提交，再和本地比。不用本机缓存的 origin/分支。
# refspec 前面没有加号：更新不了就失败停下，不会覆盖本机的远程跟踪分支。
Write-Host "  获取 origin/$branch ..." -ForegroundColor Gray
$fetchSpec = "refs/heads/${branch}:refs/remotes/origin/${branch}"
$fetchRaw = @(git fetch origin -- $fetchSpec 2>&1)
$fetchCode = $LASTEXITCODE
$ahead = "0"
$behind = "0"
$skipPush = $false
$remoteMissing = $false
if ($fetchCode -ne 0) {
    # 远程没有这个分支时，fetch 也会失败。用 ls-remote 的退出码把它和网络/更新失败分开：
    # 退出码 2 表示已经连上远程、但没有这条分支。
    # 只要退出码。2 表示连上了但没有这条分支；输出本身不用。
    $null = @(git ls-remote --exit-code origin -- "refs/heads/$branch" 2>&1)
    $probeCode = $LASTEXITCODE
    if ($probeCode -eq 2) {
        $remoteMissing = $true
        Write-Host "  远程还没有 origin/$branch，稍后会普通推送并建立这个分支" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "获取 origin/$branch 失败，已中止部署。" -ForegroundColor Red
        Write-Host "没有用本机缓存的远程分支做比较，类型检查和同步都还没开始。" -ForegroundColor Red
        Write-Host "请检查网络和 GitHub 登录后再发布。下面是 git 的原话：" -ForegroundColor Yellow
        $fetchRaw | ForEach-Object { Write-Host ("  " + "$_") -ForegroundColor DarkGray }
        pause
        exit 1
    }
}

if (-not $remoteMissing) {
    $remoteRef = "refs/remotes/origin/$branch"
    $remoteSha = "$(git rev-parse --verify --quiet $remoteRef 2>$null)".Trim()
    if (-not $remoteSha) {
        Write-Host ""
        Write-Host "获取 origin/$branch 之后，本机仍然没有这个远程跟踪分支，已中止部署。" -ForegroundColor Red
        Write-Host "没有继续类型检查，也还没同步。" -ForegroundColor Red
        pause
        exit 1
    }
    $ahead = (git rev-list --count ($remoteRef + "..HEAD") 2>$null | Out-String).Trim()
    $behind = (git rev-list --count ("HEAD.." + $remoteRef) 2>$null | Out-String).Trim()
    if ($ahead -notmatch '^\d+$' -or $behind -notmatch '^\d+$') {
        Write-Host ""
        Write-Host "已经拿到 origin/$branch，但数不清本地落后多少，已中止部署。" -ForegroundColor Red
        Write-Host "没有继续类型检查，也还没同步。" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "  相对 origin/${branch}：本地多 $ahead 个提交，远程多 $behind 个提交" -ForegroundColor Gray
    # 落后就停，不管本地有没有多出来的提交。同步用的是工作区文件，继续会把线上回退。
    if ([int]$behind -gt 0) {
        Write-Host ""
        Write-Host "本地比 origin/$branch 落后 $behind 个提交，已中止部署。" -ForegroundColor Red
        if ([int]$ahead -gt 0) {
            Write-Host "本地另外多 $ahead 个提交，两边已经分叉。" -ForegroundColor Red
        }
        Write-Host "请先在「$branch」上执行 git pull，再重新一键部署。" -ForegroundColor Yellow
        Write-Host "现在继续会把服务器同步成旧代码，线上会被回退。" -ForegroundColor Yellow
        pause
        exit 1
    }
    if ($ahead -eq "0") { $skipPush = $true }
}

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

# ---------- 3. 推送当前分支 ----------
# 下一步同步打包的是本地文件，不从 GitHub pull。
# 推送是为了让远程的当前分支记下即将发布的提交；失败就停，避免漏推或推错。
# refspec 两端都是当前分支，前面没有 +，也不会指向 main。
Write-Host ""
Write-Host "[3/4] 推送当前分支到 GitHub..." -ForegroundColor Yellow
if ($skipPush) {
    Write-Host "  没有待推送的提交，跳过" -ForegroundColor Gray
} else {
    $refspec = "refs/heads/${branch}:refs/heads/${branch}"
    Write-Host "  普通推送 origin/$branch（快进，不强推）" -ForegroundColor Gray
    git push origin -- $refspec
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  推送失败，已中止部署。没有强推，服务器也还没同步。" -ForegroundColor Red
        Write-Host "  若提示 non-fast-forward 或 rejected，说明远程有本地没有的提交，不是快进。" -ForegroundColor Yellow
        Write-Host "  请先在「$branch」上 git pull 合并后再发布，不要强推。" -ForegroundColor Yellow
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

Write-Host ""
pause
