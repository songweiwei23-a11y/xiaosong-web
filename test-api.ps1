# Dify API 测试脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 小宋编导工作台 - API 配置测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 .env.local
if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "DIFY_API_KEY=app-[a-zA-Z0-9-]+") {
        Write-Host "✓ 找到 .env.local 文件" -ForegroundColor Green
        Write-Host "✓ 已配置 Dify API Key" -ForegroundColor Green
        
        # 提取 API Key
        if ($envContent -match "DIFY_API_KEY=(.+)") {
            $apiKey = $Matches[1].Trim()
            if ($apiKey -eq "你的Dify_API密钥") {
                Write-Host "⚠ API Key 还是模板值，需要替换为真实密钥" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "请按以下步骤获取真实的 Dify API Key：" -ForegroundColor White
                Write-Host "1. 登录 Dify: https://dify.ai" -ForegroundColor White
                Write-Host "2. 打开你的「小宋编导文案工作台」应用" -ForegroundColor White
                Write-Host "3. 点击右上角「发布」→「API 访问」" -ForegroundColor White
                Write-Host "4. 复制 API Key（格式: app-xxxxx）" -ForegroundColor White
                Write-Host "5. 粘贴到 .env.local 的 DIFY_API_KEY= 后面" -ForegroundColor White
                Write-Host ""
                Read-Host "配置完成后按回车继续"
                return
            } else {
                Write-Host "✓ API Key 格式正确" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "⚠ 未找到有效的 Dify API Key" -ForegroundColor Yellow
        Write-Host "请编辑 .env.local 文件，添加你的 Dify API Key" -ForegroundColor Yellow
        return
    }
} else {
    Write-Host "✗ 未找到 .env.local 文件" -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "正在测试 API 连接..." -ForegroundColor Cyan

# 测试 API
$testRequest = @{
    taskType = "脚本生成"
    topic = "API测试"
    platform = "抖音"
    duration = "60秒"
    style = "专业"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/dify/stream" -Method POST -Body $testRequest -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ API 测试成功" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*Unable to connect*") {
        Write-Host "⚠ 开发服务器未运行" -ForegroundColor Yellow
        Write-Host "请先运行: npm run dev" -ForegroundColor Yellow
    } else {
        Write-Host "✗ API 测试失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 下一步：启动开发服务器" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "运行命令:" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor Green
Write-Host ""
Write-Host "然后浏览器访问:" -ForegroundColor White
Write-Host "  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""