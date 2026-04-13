/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作副本编辑器服务】
 *  本文件实现工作副本编辑器服务，负责将工作副本与编辑器关联：
 *
 *  【核心职责】
 *  1. 管理工作副本编辑器处理器注册表
 *  2. 根据工作副本类型创建合适的编辑器
 *  3. 检查工作副本是否在编辑器中打开
 *  4. 支持崩溃恢复时重新打开编辑器
 *  5. 协调工作副本和编辑器之间的关系
 *
 *  【编辑器处理器概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  IWorkingCopyEditorHandler 接口：                       │
 *  │  - handles(workingCopy): 是否能处理此工作副本           │
 *  │  - isOpen(workingCopy, editor): 检查是否已打开         │
 *  │  - createEditor(workingCopy): 创建适合的编辑器输入      │
 *  │                                                          │
 *  │  示例处理器：                                             │
 *  │  - 文本文件处理器 → 创建 FileEditorInput               │
 *  │  - 未命名文件处理器 → 创建 UntitledEditorInput         │
 *  │  - 自定义编辑器处理器 → 创建 CustomEditorInput          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - IWorkingCopyEditorService: 编辑器服务接口
 *  - IWorkingCopyEditorHandler: 编辑器处理器接口
 *  - IWorkingCopyIdentifier: 工作副本标识符
 *
 *  【核心方法】
 *  - registerHandler(handler): 注册编辑器处理器
 *  - onDidRegisterHandler: 处理器注册事件
 *  - findHandler(workingCopy): 查找适合的处理器
 *
 *  【使用场景】
 *  - 崩溃恢复时重新打开所有工作副本
 *  - 从备份恢复时创建对应编辑器
 *  - 热退出后恢复编辑器状态
 *  - 扩展贡献自定义工作副本类型
 *
 *  【与 editorService.ts 的关系】
 *  - 使用 IEditorService 打开编辑器
 *  - 创建 EditorInput 供编辑器服务使用
 *
 *  【与 workingCopyBackup.ts 的关系】
 *  - 备份恢复时使用此服务创建编辑器
 *  - 协调备份和编辑器之间的关系
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { EditorsOrder, IEditorIdentifier } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IWorkingCopy, IWorkingCopyIdentifier } from './workingCopy.js';
import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IEditorService } from '../../editor/common/editorService.js';

export const IWorkingCopyEditorService = createDecorator<IWorkingCopyEditorService>('workingCopyEditorService');

export interface IWorkingCopyEditorHandler {

	/**
	 * Whether the handler is capable of opening the specific backup in
	 * an editor.
	 */
	handles(workingCopy: IWorkingCopyIdentifier): boolean | Promise<boolean>;

	/**
	 * Whether the provided working copy is opened in the provided editor.
	 */
	isOpen(workingCopy: IWorkingCopyIdentifier, editor: EditorInput): boolean;

	/**
	 * Create an editor that is suitable of opening the provided working copy.
	 */
	createEditor(workingCopy: IWorkingCopyIdentifier): EditorInput | Promise<EditorInput>;
}

export interface IWorkingCopyEditorService {

	readonly _serviceBrand: undefined;

	/**
	 * An event fired whenever a handler is registered.
	 */
	readonly onDidRegisterHandler: Event<IWorkingCopyEditorHandler>;

	/**
	 * Register a handler to the working copy editor service.
	 */
	registerHandler(handler: IWorkingCopyEditorHandler): IDisposable;

	/**
	 * Finds the first editor that can handle the provided working copy.
	 */
	findEditor(workingCopy: IWorkingCopy): IEditorIdentifier | undefined;
}

export class WorkingCopyEditorService extends Disposable implements IWorkingCopyEditorService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidRegisterHandler = this._register(new Emitter<IWorkingCopyEditorHandler>());
	readonly onDidRegisterHandler = this._onDidRegisterHandler.event;

	private readonly handlers = new Set<IWorkingCopyEditorHandler>();

	constructor(@IEditorService private readonly editorService: IEditorService) {
		super();
	}

	registerHandler(handler: IWorkingCopyEditorHandler): IDisposable {

		// Add to registry and emit as event
		this.handlers.add(handler);
		this._onDidRegisterHandler.fire(handler);

		return toDisposable(() => this.handlers.delete(handler));
	}

	findEditor(workingCopy: IWorkingCopy): IEditorIdentifier | undefined {
		for (const editorIdentifier of this.editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
			if (this.isOpen(workingCopy, editorIdentifier.editor)) {
				return editorIdentifier;
			}
		}

		return undefined;
	}

	private isOpen(workingCopy: IWorkingCopy, editor: EditorInput): boolean {
		for (const handler of this.handlers) {
			if (handler.isOpen(workingCopy, editor)) {
				return true;
			}
		}

		return false;
	}
}

// Register Service
registerSingleton(IWorkingCopyEditorService, WorkingCopyEditorService, InstantiationType.Delayed);
