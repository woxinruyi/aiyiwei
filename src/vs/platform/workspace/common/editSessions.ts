/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 编辑会话标识服务】
 *  本文件定义编辑会话标识服务接口，用于跨设备同步编辑状态：
 *
 *  【核心职责】
 *  1. 提供编辑会话标识符生成（基于工作区文件夹）
 *  2. 支持编辑会话标识匹配（判断是否同一工作区）
 *  3. 管理编辑会话标识提供者注册表
 *  4. 支持编辑会话创建参与者（生命周期钩子）
 *  5. 处理跨设备的编辑状态同步
 *
 *  【编辑会话概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  编辑会话（Edit Session）用于跨设备同步：                │
 *  │  - 未保存的编辑器内容                                    │
 *  │  - 编辑器组和布局                                        │
 *  │  - 断点和调试状态                                        │
 *  │  - 任务终端状态                                          │
 *  │                                                          │
 *  │  标识符（Identifier）：                                  │
 *  │  - 唯一标识一个工作区文件夹                              │
 *  │  - 用于匹配云端存储的编辑会话                            │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【标识匹配度】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  EditSessionIdentityMatch.Complete (100)                │
 *  │    └─ 完全匹配，确定为同一工作区                         │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  EditSessionIdentityMatch.Partial (50)                  │
 *  │    └─ 部分匹配，可能是同一工作区的不同版本               │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  EditSessionIdentityMatch.None (0)                      │
 *  │    └─ 不匹配，完全不同工作区                           │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - IEditSessionIdentityProvider: 标识提供者接口
 *  - IEditSessionIdentityService: 标识服务接口
 *  - IEditSessionIdentityCreateParticipant: 创建参与者
 *
 *  【使用场景】
 *  - 云端同步未保存的编辑器内容
 *  - 跨设备恢复编辑器布局
 *  - 协作开发时共享编辑状态
 *  - 工作区迁移时保留编辑状态
 *
 *  【与 workspace.ts 的关系】
 *  - 基于 IWorkspaceFolder 生成标识符
 *  - 标识符包含工作区路径和配置信息
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IWorkspaceFolder } from './workspace.js';

export interface IEditSessionIdentityProvider {
	readonly scheme: string;
	getEditSessionIdentifier(workspaceFolder: IWorkspaceFolder, token: CancellationToken): Promise<string | undefined>;
	provideEditSessionIdentityMatch(workspaceFolder: IWorkspaceFolder, identity1: string, identity2: string, token: CancellationToken): Promise<EditSessionIdentityMatch | undefined>;
}

export const IEditSessionIdentityService = createDecorator<IEditSessionIdentityService>('editSessionIdentityService');

export interface IEditSessionIdentityService {
	readonly _serviceBrand: undefined;

	registerEditSessionIdentityProvider(provider: IEditSessionIdentityProvider): IDisposable;
	getEditSessionIdentifier(workspaceFolder: IWorkspaceFolder, cancellationToken: CancellationToken): Promise<string | undefined>;
	provideEditSessionIdentityMatch(workspaceFolder: IWorkspaceFolder, identity1: string, identity2: string, cancellationToken: CancellationToken): Promise<EditSessionIdentityMatch | undefined>;
	addEditSessionIdentityCreateParticipant(participants: IEditSessionIdentityCreateParticipant): IDisposable;
	onWillCreateEditSessionIdentity(workspaceFolder: IWorkspaceFolder, cancellationToken: CancellationToken): Promise<void>;
}

export interface IEditSessionIdentityCreateParticipant {
	participate(workspaceFolder: IWorkspaceFolder, cancellationToken: CancellationToken): Promise<void>;
}

export enum EditSessionIdentityMatch {
	Complete = 100,
	Partial = 50,
	None = 0,
}
