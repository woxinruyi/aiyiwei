/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 复合组件基础接口】
 *  本文件定义复合组件（Composite）的基础接口，是工作台 UI 组件的抽象基类：
 *
 *  【核心职责】
 *  1. 定义复合组件的基本生命周期（焦点、标识、标题）
 *  2. 提供焦点管理接口（onDidFocus, onDidBlur）
 *  3. 定义唯一标识符（getId）
 *  4. 定义显示标题（getTitle）
 *  5. 提供底层控件访问（getControl）
 *
 *  【复合组件概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  复合组件是工作台 UI 的基本构建块                        │
 *  │  可以包含多个子视图或面板                                  │
 *  │  例如：侧边栏、面板、编辑器组                             │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - onDidFocus: 组件获得焦点事件
 *  - onDidBlur: 组件失去焦点事件
 *  - hasFocus(): 检查是否拥有焦点
 *  - getId(): 获取唯一标识符
 *  - getTitle(): 获取显示标题
 *  - getControl(): 获取底层控件
 *  - focus(): 设置焦点
 *
 *  【继承关系】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  IComposite（本接口）                                  │
 *  │       ↑ 继承                                            │
 *  │  IPaneComposite（面板复合组件）                         │
 *  │       ↑ 实现                                            │
 *  │  ViewPaneContainer（视图容器）                          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【使用场景】
 *  - 所有工作台 UI 组件的基础接口
 *  - 侧边栏面板实现此接口
 *  - 底部面板实现此接口
 *  - 编辑器组实现此接口
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../base/common/event.js';

export interface IComposite {

	/**
	 * An event when the composite gained focus.
	 */
	readonly onDidFocus: Event<void>;

	/**
	 * An event when the composite lost focus.
	 */
	readonly onDidBlur: Event<void>;

	/**
	 * Returns true if the composite has focus.
	 */
	hasFocus(): boolean;

	/**
	 * Returns the unique identifier of this composite.
	 */
	getId(): string;

	/**
	 * Returns the name of this composite to show in the title area.
	 */
	getTitle(): string | undefined;

	/**
	 * Returns the underlying control of this composite.
	 */
	getControl(): ICompositeControl | undefined;

	/**
	 * Asks the underlying control to focus.
	 */
	focus(): void;
}

/**
 * Marker interface for the composite control
 */
export interface ICompositeControl { }
