/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 视图服务接口】
 *  本文件定义视图服务的核心接口，负责管理工作台视图和视图容器的显示：
 *
 *  【核心职责】
 *  1. 管理视图容器的打开、关闭和可见性
 *  2. 管理视图的打开、关闭和焦点状态
 *  3. 处理视图容器和视图的显示/隐藏事件
 *  4. 提供进度指示器支持（getViewProgressIndicator）
 *  5. 支持视图容器的聚焦操作
 *
 *  【视图容器 vs 视图】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  视图容器（View Container）                              │
 *  │  - 例如：资源管理器、搜索、调试、扩展面板               │
 *  │  - 可包含多个视图                                       │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  视图（View）                                          │
 *  │  - 例如：大纲、时间线、Git 更改                         │
 *  │  - 位于视图容器内部                                     │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - openViewContainer(id): 打开视图容器
 *  - openView(id): 打开视图
 *  - isViewContainerVisible(): 检查容器是否可见
 *  - isViewVisible(): 检查视图是否可见
 *  - getFocusedView(): 获取当前聚焦的视图
 *
 *  【事件系统】
 *  - onDidChangeViewContainerVisibility: 视图容器可见性变更
 *  - onDidChangeViewVisibility: 视图可见性变更
 *  - onDidChangeFocusedView: 聚焦视图变更
 *
 *  【使用场景】
 *  - 打开侧边栏面板（Ctrl+Shift+E 打开资源管理器）
 *  - 切换视图显示
 *  - 获取当前聚焦的视图
 *  - 在视图中显示进度指示器
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IProgressIndicator } from '../../../../platform/progress/common/progress.js';
import { IPaneComposite } from '../../../common/panecomposite.js';
import { IView, IViewDescriptor, IViewPaneContainer, ViewContainer, ViewContainerLocation } from '../../../common/views.js';

export const IViewsService = createDecorator<IViewsService>('viewsService');
export interface IViewsService {

	readonly _serviceBrand: undefined;

	// View Container APIs
	readonly onDidChangeViewContainerVisibility: Event<{ id: string; visible: boolean; location: ViewContainerLocation }>;
	isViewContainerVisible(id: string): boolean;
	isViewContainerActive(id: string): boolean;
	openViewContainer(id: string, focus?: boolean): Promise<IPaneComposite | null>;
	closeViewContainer(id: string): void;
	getVisibleViewContainer(location: ViewContainerLocation): ViewContainer | null;
	getActiveViewPaneContainerWithId(viewContainerId: string): IViewPaneContainer | null;
	getFocusedView(): IViewDescriptor | null;
	getFocusedViewName(): string;

	// View APIs
	readonly onDidChangeViewVisibility: Event<{ id: string; visible: boolean }>;
	readonly onDidChangeFocusedView: Event<void>;
	isViewVisible(id: string): boolean;
	openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;
	closeView(id: string): void;
	getActiveViewWithId<T extends IView>(id: string): T | null;
	getViewWithId<T extends IView>(id: string): T | null;
	getViewProgressIndicator(id: string): IProgressIndicator | undefined;
}
