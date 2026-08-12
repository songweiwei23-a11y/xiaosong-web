# 邀请码功能测试脚本

Write-Host "==== 小宋编导工作台 - 邀请码功能测试 ====" -ForegroundColor Cyan
Write-Host ""

# 1. 测试验证邀请码API (使用初始生成的邀请码之一)
Write-Host "1. 测试邀请码验证API..." -ForegroundColor Yellow
$validatePayload = @{
    code = "XS-ABC123"
} | ConvertTo-Json

try {
    $validateResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/invitation/validate" -Method POST -Body $validatePayload -ContentType "application/json"
    Write-Host "✓ 验证API响应: $($validateResponse | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "✗ 验证API失败: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==== 测试完成 ====" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作建议:" -ForegroundColor Yellow
Write-Host "1. 在浏览器中打开 http://localhost:3000/login" -ForegroundColor White
Write-Host "2. 点击'注册'标签" -ForegroundColor White
Write-Host "3. 输入测试邮箱、密码和邀请码（数据库中已有的）" -ForegroundColor White
Write-Host "4. 测试注册流程是否正常" -ForegroundColor White
Write-Host ""
Write-Host "提示：可以在Supabase Dashboard中查看invitation_codes表获取有效邀请码" -ForegroundColor Cyan
