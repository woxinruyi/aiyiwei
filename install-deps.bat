@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ========================================
echo Void 项目依赖分步安装脚本
echo ========================================
echo.

REM 检查 Node.js 版本
echo [检查] Node.js 版本...
for /f "tokens=*" %%a in ('node --version 2^>^&1') do set NODE_VERSION=%%a
if "%NODE_VERSION%"=="" (
    echo [错误] Node.js 未安装！请先安装 Node.js v20.x
    echo 下载地址: https://nodejs.org/
    exit /b 1
)
echo [OK] Node.js %NODE_VERSION%

REM 检查 npm
echo [检查] npm 版本...
for /f "tokens=*" %%a in ('npm --version 2^>^&1') do set NPM_VERSION=%%a
echo [OK] npm v%NPM_VERSION%

echo.
echo ========================================
echo 开始分步安装依赖
echo ========================================

REM 步骤 1: Electron
echo.
echo [步骤 1/4] 安装 Electron... (使用国内镜像)
npm install electron@34.3.2 --save-dev --registry=https://registry.npmmirror.com --timeout=180000
if %errorlevel% neq 0 (
    echo [警告] Electron 安装遇到问题
    echo 尝试使用官方镜像...
    npm install electron@34.3.2 --save-dev --timeout=300000
)

REM 步骤 2: 核心原生模块
echo.
echo [步骤 2/4] 安装核心原生模块... (最容易出问题)
echo.

echo - 安装 @vscode/sqlite3...
npm install @vscode/sqlite3@5.1.8-vscode --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] sqlite3 安装可能失败

echo.
echo - 安装 @vscode/spdlog...
npm install @vscode/spdlog@^0.15.0 --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] spdlog 安装可能失败

echo.
echo - 安装 node-pty...
npm install node-pty@^1.1.0-beta33 --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] node-pty 安装可能失败

REM 步骤 3: 其他原生模块
echo.
echo [步骤 3/4] 安装其他原生模块...
echo.

echo - 安装 kerberos...
npm install kerberos@2.1.1 --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] kerberos 安装可能失败

echo.
echo - 安装 native-keymap...
npm install native-keymap@^3.3.5 --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] native-keymap 安装可能失败

echo.
echo - 安装 native-watchdog...
npm install native-watchdog@^1.4.1 --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] native-watchdog 安装可能失败

echo.
echo - 安装 native-is-elevated...
npm install native-is-elevated@0.7.0 --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] native-is-elevated 安装可能失败

echo.
echo - 安装 @vscode/ripgrep...
npm install @vscode/ripgrep@^1.15.11 --save --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 echo [警告] ripgrep 安装可能失败

REM 步骤 4: 剩余依赖
echo.
echo [步骤 4/4] 安装剩余依赖...
echo 这可能需要几分钟，请耐心等待...
npm install --legacy-peer-deps --registry=https://registry.npmmirror.com --timeout=300000

REM 完成
echo.
echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 说明:
echo - 如果某些模块显示 [警告]，可能已使用预编译二进制或安装失败
echo - 可以使用以下命令检查安装状态:
echo   npm list --depth=0
echo.
echo - 如果发现某个模块确实安装失败，可以单独安装:
echo   npm install ^<模块名^> --ignore-scripts
echo.
echo - 如需强制重新编译:
echo   npm rebuild
echo.

pause
