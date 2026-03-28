# Void 项目依赖下载问题 - 最终解决方案

## 📋 问题概述

Void 项目是基于 VS Code 的开源 AI 编辑器，在 Windows 平台上使用 `npm install` 安装依赖时遇到以下问题：

1. **依赖下载失败或超时** - 原生模块（C++ 模块）需要编译
2. **Visual Studio 2022 要求** - node-gyp 需要 MSVC 编译器
3. **网络访问问题** - 部分资源需要从 GitHub/Electron 官方下载

## 🔍 根本原因

### 原生模块需要编译
Void 项目依赖以下需要编译的原生模块：

| 模块名 | 用途 | 编译工具 |
|--------|------|----------|
| `@vscode/sqlite3` | 本地数据库 | node-pre-gyp |
| `@vscode/spdlog` | 日志记录 | node-pre-gyp |
| `node-pty` | 终端功能 | node-gyp |
| `kerberos` | 认证功能 | node-gyp |
| `native-keymap` | 键盘映射 | node-gyp |
| `native-watchdog` | 进程监控 | node-gyp |

### 问题发生流程
```
npm install
  ↓
检测到原生模块
  ↓
尝试下载预编译二进制
  ↓
下载失败/不存在 → 触发本地编译
  ↓
node-gyp 需要 Python + Visual Studio C++ 编译器
  ↓
Windows 上未安装 VS2022 → 编译失败
```

## ✅ 已实施的解决方案

### 1. 更新 .npmrc 配置

**文件**: `.npmrc`

```ini
# npm 镜像（国内）
registry=https://registry.npmmirror.com

# Electron 配置
disturl=https://electronjs.org/headers
target="34.3.2"
ms_build_id="11161073"
runtime="electron"
legacy-peer-deps=true
timeout=180000

# 使用预编译的 Electron 二进制
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/

# 使用预编译的原生模块
node_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/
spdlog_binary_host_mirror=https://npmmirror.com/mirrors/
node_pty_binary_host_mirror=https://npmmirror.com/mirrors/

# 其他原生模块镜像（可选）
# native_keymap_binary_host_mirror=https://npmmirror.com/mirrors/
# native_watchdog_binary_host_mirror=https://npmmirror.com/mirrors/
# kerberos_binary_host_mirror=https://npmmirror.com/mirrors/
```

**关键修复**:
- ✅ 移除 `disturl` 的引号（格式错误）
- ✅ 添加国内 npm 镜像 `registry=https://registry.npmmirror.com`
- ✅ 添加 `spdlog` 镜像配置

### 2. 更新 .gitignore

**文件**: `.gitignore`

```gitignore
# 原版本二进制文件（不需要提交到git）
原版本exe/
VoidSetup-x64-*.exe

# 临时分析文档和脚本
temp_*.md
temp_*.py
temp_*.json
temp_*.txt

# 包含敏感信息的文档
文档/聚合API 接口对接.Apifox.json

# GitHub workflows (需要特殊权限)
.github/workflows/
```

## 🚀 分步下载方案（推荐）

为避免等待时间过长和一次性失败，建议按以下顺序分步安装：

### 第一步：安装 Electron 相关依赖（最快）

```bash
# 使用国内镜像快速安装 Electron
echo "步骤 1/4: 安装 Electron..."
npm install electron@34.3.2 --save-dev --registry=https://registry.npmmirror.com
```

### 第二步：安装最可能失败的预编译原生模块

```bash
# 单独安装最容易出问题的原生模块（使用国内镜像）
echo "步骤 2/4: 安装预编译原生模块..."

# sqlite3 - 数据库模块
npm install @vscode/sqlite3@5.1.8-vscode --save --registry=https://registry.npmmirror.com

# spdlog - 日志模块
npm install @vscode/spdlog@^0.15.0 --save --registry=https://registry.npmmirror.com

# node-pty - 终端模块
npm install node-pty@^1.1.0-beta33 --save --registry=https://registry.npmmirror.com
```

### 第三步：安装其他原生模块

```bash
# 安装其他需要编译的模块
echo "步骤 3/4: 安装其他原生模块..."
npm install kerberos@2.1.1 --save --registry=https://registry.npmmirror.com
npm install native-keymap@^3.3.5 --save --registry=https://registry.npmmirror.com
npm install native-watchdog@^1.4.1 --save --registry=https://registry.npmmirror.com
npm install native-is-elevated@0.7.0 --save --registry=https://registry.npmmirror.com
npm install @vscode/ripgrep@^1.15.11 --save --registry=https://registry.npmmirror.com
```

### 第四步：安装剩余依赖

```bash
# 最后安装所有剩余依赖
echo "步骤 4/4: 安装剩余依赖..."
npm install --legacy-peer-deps --registry=https://registry.npmmirror.com
```

## 📊 依赖安装优先级表

| 优先级 | 模块 | 难度 | 说明 |
|--------|------|------|------|
| 1 | electron | ⭐ 低 | 有国内镜像，下载快 |
| 2 | @vscode/sqlite3 | ⭐⭐ 中 | 有预编译二进制 |
| 3 | @vscode/spdlog | ⭐⭐ 中 | 有预编译二进制 |
| 4 | node-pty | ⭐⭐⭐ 中高 | Windows 上可能需编译 |
| 5 | kerberos | ⭐⭐⭐ 中高 | 可能需要编译 |
| 6 | native-keymap | ⭐⭐⭐⭐ 高 | 通常需要编译 |
| 7 | 其他依赖 | ⭐⭐ 中 | 大部分纯 JS |

## 🔧 完整安装脚本

创建 `install-deps.bat` 文件：

```batch
@echo off
chcp 65001
setlocal EnableDelayedExpansion

echo ========================================
echo Void 项目依赖分步安装脚本
echo ========================================
echo.

REM 检查 Node.js 版本
echo [检查] Node.js 版本...
node --version
if %errorlevel% neq 0 (
    echo [错误] Node.js 未安装！请先安装 Node.js v20.x
    exit /b 1
)

REM 步骤 1: Electron
echo.
echo [步骤 1/4] 安装 Electron...
npm install electron@34.3.2 --save-dev --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 (
    echo [警告] Electron 安装失败，继续尝试...
)

REM 步骤 2: 核心原生模块
echo.
echo [步骤 2/4] 安装核心原生模块...
npm install @vscode/sqlite3@5.1.8-vscode --save --registry=https://registry.npmmirror.com
npm install @vscode/spdlog@^0.15.0 --save --registry=https://registry.npmmirror.com
npm install node-pty@^1.1.0-beta33 --save --registry=https://registry.npmmirror.com

REM 步骤 3: 其他原生模块
echo.
echo [步骤 3/4] 安装其他原生模块...
npm install kerberos@2.1.1 --save --registry=https://registry.npmmirror.com
npm install native-keymap@^3.3.5 --save --registry=https://registry.npmmirror.com
npm install native-watchdog@^1.4.1 --save --registry=https://registry.npmmirror.com

REM 步骤 4: 剩余依赖
echo.
echo [步骤 4/4] 安装剩余依赖...
npm install --legacy-peer-deps --registry=https://registry.npmmirror.com

echo.
echo ========================================
echo 安装完成！
echo 如果有模块安装失败，请查看上方错误信息
echo ========================================
pause
```

## 💡 VS2022 的作用说明

### 什么时候需要 VS2022？

| 场景 | 是否需要 VS2022 | 说明 |
|------|-----------------|------|
| 运行开发服务器 | ❌ 不需要 | 使用预编译二进制 |
| 开发调试 | ❌ 不需要 | 同上 |
| 打包成 exe | ⚠️ 可能需要 | 如果需要重新编译 |
| 原生模块编译失败 | ✅ 需要 | 作为后备方案 |

### 结论
**使用预编译二进制配置后，大多数情况下不需要安装 VS2022**

## 🆘 故障排除

### 问题 1: 某个模块始终安装失败

**解决方案**: 跳过该模块的编译脚本
```bash
npm install <module-name> --ignore-scripts
```

### 问题 2: 网络超时

**解决方案**: 增加超时时间
```bash
npm install --fetch-timeout=600000 --fetch-retries=5
```

### 问题 3: 需要强制重新编译

**解决方案**:
```bash
npm rebuild
# 或
npm install --build-from-source
```

## 📁 相关文件清单

- `.npmrc` - npm 配置（已修复）
- `.gitignore` - Git 忽略配置（已更新）
- `package.json` - 项目依赖定义
- `temp_测试预编译二进制配置.py` - 配置测试脚本

## ✅ 验证配置

运行以下命令验证配置是否正确：

```bash
# 查看 npm 配置
npm config list

# 查看 .npmrc 中的特定配置
npm config get registry
npm config get electron_mirror
npm config get disturl
```

## 📝 总结

1. **主要问题**: 原生模块需要编译 → 需要 VS2022
2. **解决方案**: 配置国内预编译二进制镜像
3. **推荐安装方式**: 分步安装，先易后难
4. **VS2022**: 预编译配置下通常不需要

## 🔗 参考链接

- Void 项目: https://github.com/voideditor/void
- 预编译二进制镜像: https://npmmirror.com/mirrors/
- node-gyp 文档: https://github.com/nodejs/node-gyp
- Electron 镜像: https://npmmirror.com/mirrors/electron/

---

**文档生成时间**: 2025-03-28
**适用版本**: Void 1.99.30044 / VS Code 1.99.x / Electron 34.3.2
