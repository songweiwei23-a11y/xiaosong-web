# PowerShell 脚本：为所有 API 路由添加超时设置
# 使用方法: .\add-api-timeouts.ps1

Write-Host "开始为 API 路由添加超时设置..." -ForegroundColor Cyan
Write-Host ""

$routes = Get-ChildItem -Path "app/api" -Recurse -Filter "route.ts"
$addedCount = 0
$skippedCount = 0
$totalCount = $routes.Count

foreach ($route in $routes) {
  $relativePath = $route.FullName.Replace((Get-Location).Path + "\", "")
  $content = Get-Content $route.FullName -Raw
  
  # 检查是否已有 maxDuration
  if ($content -match "export const maxDuration") {
    Write-Host "跳过 (已设置): $relativePath" -ForegroundColor Gray
    $skippedCount++
    continue
  }
  
  # 根据文件路径判断合适的超时值
  $timeout = 30  # 默认 30 秒
  
  # AI 生成相关 - 60 秒
  if ($relativePath -match "dify|generate|script|positioning|topic|creative-brief") {
    $timeout = 60
  }
  
  # 批量操作 - 120 秒
  if ($relativePath -match "batch|bulk|import") {
    $timeout = 120
  }
  
  # 文件上传 - 120 秒
  if ($relativePath -match "upload|file") {
    $timeout = 120
  }
  
  # 简单查询 - 10 秒
  if ($relativePath -match "list|get|fetch" -and $relativePath -notmatch "history") {
    $timeout = 10
  }
  
  # 在文件开头添加超时设置
  $newContent = "export const maxDuration = $timeout;`n`n" + $content
  
  Set-Content $route.FullName $newContent -NoNewline
  Write-Host "已添加 (${timeout}s): $relativePath" -ForegroundColor Green
  $addedCount++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "总计: $totalCount 个 API 路由" -ForegroundColor White
Write-Host "已添加: $addedCount 个" -ForegroundColor Green
Write-Host "已跳过: $skippedCount 个" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "完成！现在请运行测试验证：" -ForegroundColor Yellow
Write-Host "  npm run type-check"
Write-Host "  npm run test"
