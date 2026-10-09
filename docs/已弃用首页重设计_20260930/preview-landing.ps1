$ErrorActionPreference = 'Stop'
$previewRoot = Split-Path -Parent $PSScriptRoot
$previewUrl = 'http://127.0.0.1:3001/preview/landing'
try {
    $previewResponse = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 10
    if ($previewResponse.StatusCode -eq 200 -and $previewResponse.Content -match 'landing-preview') {
        Write-Host "Preview is already running: $previewUrl"
        exit 0
    }
} catch {
    # Check port availability below without requesting system-wide connection access.
}

$previewPortBusy = $false
$previewSocket = New-Object System.Net.Sockets.TcpClient
try {
    $previewConnect = $previewSocket.ConnectAsync('127.0.0.1', 3001)
    if ($previewConnect.Wait(1000)) { $previewPortBusy = $previewSocket.Connected }
} catch {
    $previewPortBusy = $false
} finally {
    $previewSocket.Dispose()
}
if ($previewPortBusy) {
    throw 'Port 3001 is occupied. Close the conflicting service or choose another preview port.'
}

Set-Location -LiteralPath $previewRoot
Write-Host "Open this URL after Next.js reports Ready: $previewUrl"
& npm.cmd run dev -- --hostname 127.0.0.1 --port 3001
exit $LASTEXITCODE
