/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作副本历史服务】
 *  本文件定义工作副本历史服务接口，负责管理文件保存的历史版本：
 *
 *  【核心职责】
 *  1. 管理文件保存历史记录（类似版本控制）
 *  2. 支持历史版本的存储和检索
 *  3. 提供历史条目元数据（时间戳、保存来源）
 *  4. 支持历史版本回滚
 *  5. 管理历史条目的生命周期（过期清理）
 *
 *  【历史服务概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  保存历史记录允许用户查看和恢复文件的早期版本：          │
 *  │  - 每次保存创建一个历史条目                              │
 *  │  - 存储在本地文件系统（独立于 Git）                     │
 *  │  - 保留时间戳和保存来源                                  │
 *  │  - 支持从历史恢复                                        │
 *  │                                                          │
 *  │  保存来源（SaveSource）：                                 │
 *  │  - Auto Save: 自动保存                                  │
 *  │  - Manual: 手动保存（Ctrl+S）                          │
 *  │  - External: 外部修改                                  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - IWorkingCopyHistoryService: 历史服务接口
 *  - IWorkingCopyHistoryEntry: 历史条目
 *  - IWorkingCopyHistoryEvent: 历史变更事件
 *
 *  【核心方法】
 *  - addEntry(): 添加历史条目
 *  - getHistory(): 获取文件历史列表
 *  - removeEntry(): 删除特定历史条目
 *  - clearHistory(): 清除所有历史
 *  - getEntry(): 获取特定历史条目
 *
 *  【历史条目属性】
 *  - id: 唯一标识符
 *  - resource: 关联的文件资源
 *  - location: 历史文件存储位置
 *  - timestamp: 创建时间戳
 *  - source: 保存来源
 *
 *  【使用场景】
 *  - 时间线视图（Timeline）显示文件历史
 *  - 比较当前文件与历史版本
 *  - 从特定历史版本恢复
 *  - 查看文件修改历史
 *
 *  【与 Timeline 扩展的关系】
 *  - 时间线视图使用此服务获取历史数据
 *  - 提供丰富的文件历史展示
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { SaveSource } from '../../../common/editor.js';

export const IWorkingCopyHistoryService = createDecorator<IWorkingCopyHistoryService>('workingCopyHistoryService');

export interface IWorkingCopyHistoryEvent {

	/**
	 * The entry this event is about.
	 */
	readonly entry: IWorkingCopyHistoryEntry;
}

export interface IWorkingCopyHistoryEntry {

	/**
	 * Unique identifier of this entry for the working copy.
	 */
	readonly id: string;

	/**
	 * The associated working copy of this entry.
	 */
	readonly workingCopy: {
		readonly resource: URI;
		readonly name: string;
	};

	/**
	 * The location on disk of this history entry.
	 */
	readonly location: URI;

	/**
	 * The time when this history entry was created.
	 */
	timestamp: number;

	/**
	 * Associated source with the history entry.
	 */
	source: SaveSource;

	/**
	 * Optional additional metadata associated with the
	 * source that can help to describe the source.
	 */
	sourceDescription: string | undefined;
}

export interface IWorkingCopyHistoryEntryDescriptor {

	/**
	 * The associated resource of this history entry.
	 */
	readonly resource: URI;

	/**
	 * Optional associated timestamp to use for the
	 * history entry. If not provided, the current
	 * time will be used.
	 */
	readonly timestamp?: number;

	/**
	 * Optional source why the entry was added.
	 */
	readonly source?: SaveSource;
}

export interface IWorkingCopyHistoryService {

	readonly _serviceBrand: undefined;

	/**
	 * An event when an entry is added to the history.
	 */
	onDidAddEntry: Event<IWorkingCopyHistoryEvent>;

	/**
	 * An event when an entry is changed in the history.
	 */
	onDidChangeEntry: Event<IWorkingCopyHistoryEvent>;

	/**
	 * An event when an entry is replaced in the history.
	 */
	onDidReplaceEntry: Event<IWorkingCopyHistoryEvent>;

	/**
	 * An event when an entry is removed from the history.
	 */
	onDidRemoveEntry: Event<IWorkingCopyHistoryEvent>;

	/**
	 * An event when entries are moved in history.
	 */
	onDidMoveEntries: Event<void>;

	/**
	 * An event when all entries are removed from the history.
	 */
	onDidRemoveEntries: Event<void>;

	/**
	 * Adds a new entry to the history for the given working copy
	 * with an optional associated descriptor.
	 */
	addEntry(descriptor: IWorkingCopyHistoryEntryDescriptor, token: CancellationToken): Promise<IWorkingCopyHistoryEntry | undefined>;

	/**
	 * Updates an entry in the local history if found.
	 */
	updateEntry(entry: IWorkingCopyHistoryEntry, properties: { source: SaveSource }, token: CancellationToken): Promise<void>;

	/**
	 * Removes an entry from the local history if found.
	 */
	removeEntry(entry: IWorkingCopyHistoryEntry, token: CancellationToken): Promise<boolean>;

	/**
	 * Moves entries that either match the `source` or are a child
	 * of `source` to the `target`.
	 *
	 * @returns a list of resources for entries that have moved.
	 */
	moveEntries(source: URI, target: URI): Promise<URI[]>;

	/**
	 * Gets all history entries for the provided resource.
	 */
	getEntries(resource: URI, token: CancellationToken): Promise<readonly IWorkingCopyHistoryEntry[]>;

	/**
	 * Returns all resources for which history entries exist.
	 */
	getAll(token: CancellationToken): Promise<readonly URI[]>;

	/**
	 * Removes all entries from all of local history.
	 */
	removeAll(token: CancellationToken): Promise<void>;
}

/**
 * A limit on how many I/O operations we allow to run in parallel.
 * We do not want to spam the file system with too many requests
 * at the same time, so we limit to a maximum degree of parallellism.
 */
export const MAX_PARALLEL_HISTORY_IO_OPS = 20;
