@echo off
rem 本文件必须保存为 GBK(ANSI) 编码。
rem 早期版本是 UTF-8 无 BOM 并在第二行 chcp 65001，cmd 逐行读取时
rem 切换代码页会导致后续行的字节偏移错乱，中文路径被撕碎，cd 与
rem powershell 调用全部失败。同时原先的边框与图标使用了 GBK 不支持
rem 的字符，这里统一改为 ASCII 边框。
title 小宋编导工作台 - 开发控制面板
color 0B
cd /d "%~dp0"

:MENU
cls
echo ========================================================
echo             小宋编导工作台 - 开发控制面板
echo ========================================================
echo.
echo   项目路径: %~dp0
echo.
echo   [1] 启动本地开发环境
echo   [2] 停止开发服务器
echo   [3] 检查项目状态
echo   [4] 构建测试(部署前检查)
echo   [5] 同步到腾讯云服务器
echo   [6] 查看使用说明
echo   [7] 打开项目文件夹
echo   [8] 访问本地开发站点
echo   [0] 退出
echo.
echo ========================================================
echo.
set /p choice=请选择操作 [0-8]:

if "%choice%"=="1" goto START_DEV
if "%choice%"=="2" goto STOP_DEV
if "%choice%"=="3" goto CHECK_STATUS
if "%choice%"=="4" goto BUILD_TEST
if "%choice%"=="5" goto SYNC_SERVER
if "%choice%"=="6" goto VIEW_HELP
if "%choice%"=="7" goto OPEN_FOLDER
if "%choice%"=="8" goto OPEN_BROWSER
if "%choice%"=="0" goto EXIT

echo 无效选择，请重新输入
timeout /t 2 >nul
goto MENU

:START_DEV
cls
echo 正在启动本地开发环境...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0启动本地开发.ps1"
goto MENU

:STOP_DEV
cls
echo 正在停止开发服务器...
call "%~dp0停止开发服务器.bat"
goto MENU

:CHECK_STATUS
cls
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0检查项目状态.ps1"
goto MENU

:BUILD_TEST
cls
echo 正在运行构建测试...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0构建测试.ps1"
goto MENU

:SYNC_SERVER
cls
echo 正在同步到服务器...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0同步到服务器.ps1"
goto MENU

:VIEW_HELP
cls
start "" "%~dp0快捷启动说明.md"
echo 已打开使用说明文档
timeout /t 2 >nul
goto MENU

:OPEN_FOLDER
cls
explorer "%~dp0."
echo 已打开项目文件夹
timeout /t 1 >nul
goto MENU

:OPEN_BROWSER
cls
start "" "http://localhost:3000"
echo 已打开浏览器访问 http://localhost:3000
echo 请确保开发服务器已启动
timeout /t 2 >nul
goto MENU

:EXIT
cls
echo 感谢使用！再见！
timeout /t 1 >nul
exit
