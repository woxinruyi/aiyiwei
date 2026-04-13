/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 区域设置服务接口】
 *  本文件定义区域设置（Locale）服务的核心接口，负责管理应用显示语言：
 *
 *  【核心职责】
 *  1. 设置应用显示语言（setLocale）
 *  2. 清除语言偏好设置（clearLocalePreference）
 *  3. 获取当前语言包扩展 ID（getExtensionIdProvidingCurrentLocale）
 *
 *  【服务架构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  ILocaleService（本接口）                              │
 *  │       ↑ 实现（Web）                                    │
 *  │  WebLocaleService - 使用 localStorage                  │
 *  │       ↑ 实现（Electron）                               │
 *  │  NativeLocaleService - 使用 argv.json                │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - setLocale(languagePackItem, skipDialog): 设置语言
 *    ├─ 修改 argv.json 中的 locale 字段
 *    ├─ 提示用户重启应用
 *    └─ 自动安装语言包扩展（如未安装）
 *  - clearLocalePreference(): 清除语言偏好
 *
 *  【与 electron-sandbox/localeService.ts 的关系】
 *  - 本文件定义接口
 *  - electron-sandbox/localeService.ts 实现接口（Electron 环境）
 *  - browser/localeService.ts 实现接口（Web 环境）
 *
 *  【使用场景】
 *  - 用户在欢迎页面点击语言按钮
 *  - localizationsActions.ts 调用设置语言
 *  - 应用启动时读取语言配置
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILanguagePackItem } from '../../../../platform/languagePacks/common/languagePacks.js';

export const ILocaleService = createDecorator<ILocaleService>('localizationService');

export interface ILocaleService {
	readonly _serviceBrand: undefined;
	setLocale(languagePackItem: ILanguagePackItem, skipDialog?: boolean): Promise<void>;
	clearLocalePreference(): Promise<void>;
}

export const IActiveLanguagePackService = createDecorator<IActiveLanguagePackService>('activeLanguageService');

export interface IActiveLanguagePackService {
	readonly _serviceBrand: undefined;
	getExtensionIdProvidingCurrentLocale(): Promise<string | undefined>;
}
