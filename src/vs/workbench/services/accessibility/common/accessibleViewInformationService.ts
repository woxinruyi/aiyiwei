/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 无障碍视图信息服务】
 *  本文件实现无障碍视图信息服务，跟踪用户是否已查看过无障碍视图：
 *
 *  【核心职责】
 *  1. 跟踪无障碍视图的显示状态
 *  2. 存储用户是否已查看特定无障碍视图
 *  3. 支持基于视图 ID 的查询
 *  4. 使用存储服务持久化状态
 *  5. 应用范围存储（跨工作区共享）
 *
 *  【无障碍视图概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  无障碍视图用于屏幕阅读器优化：                         │
 *  │  - 终端输出查看器                                        │
 *  │  - 通知消息查看器                                          │
 *  │  - 悬停提示查看器                                          │
 *  │  - 内联补全查看器                                          │
 *  │                                                          │
 *  │  目的：                                                    │
 *  │  - 为视障用户提供更好的内容访问                          │
 *  │  - 确保重要信息不被遗漏                                  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【存储键格式】
 *  - 前缀: ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX
 *  - 完整键: `${prefix}${viewId}`
 *  - 示例: "accessibleViewShown.terminalOutput"
 *
 *  【核心方法】
 *  - hasShownAccessibleView(viewId): 检查是否已显示过视图
 *    - viewId: 视图唯一标识符
 *    - 返回: 是否已显示（布尔值）
 *
 *  【存储范围】
 *  - StorageScope.APPLICATION: 应用级存储
 *    - 跨所有工作区共享
 *    - 用户只需查看一次
 *
 *  【使用场景】
 *  - 首次使用提示（"按 Alt+F2 打开无障碍视图"）
 *  - 教程完成标记
 *  - 功能引导状态跟踪
 *  - 避免重复显示说明
 *
 *  【与 accessibility.ts 的关系】
 *  - 使用 platform/accessibility 中的常量
 *  - 属于无障碍系统的一部分
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX } from '../../../../platform/accessibility/common/accessibility.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';

export interface IAccessibleViewInformationService {
	_serviceBrand: undefined;
	hasShownAccessibleView(viewId: string): boolean;
}

export const IAccessibleViewInformationService = createDecorator<IAccessibleViewInformationService>('accessibleViewInformationService');

export class AccessibleViewInformationService extends Disposable implements IAccessibleViewInformationService {
	declare readonly _serviceBrand: undefined;
	constructor(@IStorageService private readonly _storageService: IStorageService) {
		super();
	}
	hasShownAccessibleView(viewId: string): boolean {
		return this._storageService.getBoolean(`${ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX}${viewId}`, StorageScope.APPLICATION, false) === true;
	}
}
