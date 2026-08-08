@echo off
chcp 65001 > nul
echo ========================================
echo  重启开发服务器 - 查看新版本
echo ========================================
echo.

echo [1/2] 正在停止旧服务器...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak > nul
echo ? 已停止

echo.
echo [2/2] 启动新服务器...
echo.
cd /d "%~dp0"
start "小宋编导工作台" cmd /k "npm run dev"

echo.
echo ========================================
echo  服务器正在启动...
echo  等待 5-10 秒后访问：
echo  http://localhost:3000
echo ========================================
echo.
timeout /t 3 /nobreak > nul

start http://localhost:3000

echo 完成！浏览器将自动打开
pause
