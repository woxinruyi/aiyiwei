/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 标签服务接口】
 *  本文件定义标签服务，负责将 URI 转换为用户友好的显示标签：
 *
 *  【核心职责】
 *  1. 将 URI 转换为人类可读的标签（getUriLabel）
 *  2. 提供文件 basename 标签（getUriBasenameLabel）
 *  3. 格式化工作区标签（getWorkspaceLabel）
 *  4. 管理资源标签格式化器注册表
 *  5. 支持远程资源的主机标签显示
 *
 *  【标签格式化概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  URI → Label 转换示例：                                 │
 *  │                                                          │
 *  │  file:///home/user/project/src/main.ts                   │
 *  │    → "project/src/main.ts" (相对路径)                 │
 *  │    → "~/project/src/main.ts" (带 ~ 前缀)              │
 *  │    → "/home/user/project/src/main.ts" (绝对路径)        │
 *  │                                                          │
 *  │  vscode-remote://ssh+server/home/user/file.txt          │
 *  │    → "ssh+server: /home/user/file.txt"                │
 *  │    → "server: file.txt" (简洁模式)                   │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【详细级别（Verbosity）】
 *  - SHORT: 简洁标签（如文件名）
 *  - MEDIUM: 中等详细（如相对路径）
 *  - LONG: 完整标签（如绝对路径含主机名）
 *
 *  【核心方法】
 *  - getUriLabel(resource, options): 获取 URI 的显示标签
 *  - getUriBasenameLabel(resource): 获取文件 basename
 *  - getWorkspaceLabel(workspace): 获取工作区标签
 *  - getHostLabel(scheme, authority): 获取远程主机标签
 *  - registerFormatter(formatter): 注册自定义格式化器
 *
 *  【格式化器注册】
 *  - 支持按 URI scheme 注册（file, http, vscode-remote 等）
 *  - 支持缓存格式化器（跨会话保留）
 *  - 支持格式化器变更事件
 *
 *  【使用场景】
 *  - 编辑器标签页标题
 *  - 面包屑导航路径
 *  - 快速打开文件列表
 *  - 状态栏文件路径
 *  - 对话框文件选择
 *
 *  【与 workspace.ts 的关系】
 *  - 使用 IWorkspace 信息生成工作区标签
 *  - 支持多根工作区的标签格式化
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IWorkspace, ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier } from '../../workspace/common/workspace.js';

export const ILabelService = createDecorator<ILabelService>('labelService');

export interface ILabelService {

	readonly _serviceBrand: undefined;

	/**
	 * Gets the human readable label for a uri.
	 * If `relative` is passed returns a label relative to the workspace root that the uri belongs to.
	 * If `noPrefix` is passed does not tildify the label and also does not prepand the root name for relative labels in a multi root scenario.
	 * If `separator` is passed, will use that over the defined path separator of the formatter.
	 * If `appendWorkspaceSuffix` is passed, will append the name of the workspace to the label.
	 */
	getUriLabel(resource: URI, options?: { relative?: boolean; noPrefix?: boolean; separator?: '/' | '\\'; appendWorkspaceSuffix?: boolean }): string;
	getUriBasenameLabel(resource: URI): string;
	getWorkspaceLabel(workspace: (IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier | URI | IWorkspace), options?: { verbose: Verbosity }): string;
	getHostLabel(scheme: string, authority?: string): string;
	getHostTooltip(scheme: string, authority?: string): string | undefined;
	getSeparator(scheme: string, authority?: string): '/' | '\\';

	registerFormatter(formatter: ResourceLabelFormatter): IDisposable;
	onDidChangeFormatters: Event<IFormatterChangeEvent>;

	/**
	 * Registers a formatter that's cached for the machine beyond the lifecycle
	 * of the current window. Disposing the formatter _will not_ remove it from
	 * the cache.
	 */
	registerCachedFormatter(formatter: ResourceLabelFormatter): IDisposable;
}

export const enum Verbosity {
	SHORT,
	MEDIUM,
	LONG
}

export interface IFormatterChangeEvent {
	scheme: string;
}

export interface ResourceLabelFormatter {
	scheme: string;
	authority?: string;
	priority?: boolean;
	formatting: ResourceLabelFormatting;
}

export interface ResourceLabelFormatting {
	label: string; // myLabel:/${path}
	separator: '/' | '\\' | '';
	tildify?: boolean;
	normalizeDriveLetter?: boolean;
	workspaceSuffix?: string;
	workspaceTooltip?: string;
	authorityPrefix?: string;
	stripPathStartingSeparator?: boolean;
}
