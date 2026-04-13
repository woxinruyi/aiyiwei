/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作副本备份服务】
 *  本文件定义工作副本备份服务接口，负责工作副本内容的备份和恢复：
 *
 *  【核心职责】
 *  1. 为工作副本创建备份（backup）
 *  2. 从备份恢复工作副本内容（resolve）
 *  3. 管理备份元数据（mtime, ctime, etag 等）
 *  4. 清理过期或不需要的备份（discard）
 *  5. 支持崩溃恢复机制
 *
 *  【备份概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  工作副本备份用于：                                     │
 *  │  - 崩溃恢复：应用异常退出后恢复未保存内容               │
 *  │  - 热退出：快速关闭/重启时保留编辑状态                  │
 *  │  - 临时保存：自动保存前的内容备份                       │
 *  │                                                          │
 *  │  备份位置：                                               │
 *  │  - 存储在用户数据目录的 backups 文件夹                  │
 *  │  - 使用 VSBufferReadableStream 存储内容                 │
 *  │  - 包含元数据用于验证和恢复                              │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【备份元数据】
 *  - mtime: 文件修改时间
 *  - ctime: 文件创建时间
 *  - size: 文件大小
 *  - etag: 文件版本标识
 *  - orphaned: 是否为孤立备份
 *
 *  【核心接口】
 *  - IWorkingCopyBackupService: 备份服务接口
 *  - IResolvedWorkingCopyBackup: 解析后的备份数据
 *  - IWorkingCopyBackupMeta: 备份元数据接口
 *  - IWorkingCopyIdentifier: 工作副本标识符
 *
 *  【核心方法】
 *  - backup(identifier, content, meta): 创建备份
 *  - resolve(identifier): 解析/恢复备份
 *  - discard(identifier): 删除备份
 *  - hasBackups(): 检查是否有任何备份
 *  - getBackups(): 获取所有备份列表
 *
 *  【使用场景】
 *  - 编辑器内容变更时自动备份
 *  - 应用启动时检查并恢复备份
 *  - 崩溃后恢复未保存的编辑内容
 *  - 保存成功后清理对应备份
 *
 *  【与 IFileService 的关系】
 *  - 使用文件服务读写备份文件
 *  - 备份存储在文件系统中
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { VSBufferReadable, VSBufferReadableStream } from '../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IWorkingCopyBackupMeta, IWorkingCopyIdentifier } from './workingCopy.js';

export const IWorkingCopyBackupService = createDecorator<IWorkingCopyBackupService>('workingCopyBackupService');

/**
 * A resolved working copy backup carries the backup value
 * as well as associated metadata with it.
 */
export interface IResolvedWorkingCopyBackup<T extends IWorkingCopyBackupMeta> {

	/**
	 * The content of the working copy backup.
	 */
	readonly value: VSBufferReadableStream;

	/**
	 * Additional metadata that is associated with
	 * the working copy backup.
	 */
	readonly meta?: T;
}

/**
 * The working copy backup service is the main service to handle backups
 * for working copies.
 * Methods allow to persist and resolve working copy backups from the file
 * system.
 */
export interface IWorkingCopyBackupService {

	readonly _serviceBrand: undefined;

	/**
	 * Finds out if there are any working copy backups stored.
	 */
	hasBackups(): Promise<boolean>;

	/**
	 * Finds out if a working copy backup with the given identifier
	 * and optional version exists.
	 *
	 * Note: if the backup service has not been initialized yet, this may return
	 * the wrong result. Always use `resolve()` if you can do a long running
	 * operation.
	 */
	hasBackupSync(identifier: IWorkingCopyIdentifier, versionId?: number): boolean;

	/**
	 * Gets a list of working copy backups for the current workspace.
	 */
	getBackups(): Promise<readonly IWorkingCopyIdentifier[]>;

	/**
	 * Resolves the working copy backup for the given identifier if that exists.
	 */
	resolve<T extends IWorkingCopyBackupMeta>(identifier: IWorkingCopyIdentifier): Promise<IResolvedWorkingCopyBackup<T> | undefined>;

	/**
	 * Stores a new working copy backup for the given identifier.
	 */
	backup(identifier: IWorkingCopyIdentifier, content?: VSBufferReadable | VSBufferReadableStream, versionId?: number, meta?: IWorkingCopyBackupMeta, token?: CancellationToken): Promise<void>;

	/**
	 * Discards the working copy backup associated with the identifier if it exists.
	 */
	discardBackup(identifier: IWorkingCopyIdentifier, token?: CancellationToken): Promise<void>;

	/**
	 * Discards all working copy backups.
	 *
	 * The optional set of identifiers in the filter can be
	 * provided to discard all but the provided ones.
	 */
	discardBackups(filter?: { except: IWorkingCopyIdentifier[] }): Promise<void>;
}
