/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 扩展管理服务器服务实现】
 *  本文件实现扩展管理服务器服务，管理本地、远程和 Web 环境的扩展安装：
 *
 *  【核心职责】
 *  1. 根据环境创建合适的扩展管理服务器
 *  2. 支持本地扩展服务器（Local）
 *  3. 支持远程扩展服务器（Remote，通过 RemoteAgentService）
 *  4. 支持 Web 扩展服务器（Web，浏览器环境）
 *  5. 提供服务器标签和元数据
 *
 *  【服务器类型】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Local Server  - 本地扩展服务器                        │
 *  │  - 在桌面端管理本地安装的扩展                          │
 *  │  - 通过本地文件系统访问                                │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Remote Server - 远程扩展服务器                        │
 *  │  - 通过 RemoteAgentService 连接                        │
 *  │  - 管理远程工作区的扩展                                │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Web Server    - Web 扩展服务器                       │
 *  │  - 仅在 Web 环境启用                                   │
 *  │  - 管理浏览器端运行的扩展                              │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【环境检测】
 *  - 检查 remoteAgentService.getConnection() 判断远程连接
 *  - 使用 isWeb 判断是否为 Web 环境
 *  - 根据环境动态创建对应服务器实例
 *
 *  【使用场景】
 *  - 远程开发时安装/卸载扩展
 *  - Web 版 VS Code 管理浏览器扩展
 *  - 多服务器环境下的扩展同步
 *
 *  【与 extensionManagement.ts 的关系】
 *  - extensionManagement.ts 定义接口
 *  - 本文件提供具体实现
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ExtensionInstallLocation, IExtensionManagementServer, IExtensionManagementServerService } from './extensionManagement.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { Schemas } from '../../../../base/common/network.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { isWeb } from '../../../../base/common/platform.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WebExtensionManagementService } from './webExtensionManagementService.js';
import { IExtension } from '../../../../platform/extensions/common/extensions.js';
import { RemoteExtensionManagementService } from './remoteExtensionManagementService.js';

export class ExtensionManagementServerService implements IExtensionManagementServerService {

	declare readonly _serviceBrand: undefined;

	readonly localExtensionManagementServer: IExtensionManagementServer | null = null;
	readonly remoteExtensionManagementServer: IExtensionManagementServer | null = null;
	readonly webExtensionManagementServer: IExtensionManagementServer | null = null;

	constructor(
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@ILabelService labelService: ILabelService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		const remoteAgentConnection = remoteAgentService.getConnection();
		if (remoteAgentConnection) {
			const extensionManagementService = instantiationService.createInstance(RemoteExtensionManagementService, remoteAgentConnection.getChannel<IChannel>('extensions'));
			this.remoteExtensionManagementServer = {
				id: 'remote',
				extensionManagementService,
				get label() { return labelService.getHostLabel(Schemas.vscodeRemote, remoteAgentConnection.remoteAuthority) || localize('remote', "Remote"); },
			};
		}
		if (isWeb) {
			const extensionManagementService = instantiationService.createInstance(WebExtensionManagementService);
			this.webExtensionManagementServer = {
				id: 'web',
				extensionManagementService,
				label: localize('browser', "Browser"),
			};
		}
	}

	getExtensionManagementServer(extension: IExtension): IExtensionManagementServer {
		if (extension.location.scheme === Schemas.vscodeRemote) {
			return this.remoteExtensionManagementServer!;
		}
		if (this.webExtensionManagementServer) {
			return this.webExtensionManagementServer;
		}
		throw new Error(`Invalid Extension ${extension.location}`);
	}

	getExtensionInstallLocation(extension: IExtension): ExtensionInstallLocation | null {
		const server = this.getExtensionManagementServer(extension);
		return server === this.remoteExtensionManagementServer ? ExtensionInstallLocation.Remote : ExtensionInstallLocation.Web;
	}
}

registerSingleton(IExtensionManagementServerService, ExtensionManagementServerService, InstantiationType.Delayed);
