/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - URI 身份服务】
 *  本文件定义 URI 身份验证服务的核心接口，处理 URI 的规范化：
 *
 *  【核心职责】
 *  1. 将 URI 转换为规范形式（canonical form）
 *  2. 处理大小写敏感性问题（Windows 不区分大小写，Linux/macOS 区分）
 *  3. 处理路径规范化（如 bar/../bar -> bar）
 *  4. 保持查询参数和片段标识符
 *
 *  【为什么需要 URI 身份验证】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  不同的 URI 可能指向同一资源                              │
 *  │  - file:///c:/foo/bar.txt                                 │
 *  │  - file:///c:/FOO/BAR.txt  ← Windows 视为相同              │
 *  │  - file:///foo/bar/../bar  ← 规范化后相同                  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - asCanonicalUri(uri): 返回规范化后的 URI
 *  - extUri: URI 扩展工具，支持大小写感知
 *
 *  【使用场景】
 *  - 作为键存储文档（确保同一文件只有一个模型）
 *  - 比较 URI 是否指向同一资源
 *  - 关联标记（markers）和文档
 *
 *  【与文件服务的关系】
 *  - fileService 使用 uriIdentity 规范化路径
 *  - 确保文件监听不重复
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IExtUri } from '../../../base/common/resources.js';


export const IUriIdentityService = createDecorator<IUriIdentityService>('IUriIdentityService');

export interface IUriIdentityService {

	readonly _serviceBrand: undefined;

	/**
	 * Uri extensions that are aware of casing.
	 */
	readonly extUri: IExtUri;

	/**
	 * Returns a canonical uri for the given resource. Different uris can point to the same
	 * resource. That's because of casing or missing normalization, e.g the following uris
	 * are different but refer to the same document (because windows paths are not case-sensitive)
	 *
	 * ```txt
	 * file:///c:/foo/bar.txt
	 * file:///c:/FOO/BAR.txt
	 * ```
	 *
	 * This function should be invoked when feeding uris into the system that represent the truth,
	 * e.g document uris or marker-to-document associations etc. This function should NOT be called
	 * to pretty print a label nor to sanitize a uri.
	 *
	 * Samples:
	 *
	 * | in | out | |
	 * |---|---|---|
	 * | `file:///foo/bar/../bar` | `file:///foo/bar` | n/a |
	 * | `file:///foo/bar/../bar#frag` | `file:///foo/bar#frag` | keep fragment |
	 * | `file:///foo/BAR` | `file:///foo/bar` | assume ignore case |
	 * | `file:///foo/bar/../BAR?q=2` | `file:///foo/BAR?q=2` | query makes it a different document |
	 */
	asCanonicalUri(uri: URI): URI;
}
