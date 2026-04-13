/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - JSON 编辑服务】
 *  本文件定义 JSON 文件编辑服务，用于程序化修改 JSON 配置文件：
 *
 *  【核心职责】
 *  1. 提供 JSON 文件的程序化写入接口
 *  2. 支持基于 JSONPath 的值修改
 *  3. 处理 JSON 格式错误（ERROR_INVALID_FILE）
 *  4. 支持批量修改多个值
 *  5. 可选自动保存
 *
 *  【JSON 编辑概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  JSON 编辑服务用于修改配置文件，如：                    │
 *  │  - settings.json (用户设置)                               │
 *  │  - launch.json (调试配置)                               │
 *  │  - tasks.json (任务配置)                                │
 *  │  - argv.json (启动参数)                                 │
 *  │  - keybindings.json (快捷键配置)                          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【JSONPath 示例】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  settings.json 中的 path:                               │
 *  │  - ["editor.fontSize"]                                   │
 *  │  - ["workbench.colorTheme"]                             │
 *  │  - ["extensions", "autoUpdate"]                          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - IJSONEditingService: JSON 编辑服务接口
 *  - IJSONValue: JSON 值定义（路径+值）
 *  - JSONEditingError: JSON 编辑错误
 *  - JSONEditingErrorCode: 错误码枚举
 *
 *  【核心方法】
 *  - write(resource, values, save): 写入 JSON 值
 *    - resource: 文件 URI
 *    - values: 要修改的值数组
 *    - save: 是否立即保存
 *
 *  【使用场景】
 *  - 修改用户设置（如切换主题）
 *  - 更新配置文件（如添加调试配置）
 *  - 程序化修改 keybindings
 *  - 扩展贡献配置修改
 *
 *  【与 textFileEditorModel.ts 的关系】
 *  - 基于文本文件模型实现
 *  - 使用文件服务进行读写
 *
 *  【错误处理】
 *  - ERROR_INVALID_FILE: 文件包含 JSON 语法错误
 *  - 抛出 JSONEditingError 异常
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { JSONPath } from '../../../../base/common/json.js';

export const IJSONEditingService = createDecorator<IJSONEditingService>('jsonEditingService');

export const enum JSONEditingErrorCode {

	/**
	 * Error when trying to write to a file that contains JSON errors.
	 */
	ERROR_INVALID_FILE
}

export class JSONEditingError extends Error {
	constructor(message: string, public code: JSONEditingErrorCode) {
		super(message);
	}
}

export interface IJSONValue {
	path: JSONPath;
	value: any;
}

export interface IJSONEditingService {

	readonly _serviceBrand: undefined;

	write(resource: URI, values: IJSONValue[], save: boolean): Promise<void>;
}
