/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 文本资源配置服务】
 *  本文件定义文本资源配置服务接口，支持按资源 URI 和语言获取编辑器配置：
 *
 *  【核心职责】
 *  1. 按资源 URI 获取编辑器配置（考虑语言覆盖设置）
 *  2. 支持多语言环境下的差异化配置
 *  3. 处理配置变更事件（影响特定资源的配置）
 *  4. 支持按位置获取配置（考虑嵌入式语言）
 *  5. 提供配置变更检测方法（affectsConfiguration）
 *
 *  【配置覆盖机制】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  配置层级（从高到低优先级）：                           │
 *  │  1. 语言特定覆盖（[typescript] 下的设置）              │
 *  │  2. 资源特定设置                                        │
 *  │  3. 工作区设置                                          │
 *  │  4. 用户设置                                            │
 *  │  5. 默认设置                                            │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【使用示例】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  settings.json:                                         │
 *  │  {                                                       │
 *  │    "editor.tabSize": 4,                                  │
 *  │    "[typescript]": {                                     │
 *  │      "editor.tabSize": 2  // TypeScript 文件使用 2    │
 *  │    }                                                     │
 *  │  }                                                       │
 *  │                                                          │
 *  │  对于 .ts 文件：                                         │
 *  │  - getValue(resource, 'editor.tabSize') → 2             │
 *  │  对于其他文件：                                          │
 *  │  - getValue(resource, 'editor.tabSize') → 4             │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - ITextResourceConfigurationService: 服务接口
 *  - ITextResourceConfigurationChangeEvent: 配置变更事件
 *
 *  【核心方法】
 *  - getValue(resource, section): 获取资源配置值
 *  - onDidChangeConfiguration: 配置变更事件
 *  - affectsConfiguration(resource, section): 检测配置是否影响资源
 *
 *  【使用场景】
 *  - 编辑器根据语言设置缩进大小
 *  - 格式化工具获取语言特定的格式选项
 *  - 代码片段根据语言过滤
 *  - 诊断服务获取语言特定的检查规则
 *
 *  【与 configuration.ts 的关系】
 *  - 扩展 IConfigurationService 接口
 *  - 添加资源和语言特定的配置支持
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { URI } from '../../../base/common/uri.js';
import { IPosition } from '../core/position.js';
import { ConfigurationTarget, IConfigurationValue } from '../../../platform/configuration/common/configuration.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const ITextResourceConfigurationService = createDecorator<ITextResourceConfigurationService>('textResourceConfigurationService');

export interface ITextResourceConfigurationChangeEvent {

	/**
	 * All affected keys. Also includes language overrides and keys changed under language overrides.
	 */
	readonly affectedKeys: ReadonlySet<string>;

	/**
	 * Returns `true` if the given section has changed for the given resource.
	 *
	 * Example: To check if the configuration section has changed for a given resource use `e.affectsConfiguration(resource, section)`.
	 *
	 * @param resource Resource for which the configuration has to be checked.
	 * @param section Section of the configuration
	 */
	affectsConfiguration(resource: URI | undefined, section: string): boolean;
}

export interface ITextResourceConfigurationService {

	readonly _serviceBrand: undefined;

	/**
	 * Event that fires when the configuration changes.
	 */
	onDidChangeConfiguration: Event<ITextResourceConfigurationChangeEvent>;

	/**
	 * Fetches the value of the section for the given resource by applying language overrides.
	 * Value can be of native type or an object keyed off the section name.
	 *
	 * @param resource - Resource for which the configuration has to be fetched.
	 * @param position - Position in the resource for which configuration has to be fetched.
	 * @param section - Section of the configuration.
	 *
	 */
	getValue<T>(resource: URI | undefined, section?: string): T;
	getValue<T>(resource: URI | undefined, position?: IPosition, section?: string): T;

	/**
	 * Inspects the values of the section for the given resource by applying language overrides.
	 *
	 * @param resource - Resource for which the configuration has to be fetched.
	 * @param position - Position in the resource for which configuration has to be fetched.
	 * @param section - Section of the configuration.
	 *
	 */
	inspect<T>(resource: URI | undefined, position: IPosition | null, section: string): IConfigurationValue<Readonly<T>>;

	/**
	 * Update the configuration value for the given resource at the effective location.
	 *
	 * - If configurationTarget is not specified, target will be derived by checking where the configuration is defined.
	 * - If the language overrides for the give resource contains the configuration, then it is updated.
	 *
	 * @param resource Resource for which the configuration has to be updated
	 * @param key Configuration key
	 * @param value Configuration value
	 * @param configurationTarget Optional target into which the configuration has to be updated.
	 * If not specified, target will be derived by checking where the configuration is defined.
	 */
	updateValue(resource: URI | undefined, key: string, value: any, configurationTarget?: ConfigurationTarget): Promise<void>;

}

export const ITextResourcePropertiesService = createDecorator<ITextResourcePropertiesService>('textResourcePropertiesService');

export interface ITextResourcePropertiesService {

	readonly _serviceBrand: undefined;

	/**
	 * Returns the End of Line characters for the given resource
	 */
	getEOL(resource: URI, language?: string): string;
}
