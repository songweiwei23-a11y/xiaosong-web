@echo off
chcp 65001 > nul
echo ========================================
echo  小宋编导工作台 - 自动安装脚本
echo ========================================
echo.

echo [1/4] 检查 Node.js...
where node > nul 2>&1
if %errorlevel% equ 0 (
    echo ? Node.js 已安装
    node --version
    npm --version
    goto :install_deps
) else (
    echo ? Node.js 未安装
    echo.
    echo 请按照以下步骤安装 Node.js:
    echo 1. 访问 https://nodejs.org/zh-cn
    echo 2. 下载 LTS 版本
    echo 3. 运行安装程序
    echo 4. 安装完成后重新运行此脚本
    echo.
    echo 正在打开下载页面...
    start https://nodejs.org/zh-cn
    pause
    exit /b 1
)

:install_deps
echo.
echo [2/4] 安装项目依赖...
echo 这可能需要 5-10 分钟，请耐心等待...
echo.

cd /d "%~dp0"
call npm install

if %errorlevel% neq 0 (
    echo.
    echo ? 依赖安装失败
    echo.
    echo 尝试使用国内镜像...
    call npm config set registry https://registry.npmmirror.com
    call npm install
    
    if %errorlevel% neq 0 (
        echo ? 依赖安装仍然失败
        echo 请检查网络连接或手动运行: npm install
        pause
        exit /b 1
    )
)

echo ? 依赖安装完成

:check_env
echo.
echo [3/4] 检查环境变量...
if exist ".env.local" (
    findstr /C:"app-" .env.local > nul 2>&1
    if %errorlevel% equ 0 (
        echo ? 环境变量已配置
        goto :start_dev
    ) else (
        echo ? 请配置 Dify API 密钥
        echo 编辑 .env.local 文件，填入你的 DIFY_API_KEY
        echo.
        notepad .env.local
        goto :check_env
    )
) else (
    echo ? .env.local 文件不存在
    pause
    exit /b 1
)

:start_dev
echo.
echo [4/4] 启动开发服务器...
echo.
echo ========================================
echo  项目启动成功！
echo  访问: http://localhost:3000
echo  按 Ctrl+C 停止服务器
echo ========================================
echo.

call npm run dev

pause
