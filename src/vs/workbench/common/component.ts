/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作台 UI 组件基类】
 *  本文件定义工作台 UI 组件的基础类 Component，支持主题和状态管理：
 *
 *  【核心职责】
 *  1. 继承 Themable 类，支持主题切换
 *  2. 集成 Memento 系统，保存组件状态
 *  3. 提供唯一标识符管理
 *  4. 处理状态保存事件（onWillSaveState）
 *  5. 支持状态变更监听
 *
 *  【组件架构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Themable（主题支持）                                   │
 *  │       ↑ 继承                                            │
 *  │  Component（本类）                                      │
 *  │       ↑ 继承                                            │
 *  │  具体组件（如：ViewPane、EditorPane）                  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - getId(): 获取组件唯一标识符
 *  - getMemento(scope, target): 获取状态存储对象
 *  - reloadMemento(scope): 重新加载状态
 *  - saveState(): 保存状态（子类实现）
 *  - onDidChangeMementoValue(): 监听状态变更
 *
 *  【使用场景】
 *  - 所有工作台 UI 组件的基类
 *  - 侧边栏视图面板
 *  - 编辑器面板
 *  - 对话框和向导
 *
 *  【与 Memento 的关系】
 *  - 组件自动集成 Memento 系统
 *  - 状态在应用关闭前自动保存
 *  - 支持应用、配置档、工作区三级存储
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Memento, MementoObject } from './memento.js';
import { IThemeService, Themable } from '../../platform/theme/common/themeService.js';
import { IStorageService, IStorageValueChangeEvent, StorageScope, StorageTarget } from '../../platform/storage/common/storage.js';
import { DisposableStore } from '../../base/common/lifecycle.js';
import { Event } from '../../base/common/event.js';

export class Component extends Themable {

	private readonly memento: Memento;

	constructor(
		private readonly id: string,
		themeService: IThemeService,
		storageService: IStorageService
	) {
		super(themeService);

		this.memento = new Memento(this.id, storageService);

		this._register(storageService.onWillSaveState(() => {

			// Ask the component to persist state into the memento
			this.saveState();

			// Then save the memento into storage
			this.memento.saveMemento();
		}));
	}

	getId(): string {
		return this.id;
	}

	protected getMemento(scope: StorageScope, target: StorageTarget): MementoObject {
		return this.memento.getMemento(scope, target);
	}

	protected reloadMemento(scope: StorageScope): void {
		return this.memento.reloadMemento(scope);
	}

	protected onDidChangeMementoValue(scope: StorageScope, disposables: DisposableStore): Event<IStorageValueChangeEvent> {
		return this.memento.onDidChangeValue(scope, disposables);
	}

	protected saveState(): void {
		// Subclasses to implement for storing state
	}
}
