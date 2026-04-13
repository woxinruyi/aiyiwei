/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作台状态记忆（Memento）】
 *  本文件实现工作台状态记忆机制，用于保存和恢复 UI 组件的状态：
 *
 *  【核心职责】
 *  1. 提供分层的状态存储（应用、配置档、工作区）
 *  2. 管理 Memento 对象的创建和缓存
 *  3. 支持状态变更事件监听
 *  4. 处理状态序列化和反序列化
 *
 *  【存储范围】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  APPLICATION - 应用级别                                  │
 *  │  - 跨所有工作区和配置档共享                              │
 *  │  - 例如：窗口大小、侧边栏宽度                            │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  PROFILE   - 配置档级别                                  │
 *  │  - 特定用户配置档内共享                                  │
 *  │  - 例如：主题设置、键盘快捷键                            │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  WORKSPACE - 工作区级别                                  │
 *  │  - 仅当前工作区有效                                      │
 *  │  - 例如：打开的文件、编辑器布局                          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - getMemento(scope, target): 获取指定范围的 Memento 对象
 *  - save(): 保存状态到存储服务
 *  - MementoObject: 任意键值对的状态对象
 *
 *  【使用场景】
 *  - 保存侧边栏折叠状态
 *  - 保存面板大小和位置
 *  - 保存视图可见性设置
 *  - 保存编辑器组布局
 *
 *  【与 StorageService 的关系】
 *  - 基于 StorageService 实现持久化
 *  - 添加缓存层优化性能
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, IStorageValueChangeEvent, StorageScope, StorageTarget } from '../../platform/storage/common/storage.js';
import { isEmptyObject } from '../../base/common/types.js';
import { onUnexpectedError } from '../../base/common/errors.js';
import { DisposableStore } from '../../base/common/lifecycle.js';
import { Event } from '../../base/common/event.js';

export type MementoObject = { [key: string]: any };

export class Memento {

	private static readonly applicationMementos = new Map<string, ScopedMemento>();
	private static readonly profileMementos = new Map<string, ScopedMemento>();
	private static readonly workspaceMementos = new Map<string, ScopedMemento>();

	private static readonly COMMON_PREFIX = 'memento/';

	private readonly id: string;

	constructor(id: string, private storageService: IStorageService) {
		this.id = Memento.COMMON_PREFIX + id;
	}

	getMemento(scope: StorageScope, target: StorageTarget): MementoObject {
		switch (scope) {
			case StorageScope.WORKSPACE: {
				let workspaceMemento = Memento.workspaceMementos.get(this.id);
				if (!workspaceMemento) {
					workspaceMemento = new ScopedMemento(this.id, scope, target, this.storageService);
					Memento.workspaceMementos.set(this.id, workspaceMemento);
				}

				return workspaceMemento.getMemento();
			}

			case StorageScope.PROFILE: {
				let profileMemento = Memento.profileMementos.get(this.id);
				if (!profileMemento) {
					profileMemento = new ScopedMemento(this.id, scope, target, this.storageService);
					Memento.profileMementos.set(this.id, profileMemento);
				}

				return profileMemento.getMemento();
			}

			case StorageScope.APPLICATION: {
				let applicationMemento = Memento.applicationMementos.get(this.id);
				if (!applicationMemento) {
					applicationMemento = new ScopedMemento(this.id, scope, target, this.storageService);
					Memento.applicationMementos.set(this.id, applicationMemento);
				}

				return applicationMemento.getMemento();
			}
		}
	}

	onDidChangeValue(scope: StorageScope, disposables: DisposableStore): Event<IStorageValueChangeEvent> {
		return this.storageService.onDidChangeValue(scope, this.id, disposables);
	}

	saveMemento(): void {
		Memento.workspaceMementos.get(this.id)?.save();
		Memento.profileMementos.get(this.id)?.save();
		Memento.applicationMementos.get(this.id)?.save();
	}

	reloadMemento(scope: StorageScope): void {
		let memento: ScopedMemento | undefined;
		switch (scope) {
			case StorageScope.APPLICATION:
				memento = Memento.applicationMementos.get(this.id);
				break;
			case StorageScope.PROFILE:
				memento = Memento.profileMementos.get(this.id);
				break;
			case StorageScope.WORKSPACE:
				memento = Memento.workspaceMementos.get(this.id);
				break;
		}

		memento?.reload();
	}

	static clear(scope: StorageScope): void {
		switch (scope) {
			case StorageScope.WORKSPACE:
				Memento.workspaceMementos.clear();
				break;
			case StorageScope.PROFILE:
				Memento.profileMementos.clear();
				break;
			case StorageScope.APPLICATION:
				Memento.applicationMementos.clear();
				break;
		}
	}
}

class ScopedMemento {

	private mementoObj: MementoObject;

	constructor(private id: string, private scope: StorageScope, private target: StorageTarget, private storageService: IStorageService) {
		this.mementoObj = this.doLoad();
	}

	private doLoad(): MementoObject {
		try {
			return this.storageService.getObject<MementoObject>(this.id, this.scope, {});
		} catch (error) {
			// Seeing reports from users unable to open editors
			// from memento parsing exceptions. Log the contents
			// to diagnose further
			// https://github.com/microsoft/vscode/issues/102251
			onUnexpectedError(`[memento]: failed to parse contents: ${error} (id: ${this.id}, scope: ${this.scope}, contents: ${this.storageService.get(this.id, this.scope)})`);
		}

		return {};
	}

	getMemento(): MementoObject {
		return this.mementoObj;
	}

	reload(): void {

		// Clear old
		for (const name of Object.getOwnPropertyNames(this.mementoObj)) {
			delete this.mementoObj[name];
		}

		// Assign new
		Object.assign(this.mementoObj, this.doLoad());
	}

	save(): void {
		if (!isEmptyObject(this.mementoObj)) {
			this.storageService.store(this.id, this.mementoObj, this.scope, this.target);
		} else {
			this.storageService.remove(this.id, this.scope);
		}
	}
}
