@echo off
chcp 65001 > nul
color 0A
echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║          ?? 自动修复 404 问题                         ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

echo [1/3] 停止旧服务器...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak > nul
echo ? 完成
echo.

echo [2/3] 启动新服务器...
cd /d "%~dp0"
start "编导工作台服务器" cmd /k "npm run dev"
echo ? 服务器正在启动...
echo.

echo [3/3] 等待服务器准备就绪...
timeout /t 8 /nobreak > nul
echo ? 完成
echo.

echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║          ? 修复完成！正在打开浏览器...               ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

start http://localhost:3000
echo.
echo 浏览器已打开，请查看页面是否正常！
echo.
echo 如果看到：
echo   ? 首页有"3秒生成专业级短视频脚本"
echo   ? 点击"进入工作台"能看到左侧导航栏
echo.
echo 那就说明 404 问题已完全解决！
echo.
pause
