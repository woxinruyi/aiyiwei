/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 编辑器模型基类】
 *  本文件定义编辑器模型的基础类，是编辑器输入的重量级对应物：
 *
 *  【核心职责】
 *  1. 提供编辑器模型的生命周期管理（加载、保存、恢复）
 *  2. 定义模型加载/解析接口（resolve）
 *  3. 管理模型状态（resolved, disposed）
 *  4. 触发模型处置事件（onWillDispose）
 *  5. 支持资源清理和释放
 *
 *  【编辑器模型概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  编辑器模型是编辑器输入的重量级对应物                     │
 *  │                                                          │
 *  │  对比：                                                   │
 *  │  - EditorInput: 轻量级标识符，用于标识编辑器             │
 *  │  - EditorModel: 重量级对象，包含实际数据和加载逻辑       │
 *  │                                                          │
 *  │  示例：                                                   │
 *  │  - 文件输入（FileEditorInput）→ 文件模型（FileEditorModel）│
 *  │  - 差异输入（DiffEditorInput）→ 差异模型（DiffEditorModel）│
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【生命周期】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  1. 创建（构造函数）                                     │
 *  │  2. 加载（resolve()）- 异步加载数据                      │
 *  │  3. 使用（isResolved() = true）                          │
 *  │  4. 保存/恢复（子类实现）                                │
 *  │  5. 销毁（dispose()）- 释放资源                          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - resolve(): 异步解析/加载模型数据
 *  - isResolved(): 检查模型是否已加载
 *  - isDisposed(): 检查模型是否已销毁
 *  - dispose(): 销毁模型并释放资源
 *
 *  【事件】
 *  - onWillDispose: 模型即将销毁时触发
 *   - 用于清理关联资源和保存状态
 *
 *  【使用场景】
 *  - 打开文件时创建文件模型
 *  - 编辑器需要实际数据时加载模型
 *  - 关闭编辑器时销毁模型释放内存
 *  - 实现自定义编辑器模型（如差异编辑器）
 *
 *  【与子类的关系】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  EditorModel（本基类）                                  │
 *  │       ↑ 继承                                            │
 *  │  FileEditorModel - 文件编辑器模型                       │
 *  │       ↑ 继承                                            │
 *  │  TextFileEditorModel - 文本文件编辑器模型               │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';

/**
 * The editor model is the heavyweight counterpart of editor input. Depending on the editor input, it
 * resolves from a file system retrieve content and may allow for saving it back or reverting it.
 * Editor models are typically cached for some while because they are expensive to construct.
 */
export class EditorModel extends Disposable {

	private readonly _onWillDispose = this._register(new Emitter<void>());
	readonly onWillDispose = this._onWillDispose.event;

	private resolved = false;

	/**
	 * Causes this model to resolve returning a promise when loading is completed.
	 */
	async resolve(): Promise<void> {
		this.resolved = true;
	}

	/**
	 * Returns whether this model was loaded or not.
	 */
	isResolved(): boolean {
		return this.resolved;
	}

	/**
	 * Find out if this model has been disposed.
	 */
	isDisposed(): boolean {
		return this._store.isDisposed;
	}

	/**
	 * Subclasses should implement to free resources that have been claimed through loading.
	 */
	override dispose(): void {
		this._onWillDispose.fire();

		super.dispose();
	}
}
