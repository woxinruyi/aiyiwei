/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 面板复合组件接口】
 *  本文件定义面板复合组件（Pane Composite）的核心接口，是视图容器的基础：
 *
 *  【核心职责】
 *  1. 定义面板复合组件的基本能力
 *  2. 支持获取最佳宽度（避免内容截断）
 *  3. 提供打开视图的方法
 *  4. 获取视图面板容器实例
 *
 *  【面板复合组件 vs 视图容器】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  IPaneComposite（本接口）                               │
 *  │       ↑ 继承                                            │
 *  │  IComposite（基础复合组件）                             │
 *  │       ↑ 实现                                            │
 *  │  ViewPaneContainer（视图容器实现类）                    │
 *  │  例如：资源管理器、搜索、调试面板                       │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - getOptimalWidth(): 获取避免内容截断的最小宽度
 *  - openView(id, focus): 在面板中打开指定视图
 *  - getViewPaneContainer(): 获取视图面板容器
 *
 *  【使用场景】
 *  - 侧边栏面板（资源管理器、搜索、扩展）
 *  - 底部面板（终端、输出、调试控制台）
 *  - 自定义视图容器
 *
 *  【与 views.ts 的关系】
 *  - views.ts 定义 IViewPaneContainer
 *  - 本接口将视图容器作为复合组件的一部分
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { IView, IViewPaneContainer } from './views.js';
import { IComposite } from './composite.js';

export interface IPaneComposite extends IComposite {

	/**
	 * Returns the minimal width needed to avoid any content horizontal truncation
	 */
	getOptimalWidth(): number | undefined;

	openView<T extends IView>(id: string, focus?: boolean): T | undefined;
	getViewPaneContainer(): IViewPaneContainer | undefined;
}

