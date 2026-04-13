#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VS2022 Spectre 缓解库自动安装脚本
自动检测并安装 VS2022 所需的 Spectre 缓解库组件
"""

import subprocess
import sys
import os
import json
import winreg
from pathlib import Path


class VS2022SpectreInstaller:
    """VS2022 Spectre 缓解库安装器"""

    # 需要安装的组件 ID
    REQUIRED_COMPONENTS = [
        "Microsoft.VisualStudio.Workload.VCTools",  # C++ 生成工具
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",  # MSVC v143
        "Microsoft.VisualStudio.Component.VC.ATL.Spectre",  # ATL Spectre 缓解库 x86/x64
        "Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre",  # MFC Spectre 缓解库 x86/x64
        "Microsoft.VisualStudio.Component.Windows11SDK.22621",  # Windows 11 SDK
        "Microsoft.VisualStudio.Component.VC.CoreBuildTools",  # C++ 核心生成工具
        "Microsoft.VisualStudio.Component.VC.Redist.14.Latest",  # C++ 2022 Redistributable
    ]

    # Spectre 特定组件 - 基于 Microsoft 官方文档
    # 参考: https://learn.microsoft.com/en-us/visualstudio/msbuild/errors/msb8040
    # 正确的组件 ID 格式（经 vswhere 验证）
    SPECTRE_COMPONENTS = [
        # 主要 Spectre 缓解库 - MSVC v143 VS2022
        # 格式: Microsoft.VisualStudio.Component.VC.14.<minor>.<build>.<arch>.Spectre
        "Microsoft.VisualStudio.Component.VC.14.38.17.8.x86.x64.Spectre",
        "Microsoft.VisualStudio.Component.VC.14.39.17.9.x86.x64.Spectre",
        # ATL/MFC Spectre 库
        "Microsoft.VisualStudio.Component.VC.ATL.Spectre",
        "Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre",
    ]

    # 备选：如果上述组件不存在，使用以下通用组件
    FALLBACK_COMPONENTS = [
        "Microsoft.VisualStudio.ComponentGroup.VC.v143.x86.x64.Spectre",
        "Microsoft.VisualStudio.Component.VC.14.x86.x64.Spectre",
    ]

    def __init__(self):
        self.vs_installer_path = None
        self.vs_instance = None

    def find_vs_installer(self):
        """查找 VS Installer 路径"""
        # 常见安装路径
        possible_paths = [
            r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe",
            r"C:\Program Files\Microsoft Visual Studio\Installer\vs_installer.exe",
        ]

        # 从环境变量查找
        vs_path = os.environ.get('VSINSTALLER_PATH')
        if vs_path:
            possible_paths.insert(0, vs_path)

        for path in possible_paths:
            if os.path.exists(path):
                self.vs_installer_path = path
                print(f"✅ 找到 VS Installer: {path}")
                return True

        print("❌ 未找到 VS Installer")
        return False

    def find_vs_instances(self):
        """查找已安装的 VS2022 实例"""
        try:
            # 使用 vswhere 查找 VS 实例
            vswhere_paths = [
                r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe",
                r"C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe",
            ]

            vswhere = None
            for path in vswhere_paths:
                if os.path.exists(path):
                    vswhere = path
                    break

            if not vswhere:
                print("❌ 未找到 vswhere.exe")
                return []

            # 运行 vswhere 获取 VS 实例
            cmd = [
                vswhere,
                "-products", "*",
                "-format", "json",
                "-prerelease",
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore'
            )

            if result.returncode == 0:
                instances = json.loads(result.stdout)
                vs2022_instances = [
                    inst for inst in instances
                    if inst.get('installationVersion', '').startswith('17.')  # VS2022 = 17.x
                ]
                return vs2022_instances
            else:
                print(f"vswhere 执行失败: {result.stderr}")
                return []

        except Exception as e:
            print(f"查找 VS 实例时出错: {e}")
            return []

    def check_component_installed(self, instance_path, component_id):
        """检查组件是否已安装"""
        try:
            # 读取 installationState.json
            state_file = Path(instance_path) / "installationState.json"
            if not state_file.exists():
                return False

            with open(state_file, 'r', encoding='utf-8') as f:
                state = json.load(f)

            installed_components = state.get('selectedPackages', [])
            return any(component_id in pkg for pkg in installed_components)

        except Exception as e:
            print(f"检查组件状态时出错: {e}")
            return False

    def install_components(self, instance_path):
        """安装缺失的组件"""
        if not self.vs_installer_path:
            print("❌ VS Installer 未找到，无法安装组件")
            return False

        print("\n📦 开始安装 Spectre 缓解库组件...")
        print(f"目标实例: {instance_path}")
        print("需要安装的组件:")
        all_components = self.REQUIRED_COMPONENTS + self.SPECTRE_COMPONENTS
        for comp in all_components:
            print(f"  - {comp}")
        print()

        # 构建安装命令
        cmd = [
            self.vs_installer_path,
            "modify",
            "--installPath", instance_path,
            "--quiet",  # 静默安装
            "--norestart",  # 不重启
        ]

        # 添加组件
        for component in self.REQUIRED_COMPONENTS + self.SPECTRE_COMPONENTS:
            cmd.extend(["--add", component])

        print(f"执行命令: {' '.join(cmd)}")
        print("\n⏳ 安装进行中，这可能需要几分钟...")
        print("请耐心等待，不要关闭窗口...")
        print()

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore',
                timeout=1800  # 30 分钟超时
            )

            if result.returncode == 0:
                print("✅ 组件安装成功！")
                return True
            else:
                print(f"❌ 安装失败 (退出码: {result.returncode})")
                if result.stderr:
                    print(f"错误信息: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            print("❌ 安装超时（超过30分钟）")
            return False
        except Exception as e:
            print(f"❌ 安装过程中出错: {e}")
            return False

    def get_install_command(self):
        """获取手动安装命令（当自动安装不可用时）"""
        cmd_parts = ["vs_buildtools.exe" if "BuildTools" in str(self.vs_instance) else "vs_installer.exe"]
        cmd_parts.append("modify")

        if self.vs_instance:
            cmd_parts.extend(["--installPath", self.vs_instance.get('installationPath', '')])

        cmd_parts.extend(["--quiet", "--norestart"])

        for component in self.REQUIRED_COMPONENTS + self.SPECTRE_COMPONENTS:
            cmd_parts.extend(["--add", component])

        return ' '.join(cmd_parts)

    def run(self):
        """主运行流程"""
        print("=" * 60)
        print("VS2022 Spectre 缓解库自动安装脚本")
        print("=" * 60)
        print()

        # 1. 查找 VS Installer
        if not self.find_vs_installer():
            print("\n⚠️ 未找到 VS Installer，尝试使用手动安装方式...")
            print("\n请使用以下命令手动安装:")
            print(self.get_install_command())
            return False

        # 2. 查找 VS2022 实例
        print("\n🔍 查找 VS2022 安装实例...")
        instances = self.find_vs_instances()

        if not instances:
            print("❌ 未找到 VS2022 安装实例")
            print("\n请先安装 VS2022 BuildTools 或 Community 版本:")
            print("下载地址: https://visualstudio.microsoft.com/downloads/")
            return False

        print(f"✅ 找到 {len(instances)} 个 VS2022 实例:")
        for i, inst in enumerate(instances, 1):
            print(f"  {i}. {inst.get('displayName', 'Unknown')}")
            print(f"     路径: {inst.get('installationPath', 'N/A')}")
            print(f"     版本: {inst.get('installationVersion', 'N/A')}")
            print()

        # 使用第一个实例
        self.vs_instance = instances[0]
        instance_path = self.vs_instance.get('installationPath')

        # 3. 检查组件是否已安装
        print("🔍 检查 Spectre 缓解库组件状态...")
        missing_components = []

        for component in self.REQUIRED_COMPONENTS + self.SPECTRE_COMPONENTS:
            if self.check_component_installed(instance_path, component):
                print(f"  ✅ {component} - 已安装")
            else:
                print(f"  ❌ {component} - 未安装")
                missing_components.append(component)

        if not missing_components:
            print("\n✅ 所有必需的组件都已安装！")
            return True

        print(f"\n⚠️ 发现 {len(missing_components)} 个缺失的组件")
        print()

        # 4. 询问是否安装
        response = input("是否自动安装这些组件? (y/n): ").strip().lower()
        if response not in ['y', 'yes', '是']:
            print("\n手动安装命令:")
            print(self.get_install_command())
            return False

        # 5. 执行安装
        return self.install_components(instance_path)


def main():
    """主函数"""
    installer = VS2022SpectreInstaller()
    success = installer.run()

    print("\n" + "=" * 60)
    if success:
        print("🎉 Spectre 缓解库安装完成！")
        print("现在可以重新运行: npm install")
    else:
        print("⚠️ 自动安装未完成")
        print("\n备选方案:")
        print("1. 打开 Visual Studio Installer")
        print("2. 点击 '修改' VS2022")
        print("3. 切换到 '单个组件' 选项卡")
        print("4. 搜索 'Spectre' 并安装以下组件:")
        print("   - 适用于最新 v143 生成工具的 C++ Spectre 缓解库")
        print("   - MSVC v143 - VS 2022 C++ x64/x86 生成工具")
        print("   - Windows 11 SDK")
    print("=" * 60)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
