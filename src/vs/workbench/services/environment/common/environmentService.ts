/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作台环境服务接口】
 *  本文件定义工作台层的环境服务接口，扩展平台层环境服务，提供工作台特定的配置：
 *
 *  【核心职责】
 *  1. 定义工作台特定的环境配置
 *  2. 提供日志文件路径（logFile、windowLogsPath、extHostLogsPath）
 *  3. 支持扩展 API 启用配置（extensionEnabledProposedApi）
 *  4. 提供远程开发配置（remoteAuthority）
 *  5. 支持启动行为配置（skipWelcome、skipReleaseNotes）
 *
 *  【环境配置分类】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Paths - 路径配置                                       │
 *  │  - logFile: 主日志文件                                   │
 *  │  - windowLogsPath: 窗口日志目录                          │
 *  │  - extHostLogsPath: 扩展主机日志目录                     │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Extensions - 扩展配置                                  │
 *  │  - extensionEnabledProposedApi: 启用的实验性 API          │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Config - 应用配置                                      │
 *  │  - remoteAuthority: 远程服务器地址                       │
 *  │  - skipWelcome: 跳过欢迎页面                             │
 *  │  - disableWorkspaceTrust: 禁用工作区信任                 │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Development - 开发配置                                   │
 *  │  - debugRenderer: 调试渲染进程                           │
 *  │  - logExtensionHostCommunication: 记录扩展主机通信       │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Editors - 编辑器启动配置                               │
 *  │  - filesToOpenOrCreate: 启动时打开的文件                   │
 *  │  - filesToDiff: 启动时对比的文件                         │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【设计原则】
 *  - 保持接口最小化（KEEP THIS INTERFACE AS SMALL AS POSSIBLE）
 *  - 非 Web 属性应放入 Native Workbench Environment Service
 *
 *  【与 IEnvironmentService 的关系】
 *  - 继承自平台层的 IEnvironmentService
 *  - 使用 refineServiceDecorator 扩展接口
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IPath } from '../../../../platform/window/common/window.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { URI } from '../../../../base/common/uri.js';

export const IWorkbenchEnvironmentService = refineServiceDecorator<IEnvironmentService, IWorkbenchEnvironmentService>(IEnvironmentService);

/**
 * A workbench specific environment service that is only present in workbench
 * layer.
 */
export interface IWorkbenchEnvironmentService extends IEnvironmentService {

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	// NOTE: KEEP THIS INTERFACE AS SMALL AS POSSIBLE. AS SUCH:
	//       PUT NON-WEB PROPERTIES INTO THE NATIVE WORKBENCH
	//       ENVIRONMENT SERVICE
	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

	// --- Paths
	readonly logFile: URI;
	readonly windowLogsPath: URI;
	readonly extHostLogsPath: URI;

	// --- Extensions
	readonly extensionEnabledProposedApi?: string[];

	// --- Config
	readonly remoteAuthority?: string;
	readonly skipReleaseNotes: boolean;
	readonly skipWelcome: boolean;
	readonly disableWorkspaceTrust: boolean;
	readonly webviewExternalEndpoint: string;

	// --- Development
	readonly debugRenderer: boolean;
	readonly logExtensionHostCommunication?: boolean;
	readonly enableSmokeTestDriver?: boolean;
	readonly profDurationMarkers?: string[];

	// --- Editors to open
	readonly filesToOpenOrCreate?: IPath[] | undefined;
	readonly filesToDiff?: IPath[] | undefined;
	readonly filesToMerge?: IPath[] | undefined;

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	// NOTE: KEEP THIS INTERFACE AS SMALL AS POSSIBLE. AS SUCH:
	//       - PUT NON-WEB PROPERTIES INTO NATIVE WB ENV SERVICE
	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
}
