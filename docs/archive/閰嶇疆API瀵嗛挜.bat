@echo off
chcp 65001 > nul
color 0B
echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║          ?? Dify API Key 配置助手                     ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.
echo.
echo 【步骤 1】获取 Dify API Key
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 1. 正在打开 Dify 网站...
start https://dify.ai
timeout /t 2 /nobreak > nul
echo.
echo 2. 请在浏览器中：
echo    ? 登录你的 Dify 账号
echo    ? 找到「小宋编导文案工作台」应用
echo    ? 点击右上角「发布」→「API 访问」
echo    ? 复制 API Key（格式: app-xxxxx）
echo.
echo.
pause
echo.
echo.
echo 【步骤 2】输入 API Key
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
set /p apikey="请粘贴你的 API Key: "
echo.

if "%apikey%"=="" (
    echo ? 错误：API Key 不能为空！
    pause
    exit /b 1
)

if not "%apikey:~0,4%"=="app-" (
    echo ??  警告：API Key 格式可能不正确（应该以 app- 开头）
    echo.
    set /p continue="是否继续？(Y/N): "
    if /i not "%continue%"=="Y" exit /b 1
)

echo.
echo 【步骤 3】保存配置
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0"

if not exist ".env.local" (
    echo ? 错误：找不到 .env.local 文件！
    pause
    exit /b 1
)

:: 备份原文件
copy .env.local .env.local.backup > nul 2>&1

:: 更新 API Key
powershell -Command "(Get-Content .env.local) -replace 'DIFY_API_KEY=.*', 'DIFY_API_KEY=%apikey%' | Set-Content .env.local"

echo ? API Key 已保存
echo ? 原文件已备份为 .env.local.backup
echo.
echo.
echo 【步骤 4】验证配置
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

findstr "DIFY_API_KEY" .env.local
echo.
echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║          ? 配置完成！                                ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.
echo 下一步：
echo   1. 重启开发服务器
echo   2. 访问 http://localhost:3000
echo   3. 测试任意功能
echo.
pause
