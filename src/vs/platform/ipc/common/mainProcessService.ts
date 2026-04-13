/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 主进程 IPC 服务】
 *  本文件实现渲染进程与 Electron 主进程通信的核心服务：
 *
 *  【核心职责】
 *  1. 提供 IPC 通道（Channel）获取接口
 *  2. 注册服务端通道供主进程调用
 *  3. 管理主进程与渲染进程的双向通信
 *
 *  【IPC 架构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │                  Electron 主进程                          │
 *  │                    (Main Process)                         │
 *  │         ┌──────────────────────────────────────┐         │
 *  │         │    IPCServer                         │         │
 *  │         │    - 注册服务通道                    │         │
 *  │         │    - 处理渲染进程请求                │         │
 *  │         └──────────────────┬───────────────────┘         │
 *  └──────────────────────────────┼──────────────────────────┘
 *                                 │ IPC 通信
 *  ┌──────────────────────────────┼──────────────────────────┐
 *  │                  渲染进程     │  (Renderer Process)       │
 *  │         ┌────────────────────┴───────────────────┐       │
 *  │         │  MainProcessService（本文件）           │       │
 *  │         │  - 获取 IPC 通道                        │       │
 *  │         │  - 调用主进程服务                       │       │
 *  │         └──────────────────────────────────────┘       │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - getChannel(channelName): 获取指定名称的 IPC 通道
 *  - registerChannel(channelName, channel): 注册服务端通道
 *
 *  【使用场景】
 *  - Void LLM 消息服务通过 IPC 与主进程通信
 *  - 文件系统操作需要主进程权限时
 *  - 访问 Node.js API（如网络请求）
 *
 *  【与 Void 的关系】
 *  - sendLLMMessageService.ts 使用本服务获取 LLMMessageChannel
 *  - 绕过浏览器 CSP 限制发送 HTTP 请求
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { IChannel, IPCServer, IServerChannel, StaticRouter } from '../../../base/parts/ipc/common/ipc.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IRemoteService } from './services.js';

export const IMainProcessService = createDecorator<IMainProcessService>('mainProcessService');

export interface IMainProcessService extends IRemoteService { }

/**
 * An implementation of `IMainProcessService` that leverages `IPCServer`.
 */
export class MainProcessService implements IMainProcessService {

	declare readonly _serviceBrand: undefined;

	constructor(
		private server: IPCServer,
		private router: StaticRouter
	) { }

	getChannel(channelName: string): IChannel {
		return this.server.getChannel(channelName, this.router);
	}

	registerChannel(channelName: string, channel: IServerChannel<string>): void {
		this.server.registerChannel(channelName, channel);
	}
}
