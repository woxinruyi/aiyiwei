/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 平台注册表】
 *  本文件实现 VSCode/Void 的扩展注册表机制，用于管理贡献点：
 *
 *  【核心职责】
 *  1. 提供统一的扩展注册接口（IRegistry）
 *  2. 管理扩展贡献点的注册和查询
 *  3. 支持类型安全的贡献点获取
 *  4. 确保贡献点 ID 的唯一性
 *
 *  【注册表架构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │                   IRegistry（接口）                      │
 *  │                      ↑ 实现                             │
 *  │                  RegistryImpl                         │
 *  │                      ↑ 存储                             │
 *  │              Map<id, contribution>                      │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - add(id, data): 注册贡献点（ID 必须唯一）
 *  - knows(id): 检查贡献点是否存在
 *  - as<T>(id): 获取指定类型的贡献点
 *
 *  【使用场景】
 *  - 注册编辑器类型（EditorExtensions.Editors）
 *  - 注册命令（CommandsRegistry）
 *  - 注册配置项（ConfigurationRegistry）
 *  - 注册主题（ThemeRegistry）
 *  - 注册扩展（ExtensionRegistry）
 *
 *  【与欢迎页面的关系】
 *  - 欢迎页面通过注册表获取各种贡献点
 *  - 注册编辑器序列化器
 *  - 注册命令处理器
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import * as Assert from '../../../base/common/assert.js';
import * as Types from '../../../base/common/types.js';

export interface IRegistry {

	/**
	 * Adds the extension functions and properties defined by data to the
	 * platform. The provided id must be unique.
	 * @param id a unique identifier
	 * @param data a contribution
	 */
	add(id: string, data: any): void;

	/**
	 * Returns true iff there is an extension with the provided id.
	 * @param id an extension identifier
	 */
	knows(id: string): boolean;

	/**
	 * Returns the extension functions and properties defined by the specified key or null.
	 * @param id an extension identifier
	 */
	as<T>(id: string): T;
}

class RegistryImpl implements IRegistry {

	private readonly data = new Map<string, any>();

	public add(id: string, data: any): void {
		Assert.ok(Types.isString(id));
		Assert.ok(Types.isObject(data));
		Assert.ok(!this.data.has(id), 'There is already an extension with this id');

		this.data.set(id, data);
	}

	public knows(id: string): boolean {
		return this.data.has(id);
	}

	public as(id: string): any {
		return this.data.get(id) || null;
	}
}

export const Registry: IRegistry = new RegistryImpl();
