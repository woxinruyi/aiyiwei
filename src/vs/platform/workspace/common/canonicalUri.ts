/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 规范 URI 服务】
 *  本文件定义规范 URI 服务的核心接口，用于处理 URI 的标准化和转换：
 *
 *  【核心职责】
 *  1. 提供 URI 标准化服务（ICanonicalUriService）
 *  2. 支持 URI 方案转换（如 file:// ↔ vscode-remote://）
 *  3. 管理 URI 提供者注册表
 *  4. 处理远程工作区的 URI 映射
 *
 *  【规范 URI 概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  规范 URI 是将各种形式的 URI 转换为标准格式的机制         │
 *  │                                                          │
 *  │  例如：                                                   │
 *  │  - 本地文件: file:///home/user/project                  │
 *  │  - 远程文件: vscode-remote://ssh/home/user/project      │
 *  │  - WSL文件: vscode-remote://wsl/home/user/project       │
 *  │                                                          │
 *  │  规范化确保同一资源有唯一标识符                           │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - ICanonicalUriService: 规范 URI 服务接口
 *    - registerCanonicalUriProvider(): 注册 URI 提供者
 *
 *  - ICanonicalUriProvider: URI 提供者接口
 *    - scheme: 支持的 URI 方案
 *    - provideCanonicalUri(): 提供规范 URI
 *
 *  【使用场景】
 *  - 远程开发环境的 URI 转换
 *  - 工作区资源的唯一标识
 *  - 跨不同协议的资源访问
 *  - 编辑器文档标识符标准化
 *
 *  【与 remoteAgentService 的关系】
 *  - 远程代理服务使用规范 URI 处理远程资源
 *  - 转换本地和远程 URI 格式
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import { URI, UriComponents } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export interface ICanonicalUriProvider {
	readonly scheme: string;
	provideCanonicalUri(uri: UriComponents, targetScheme: string, token: CancellationToken): Promise<URI | undefined>;
}

export const ICanonicalUriService = createDecorator<ICanonicalUriService>('canonicalUriIdentityService');

export interface ICanonicalUriService {
	readonly _serviceBrand: undefined;
	registerCanonicalUriProvider(provider: ICanonicalUriProvider): IDisposable;
}
