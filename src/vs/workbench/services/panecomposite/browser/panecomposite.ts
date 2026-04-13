/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 面板复合部件服务】
 *  本文件定义面板复合部件服务接口，管理侧边栏和底部面板中的视图容器：
 *
 *  【核心职责】
 *  1. 管理面板复合部件的打开和关闭
 *  2. 提供活动面板查询接口
 *  3. 支持固定和可见面板列表管理
 *  4. 触发面板开关事件
 *  5. 协调不同位置的面板（侧边栏/底部）
 *
 *  【面板复合部件概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  面板复合部件是 VSCode 侧边栏和底部面板的基础组件：     │
 *  │                                                          │
 *  │  ┌─────────────┐  ┌─────────────────────────────────┐ │
 *  │  │  活动栏     │  │           侧边栏               │ │
 *  │  │ (左侧图标)  │  │  ┌───────────────────────────┐ │ │
 *  │  │             │  │  │  资源管理器/搜索/扩展   │ │ │
 *  │  │  资源管理器 │  │  │  (PaneComposite)          │ │ │
 *  │  │  搜索       │  │  └───────────────────────────┘ │ │
 *  │  │  源代码管理 │  │                               │ │
 *  │  │  调试       │  │                               │ │
 *  │  │  扩展       │  │                               │ │
 *  │  └─────────────┘  └───────────────────────────────┘ │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【面板位置】
 *  - ViewContainerLocation.Sidebar: 左侧/右侧侧边栏
 *  - ViewContainerLocation.Panel: 底部面板
 *  - ViewContainerLocation.AuxiliaryBar: 辅助侧边栏
 *
 *  【核心接口】
 *  - IPaneCompositePartService: 面板复合部件服务
 *  - IPaneComposite: 面板复合部件实例
 *  - PaneCompositeDescriptor: 面板复合部件描述符
 *
 *  【核心方法】
 *  - openPaneComposite(id, location, focus): 打开面板
 *  - getActivePaneComposite(location): 获取活动面板
 *  - getPaneComposites(location): 获取所有面板描述符
 *  - getPinnedPaneCompositeIds(location): 获取固定面板 ID
 *  - getVisiblePaneCompositeIds(location): 获取可见面板 ID
 *
 *  【事件】
 *  - onDidPaneCompositeOpen: 面板打开事件
 *  - onDidPaneCompositeClose: 面板关闭事件
 *
 *  【使用场景】
 *  - 点击活动栏图标切换侧边栏视图
 *  - 命令面板打开特定视图
 *  - 扩展贡献新的侧边栏视图
 *  - 管理面板布局状态
 *
 *  【与 views.ts 的关系】
 *  - 使用 ViewContainerLocation 枚举
 *  - 协调视图容器的显示
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { PaneCompositeDescriptor } from '../../../browser/panecomposite.js';
import { IProgressIndicator } from '../../../../platform/progress/common/progress.js';
import { IPaneComposite } from '../../../common/panecomposite.js';
import { ViewContainerLocation } from '../../../common/views.js';

export const IPaneCompositePartService = createDecorator<IPaneCompositePartService>('paneCompositePartService');

export interface IPaneCompositePartService {

	readonly _serviceBrand: undefined;

	readonly onDidPaneCompositeOpen: Event<{ composite: IPaneComposite; viewContainerLocation: ViewContainerLocation }>;
	readonly onDidPaneCompositeClose: Event<{ composite: IPaneComposite; viewContainerLocation: ViewContainerLocation }>;

	/**
	 * Opens a viewlet with the given identifier and pass keyboard focus to it if specified.
	 */
	openPaneComposite(id: string | undefined, viewContainerLocation: ViewContainerLocation, focus?: boolean): Promise<IPaneComposite | undefined>;

	/**
	 * Returns the current active viewlet if any.
	 */
	getActivePaneComposite(viewContainerLocation: ViewContainerLocation): IPaneComposite | undefined;

	/**
	 * Returns the viewlet by id.
	 */
	getPaneComposite(id: string, viewContainerLocation: ViewContainerLocation): PaneCompositeDescriptor | undefined;

	/**
	 * Returns all enabled viewlets
	 */
	getPaneComposites(viewContainerLocation: ViewContainerLocation): PaneCompositeDescriptor[];

	/**
	 * Returns id of pinned view containers following the visual order.
	 */
	getPinnedPaneCompositeIds(viewContainerLocation: ViewContainerLocation): string[];

	/**
	 * Returns id of visible view containers following the visual order.
	 */
	getVisiblePaneCompositeIds(viewContainerLocation: ViewContainerLocation): string[];

	/**
	 * Returns id of all view containers following visual order.
	 */
	getPaneCompositeIds(viewContainerLocation: ViewContainerLocation): string[];

	/**
	 * Returns the progress indicator for the side bar.
	 */
	getProgressIndicator(id: string, viewContainerLocation: ViewContainerLocation): IProgressIndicator | undefined;

	/**
	 * Hide the active viewlet.
	 */
	hideActivePaneComposite(viewContainerLocation: ViewContainerLocation): void;

	/**
	 * Return the last active viewlet id.
	 */
	getLastActivePaneCompositeId(viewContainerLocation: ViewContainerLocation): string;
}
