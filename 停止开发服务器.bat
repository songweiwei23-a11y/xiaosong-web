@echo off
chcp 65001 >nul
title 停止开发服务器
echo ========================================
echo    停止小宋编导工作台开发服务器
echo ========================================
echo.
echo 正在查找 Node.js 进程...
echo.

tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo 找到 Node.js 进程，正在停止...
    taskkill /F /IM node.exe /T >NUL 2>&1
    echo ✓ Node.js 进程已停止
) else (
    echo ℹ 没有运行中的 Node.js 进程
)

echo.
echo 完成！
timeout /t 3 >nul
