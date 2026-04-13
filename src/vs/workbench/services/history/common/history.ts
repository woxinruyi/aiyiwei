/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 历史服务接口】
 *  本文件定义编辑器历史服务的核心接口，负责导航历史记录管理：
 *
 *  【核心职责】
 *  1. 定义导航过滤器（GoFilter）- 控制导航类型
 *  2. 定义导航范围（GoScope）- 控制导航范围
 *  3. 提供 goBack/goForward 导航接口
 *  4. 管理编辑器历史列表
 *
 *  【导航过滤器】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  GoFilter.NONE       - 所有导航（编辑+导航）            │
 *  │  GoFilter.EDITS      - 仅编辑导致的导航                   │
 *  │  GoFilter.NAVIGATION - 仅导航操作（如转到定义）          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【导航范围】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  GoScope.DEFAULT    - 所有编辑器组                       │
 *  │  GoScope.EDITOR_GROUP - 仅活动编辑器组                   │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - goBack(filter, scope): 向后导航
 *  - goForward(filter, scope): 向前导航
 *  - getHistory(): 获取历史列表
 *
 *  【使用场景】
 *  - 快捷键 Alt+Left/Right 导航
 *  - 菜单 Go > Back / Forward
 *  - 命令面板执行导航命令
 *
 *  【与 historyService.ts 的关系】
 *  - 本文件定义接口
 *  - historyService.ts 实现接口
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IResourceEditorInput } from '../../../../platform/editor/common/editor.js';
import { GroupIdentifier } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';

export const IHistoryService = createDecorator<IHistoryService>('historyService');

/**
 * Limit editor navigation to certain kinds.
 */
export const enum GoFilter {

	/**
	 * Navigate between editor navigation history
	 * entries from any kind of navigation source.
	 */
	NONE,

	/**
	 * Only navigate between editor navigation history
	 * entries that were resulting from edits.
	 */
	EDITS,

	/**
	 * Only navigate between editor navigation history
	 * entries that were resulting from navigations, such
	 * as "Go to definition".
	 */
	NAVIGATION
}

/**
 * Limit editor navigation to certain scopes.
 */
export const enum GoScope {

	/**
	 * Navigate across all editors and editor groups.
	 */
	DEFAULT,

	/**
	 * Navigate only in editors of the active editor group.
	 */
	EDITOR_GROUP,

	/**
	 * Navigate only in the active editor.
	 */
	EDITOR
}

export interface IHistoryService {

	readonly _serviceBrand: undefined;

	/**
	 * Navigate forwards in editor navigation history.
	 */
	goForward(filter?: GoFilter): Promise<void>;

	/**
	 * Navigate backwards in editor navigation history.
	 */
	goBack(filter?: GoFilter): Promise<void>;

	/**
	 * Navigate between the current editor navigtion history entry
	 * and the previous one that was navigated to. This commands is
	 * like a toggle for `forward` and `back` to jump between 2 points
	 * in editor navigation history.
	 */
	goPrevious(filter?: GoFilter): Promise<void>;

	/**
	 * Navigate to the last entry in editor navigation history.
	 */
	goLast(filter?: GoFilter): Promise<void>;

	/**
	 * Re-opens the last closed editor if any.
	 */
	reopenLastClosedEditor(): Promise<void>;

	/**
	 * Get the entire history of editors that were opened.
	 */
	getHistory(): readonly (EditorInput | IResourceEditorInput)[];

	/**
	 * Removes an entry from history.
	 */
	removeFromHistory(input: EditorInput | IResourceEditorInput): void;

	/**
	 * Looking at the editor history, returns the workspace root of the last file that was
	 * inside the workspace and part of the editor history.
	 *
	 * @param schemeFilter filter to restrict roots by scheme.
	 */
	getLastActiveWorkspaceRoot(schemeFilter?: string, authorityFilter?: string): URI | undefined;

	/**
	 * Looking at the editor history, returns the resource of the last file that was opened.
	 *
	 * @param schemeFilter filter to restrict roots by scheme.
	 */
	getLastActiveFile(schemeFilter: string, authorityFilter?: string): URI | undefined;

	/**
	 * Opens the next used editor if any.
	 *
	 * @param group optional indicator to scope to a specific group.
	 */
	openNextRecentlyUsedEditor(group?: GroupIdentifier): Promise<void>;

	/**
	 * Opens the previously used editor if any.
	 *
	 * @param group optional indicator to scope to a specific group.
	 */
	openPreviouslyUsedEditor(group?: GroupIdentifier): Promise<void>;

	/**
	 * Clears all history.
	 */
	clear(): void;

	/**
	 * Clear list of recently opened editors.
	 */
	clearRecentlyOpened(): void;
}
