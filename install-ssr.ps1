# 安装 @supabase/ssr 包
cd "C:\Users\30430\Desktop\编导知识大全\小宋\xiaosong-web"

Write-Host "正在安装 @supabase/ssr 包..." -ForegroundColor Green

# 查找 npm 路径
$npmPath = Get-Command npm -ErrorAction SilentlyContinue

if ($npmPath) {
    & npm install @supabase/ssr
    Write-Host "`n安装完成！现在可以重启服务器了" -ForegroundColor Green
} else {
    Write-Host "找不到 npm 命令。请确保 Node.js 已安装并添加到系统环境变量中。" -ForegroundColor Red
}
