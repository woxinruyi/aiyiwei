/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作区信任管理服务】
 *  本文件定义工作区信任（Workspace Trust）管理的核心接口，控制对工作区文件的安全访问：
 *
 *  【核心职责】
 *  1. 定义工作区信任管理服务接口（IWorkspaceTrustManagementService）
 *  2. 定义信任启用服务（IWorkspaceTrustEnablementService）
 *  3. 定义信任请求服务（IWorkspaceTrustRequestService）
 *  4. 管理信任范围（本地/远程工作区）
 *  5. 处理信任对话框和按钮交互
 *
 *  【工作区信任概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  工作区信任是 VSCode/Void 的安全机制                       │
 *  │  用于控制是否信任当前工作区的代码执行                     │
 *  │                                                          │
 *  │  信任级别：                                               │
 *  │  - Trusted: 完全信任，允许所有功能                       │
 *  │  - Restricted: 受限模式，禁用某些危险功能                 │
 *  │                                                          │
 *  │  作用范围（WorkspaceTrustScope）：                       │
 *  │  - Local: 本地工作区                                     │
 *  │  - Remote: 远程工作区（SSH、容器等）                      │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心服务】
 *  1. IWorkspaceTrustEnablementService
 *     - 检查工作区信任功能是否启用
 *     - isWorkspaceTrustEnabled(): boolean
 *
 *  2. IWorkspaceTrustManagementService
 *     - 管理工作区的信任状态
 *     - isWorkspaceTrusted(): 检查是否受信任
 *     - setWorkspaceTrust(): 设置信任状态
 *     - onDidChangeTrust: 信任状态变化事件
 *
 *  3. IWorkspaceTrustRequestService
 *     - 处理信任请求对话框
 *     - requestWorkspaceTrust(): 请求用户确认信任
 *     - 支持自定义按钮和消息
 *
 *  【使用场景】
 *  - 打开新工作区时检查信任状态
 *  - 执行潜在危险操作前验证信任
 *  - 扩展激活前确认信任
 *  - 用户手动管理信任文件夹
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export enum WorkspaceTrustScope {
	Local = 0,
	Remote = 1
}

export interface WorkspaceTrustRequestButton {
	readonly label: string;
	readonly type: 'ContinueWithTrust' | 'ContinueWithoutTrust' | 'Manage' | 'Cancel';
}

export interface WorkspaceTrustRequestOptions {
	readonly buttons?: WorkspaceTrustRequestButton[];
	readonly message?: string;
}

export const IWorkspaceTrustEnablementService = createDecorator<IWorkspaceTrustEnablementService>('workspaceTrustEnablementService');

export interface IWorkspaceTrustEnablementService {
	readonly _serviceBrand: undefined;

	isWorkspaceTrustEnabled(): boolean;
}

export const IWorkspaceTrustManagementService = createDecorator<IWorkspaceTrustManagementService>('workspaceTrustManagementService');

export interface IWorkspaceTrustManagementService {
	readonly _serviceBrand: undefined;

	onDidChangeTrust: Event<boolean>;
	onDidChangeTrustedFolders: Event<void>;

	readonly workspaceResolved: Promise<void>;
	readonly workspaceTrustInitialized: Promise<void>;
	acceptsOutOfWorkspaceFiles: boolean;

	isWorkspaceTrusted(): boolean;
	isWorkspaceTrustForced(): boolean;

	canSetParentFolderTrust(): boolean;
	setParentFolderTrust(trusted: boolean): Promise<void>;

	canSetWorkspaceTrust(): boolean;
	setWorkspaceTrust(trusted: boolean): Promise<void>;

	getUriTrustInfo(uri: URI): Promise<IWorkspaceTrustUriInfo>;
	setUrisTrust(uri: URI[], trusted: boolean): Promise<void>;

	getTrustedUris(): URI[];
	setTrustedUris(uris: URI[]): Promise<void>;

	addWorkspaceTrustTransitionParticipant(participant: IWorkspaceTrustTransitionParticipant): IDisposable;
}

export const enum WorkspaceTrustUriResponse {
	Open = 1,
	OpenInNewWindow = 2,
	Cancel = 3
}

export const IWorkspaceTrustRequestService = createDecorator<IWorkspaceTrustRequestService>('workspaceTrustRequestService');

export interface IWorkspaceTrustRequestService {
	readonly _serviceBrand: undefined;

	readonly onDidInitiateOpenFilesTrustRequest: Event<void>;
	readonly onDidInitiateWorkspaceTrustRequest: Event<WorkspaceTrustRequestOptions | undefined>;
	readonly onDidInitiateWorkspaceTrustRequestOnStartup: Event<void>;

	completeOpenFilesTrustRequest(result: WorkspaceTrustUriResponse, saveResponse?: boolean): Promise<void>;
	requestOpenFilesTrust(openFiles: URI[]): Promise<WorkspaceTrustUriResponse>;

	cancelWorkspaceTrustRequest(): void;
	completeWorkspaceTrustRequest(trusted?: boolean): Promise<void>;
	requestWorkspaceTrust(options?: WorkspaceTrustRequestOptions): Promise<boolean | undefined>;
	requestWorkspaceTrustOnStartup(): void;
}

export interface IWorkspaceTrustTransitionParticipant {
	participate(trusted: boolean): Promise<void>;
}

export interface IWorkspaceTrustUriInfo {
	uri: URI;
	trusted: boolean;
}

export interface IWorkspaceTrustInfo {
	uriTrustInfo: IWorkspaceTrustUriInfo[];
}
