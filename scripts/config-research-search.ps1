# 同 scripts/安全配置研究搜索.ps1（英文文件名 + 带 BOM，Windows PowerShell 5.1 能正确读中文；可直接在终端里运行）
# 在本机交互执行。密钥只通过已验证的 SSH 通道送入现有开物服务器。
$ErrorActionPreference = 'Stop'
$secureKey = Read-Host '粘贴现有阿里云联网搜索 API Key（输入隐藏，不发送到聊天）' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $searchKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    $configPayload = @{ apiKey = $searchKey } | ConvertTo-Json -Compress
    $configPayload | & ssh -i 'C:\Users\DELL\Desktop\song.pem' -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20 ubuntu@122.51.234.155 'cd /var/www/xiaosong-web && node scripts/configure-research-search.cjs'
    if ($LASTEXITCODE -ne 0) { throw '配置失败；没有覆盖原密钥，请检查终端提示。' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $searchKey = $null
    $configPayload = $null
    $secureKey.Dispose()
}
