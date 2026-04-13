/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 扩展推荐服务】
 *  本文件定义扩展推荐服务接口，负责智能推荐适合当前工作区的扩展：
 *
 *  【核心职责】
 *  1. 基于文件类型推荐扩展（File-based Recommendations）
 *  2. 基于可执行文件推荐扩展（Exe-based Recommendations）
 *  3. 基于工作区配置推荐扩展（Config-based Recommendations）
 *  4. 基于编程语言推荐扩展（Language Recommendations）
 *  5. 管理扩展推荐原因和分类
 *
 *  【推荐类型】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Workspace      - 工作区特定推荐                        │
 *  │  File           - 基于打开的文件类型                    │
 *  │  Executable     - 基于系统可执行文件                   │
 *  │  WorkspaceConfig - 工作区配置文件推荐                  │
 *  │  DynamicWorkspace - 动态工作区分析推荐                 │
 *  │  Experimental   - 实验性功能推荐                      │
 *  │  Application    - 应用级别推荐                         │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - IExtensionRecommendationsService: 扩展推荐服务接口
 *  - IExtensionIgnoredRecommendationsService: 忽略推荐服务
 *  - IExtensionRecommendationReason: 推荐原因结构
 *  - ExtensionRecommendationReason: 推荐原因枚举
 *
 *  【推荐分类】
 *  - Important Recommendations: 重要推荐（高优先级）
 *  - Other Recommendations: 其他推荐（普通优先级）
 *
 *  【核心方法】
 *  - getFileBasedRecommendations(): 基于文件的推荐
 *  - getExeBasedRecommendations(): 基于可执行文件的推荐
 *  - getConfigBasedRecommendations(): 基于配置的推荐
 *  - getWorkspaceRecommendations(): 工作区推荐
 *  - getLanguageRecommendations(): 基于语言的推荐
 *  - getKeymapRecommendations(): 键映射推荐
 *  - getRemoteRecommendations(): 远程开发推荐
 *
 *  【使用场景】
 *  - 打开新文件时提示安装语言支持
 *  - 检测到特定框架（如 React、Vue）推荐相关扩展
 *  - 工作区配置文件中定义的推荐
 *  - 扩展面板显示"推荐"标签页
 *
 *  【与 extensionManagement.ts 的关系】
 *  - 推荐服务确定推荐哪些扩展
 *  - 扩展管理服务负责安装推荐的扩展
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStringDictionary } from '../../../../base/common/collections.js';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';

export const enum ExtensionRecommendationReason {
	Workspace,
	File,
	Executable,
	WorkspaceConfig,
	DynamicWorkspace,
	Experimental,
	Application,
}

export interface IExtensionRecommendationReason {
	reasonId: ExtensionRecommendationReason;
	reasonText: string;
}

export const IExtensionRecommendationsService = createDecorator<IExtensionRecommendationsService>('extensionRecommendationsService');

export interface IExtensionRecommendationsService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeRecommendations: Event<void>;
	getAllRecommendationsWithReason(): IStringDictionary<IExtensionRecommendationReason>;

	getImportantRecommendations(): Promise<string[]>;
	getOtherRecommendations(): Promise<string[]>;
	getFileBasedRecommendations(): string[];
	getExeBasedRecommendations(exe?: string): Promise<{ important: string[]; others: string[] }>;
	getConfigBasedRecommendations(): Promise<{ important: string[]; others: string[] }>;
	getWorkspaceRecommendations(): Promise<Array<string | URI>>;
	getKeymapRecommendations(): string[];
	getLanguageRecommendations(): string[];
	getRemoteRecommendations(): string[];
}

export type IgnoredRecommendationChangeNotification = {
	extensionId: string;
	isRecommended: boolean;
};

export const IExtensionIgnoredRecommendationsService = createDecorator<IExtensionIgnoredRecommendationsService>('IExtensionIgnoredRecommendationsService');

export interface IExtensionIgnoredRecommendationsService {
	readonly _serviceBrand: undefined;

	onDidChangeIgnoredRecommendations: Event<void>;
	readonly ignoredRecommendations: string[];

	onDidChangeGlobalIgnoredRecommendation: Event<IgnoredRecommendationChangeNotification>;
	readonly globalIgnoredRecommendations: string[];
	toggleGlobalIgnoredRecommendation(extensionId: string, ignore: boolean): void;
}


