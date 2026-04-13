/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作副本服务接口】
 *  本文件定义工作副本（Working Copy）的核心接口，管理未保存内容的备份：
 *
 *  【核心职责】
 *  1. 定义工作副本能力（WorkingCopyCapabilities）
 *  2. 管理未保存内容的备份（backup）
 *  3. 处理保存和恢复操作
 *  4. 跟踪脏状态（dirty state）
 *  5. 支持热退出（hot exit）功能
 *
 *  【工作副本概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  工作副本代表编辑器中未保存的内容                       │
 *  │  - 备份未保存的内容防止数据丢失                         │
 *  │  - 支持应用关闭后恢复未保存的内容                       │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【工作副本能力】
 *  - None: 无特殊能力
 *  - Untitled: 未命名文件，需要额外输入保存路径
 *  - Scratchpad: 草稿文件，不提示保存直接丢弃
 *
 *  【核心接口】
 *  - IWorkingCopy: 工作副本接口
 *  - IWorkingCopyBackup: 备份数据接口
 *  - IWorkingCopyService: 工作副本服务接口
 *
 *  【使用场景】
 *  - 编辑器未保存内容自动备份
 *  - 应用崩溃后恢复未保存内容
 *  - 热退出时保存工作区状态
 *
 *  【与文本文件服务的关系】
 *  - 文本文件服务使用工作副本服务管理未保存内容
 *  - 保存前创建备份，保存后清除备份
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { ISaveOptions, IRevertOptions, SaveReason, SaveSource } from '../../../common/editor.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { VSBufferReadable, VSBufferReadableStream } from '../../../../base/common/buffer.js';

export const enum WorkingCopyCapabilities {

	/**
	 * Signals no specific capability for the working copy.
	 */
	None = 0,

	/**
	 * Signals that the working copy requires
	 * additional input when saving, e.g. an
	 * associated path to save to.
	 */
	Untitled = 1 << 1,

	/**
	 * The working copy will not indicate that
	 * it is dirty and unsaved content will be
	 * discarded without prompting if closed.
	 */
	Scratchpad = 1 << 2
}

/**
 * Data to be associated with working copy backups. Use
 * `IWorkingCopyBackupService.resolve(workingCopy)` to
 * retrieve the backup when loading the working copy.
 */
export interface IWorkingCopyBackup {

	/**
	 * Any serializable metadata to be associated with the backup.
	 */
	meta?: IWorkingCopyBackupMeta;

	/**
	 * The actual snapshot of the contents of the working copy at
	 * the time the backup was made.
	 */
	content?: VSBufferReadable | VSBufferReadableStream;
}

/**
 * Working copy backup metadata that can be associated
 * with the backup.
 *
 * Some properties may be reserved as outlined here and
 * cannot be used.
 */
export interface IWorkingCopyBackupMeta {

	/**
	 * Any property needs to be serializable through JSON.
	 */
	[key: string]: unknown;

	/**
	 * `typeId` is a reserved property that cannot be used
	 * as backup metadata.
	 */
	typeId?: never;
}

/**
 * @deprecated it is important to provide a type identifier
 * for working copies to enable all capabilities.
 */
export const NO_TYPE_ID = '';

/**
 * Every working copy has in common that it is identified by
 * a resource `URI` and a `typeId`. There can only be one
 * working copy registered with the same `URI` and `typeId`.
 */
export interface IWorkingCopyIdentifier {

	/**
	 * The type identifier of the working copy for grouping
	 * working copies of the same domain together.
	 *
	 * There can only be one working copy for a given resource
	 * and type identifier.
	 */
	readonly typeId: string;

	/**
	 * The resource of the working copy must be unique for
	 * working copies of the same `typeId`.
	 */
	readonly resource: URI;
}

export interface IWorkingCopySaveEvent {

	/**
	 * The reason why the working copy was saved.
	 */
	readonly reason?: SaveReason;

	/**
	 * The source of the working copy save request.
	 */
	readonly source?: SaveSource;
}

/**
 * A working copy is an abstract concept to unify handling of
 * data that can be worked on (e.g. edited) in an editor.
 *
 *
 * A working copy resource may be the backing store of the data
 * (e.g. a file on disk), but that is not a requirement. If
 * your working copy is file based, consider to use the
 * `IFileWorkingCopy` instead that simplifies a lot of things
 * when working with file based working copies.
 */
export interface IWorkingCopy extends IWorkingCopyIdentifier {

	/**
	 * Human readable name of the working copy.
	 */
	readonly name: string;

	/**
	 * The capabilities of the working copy.
	 */
	readonly capabilities: WorkingCopyCapabilities;


	//#region Events

	/**
	 * Used by the workbench to signal if the working copy
	 * is dirty or not. Typically a working copy is dirty
	 * once changed until saved or reverted.
	 */
	readonly onDidChangeDirty: Event<void>;

	/**
	 * Used by the workbench e.g. to trigger auto-save
	 * (unless this working copy is untitled) and backups.
	 */
	readonly onDidChangeContent: Event<void>;

	/**
	 * Used by the workbench e.g. to track local history
	 * (unless this working copy is untitled).
	 */
	readonly onDidSave: Event<IWorkingCopySaveEvent>;

	//#endregion


	//#region Dirty Tracking

	/**
	 * Indicates that the file has unsaved changes
	 * and should confirm before closing.
	 */
	isDirty(): boolean;

	/**
	 * Indicates that the file has unsaved changes.
	 * Used for backup tracking and accounts for
	 * working copies that are never dirty e.g.
	 * scratchpads.
	 */
	isModified(): boolean;

	//#endregion


	//#region Save / Backup

	/**
	 * The delay in milliseconds to wait before triggering
	 * a backup after the content of the model has changed.
	 *
	 * If not configured, a sensible default will be taken
	 * based on user settings.
	 */
	readonly backupDelay?: number;

	/**
	 * The workbench may call this method often after it receives
	 * the `onDidChangeContent` event for the working copy. The motivation
	 * is to allow to quit VSCode with dirty working copies present.
	 *
	 * Providers of working copies should use `IWorkingCopyBackupService.resolve(workingCopy)`
	 * to retrieve the backup metadata associated when loading the working copy.
	 *
	 * @param token support for cancellation
	 */
	backup(token: CancellationToken): Promise<IWorkingCopyBackup>;

	/**
	 * Asks the working copy to save. If the working copy was dirty, it is
	 * expected to be non-dirty after this operation has finished.
	 *
	 * @returns `true` if the operation was successful and `false` otherwise.
	 */
	save(options?: ISaveOptions): Promise<boolean>;

	/**
	 * Asks the working copy to revert. If the working copy was dirty, it is
	 * expected to be non-dirty after this operation has finished.
	 */
	revert(options?: IRevertOptions): Promise<void>;

	//#endregion
}
