/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 剪贴板服务接口】
 *  本文件定义剪贴板服务的核心接口，负责系统剪贴板的读写操作：
 *
 *  【核心职责】
 *  1. 提供文本内容的剪贴板读写
 *  2. 支持资源（文件/文件夹）的剪贴板操作
 *  3. 支持查找粘贴板的特殊操作（macOS）
 *  4. 支持剪贴板内容类型检测
 *  5. 跨平台剪贴板抽象（Electron/Web）
 *
 *  【剪贴板类型】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  文本剪贴板（Text Clipboard）                         │
 *  │  - 普通文本复制/粘贴                                     │
 *  │  - 支持指定 MIME 类型                                   │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  资源剪贴板（Resource Clipboard）                       │
 *  │  - 文件/文件夹路径                                       │
 *  │  - 支持多选资源                                           │
 *  │  - 用于资源管理器的复制/粘贴                             │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  查找粘贴板（Find Pasteboard - macOS）                  │
 *  │  - 全局查找文本                                          │
 *  │  - 跨应用共享查找内容                                    │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - writeText(text, type): 写入文本到剪贴板
 *  - readText(type): 从剪贴板读取文本
 *  - writeResources(resources): 写入资源 URI 列表
 *  - readResources(): 读取资源 URI 列表
 *  - hasResources(): 检查剪贴板是否包含资源
 *  - writeFindText(text): 写入查找文本（macOS）
 *  - readFindText(): 读取查找文本（macOS）
 *
 *  【使用场景】
 *  - 编辑器复制/粘贴代码
 *  - 资源管理器复制/粘贴文件
 *  - 终端复制命令输出
 *  - 全局查找替换
 *
 *  【平台差异】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Electron 环境                                          │
 *  │  - 使用 native clipboard API                            │
 *  │  - 支持富文本格式                                         │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Web 环境                                               │
 *  │  - 使用 Clipboard API                                   │
 *  │  - 需要用户交互触发                                       │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【与 electron-sandbox 的关系】
 *  - 浏览器端通过 IPC 调用主进程剪贴板 API
 *  - 主进程实现使用 Electron 原生 API
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IClipboardService = createDecorator<IClipboardService>('clipboardService');

export interface IClipboardService {

	readonly _serviceBrand: undefined;

	/**
	 * Writes text to the system clipboard.
	 */
	writeText(text: string, type?: string): Promise<void>;

	/**
	 * Reads the content of the clipboard in plain text
	 */
	readText(type?: string): Promise<string>;

	/**
	 * Reads text from the system find pasteboard.
	 */
	readFindText(): Promise<string>;

	/**
	 * Writes text to the system find pasteboard.
	 */
	writeFindText(text: string): Promise<void>;

	/**
	 * Writes resources to the system clipboard.
	 */
	writeResources(resources: URI[]): Promise<void>;

	/**
	 * Reads resources from the system clipboard.
	 */
	readResources(): Promise<URI[]>;

	/**
	 * Find out if resources are copied to the clipboard.
	 */
	hasResources(): Promise<boolean>;

	/**
	 * Resets the internal state of the clipboard (if any) without touching the real clipboard.
	 *
	 * Used for implementations such as web which do not always support using the real clipboard.
	 */
	clearInternalState?(): void;

	/**
	 * Reads resources from the system clipboard as an image. If the clipboard does not contain an
	 * image, an empty buffer is returned.
	 */
	readImage(): Promise<Uint8Array>;
}
