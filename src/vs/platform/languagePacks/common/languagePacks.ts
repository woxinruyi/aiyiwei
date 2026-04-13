/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 语言包服务接口】
 *  本文件定义语言包服务的抽象接口和基类，负责：
 *
 *  【核心职责】
 *  1. 定义 ILanguagePackService 接口 - 语言包服务的契约
 *  2. 提供 getAvailableLanguages() - 从扩展市场获取可用语言包
 *  3. 提供 getInstalledLanguages() - 获取已安装的语言包
 *  4. 提供 getBuiltInExtensionTranslationsUri() - 获取内置扩展翻译文件 URI
 *
 *  【架构设计】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │              ILanguagePackService (接口)                 │
 *  │                    ↑ 实现                                │
 *  │        LanguagePackBaseService (抽象基类)                │
 *  │                    ↑ 继承                                │
 *  │    ┌───────────────┴───────────────┐                  │
 *  │    │                              │                  │
 *  │  BrowserLanguagePackService   NativeLanguagePackService│
 *  │  (浏览器环境)                  (Electron 桌面环境)      │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【关键方法】
 *  - getAvailableLanguages(): 查询扩展市场获取可下载的语言包
 *  - getInstalledLanguages(): 获取本地已安装的语言包列表
 *  - getLocale(): 工具函数，从扩展标签提取语言代码（如 lp-zh-cn → zh-cn）
 *
 *  【扩展市场集成】
 *  - 通过 IExtensionGalleryService 查询语言包扩展
 *  - 语言包扩展使用 lp-{locale} 标签标识
 *  - 支持从 Microsoft 扩展市场下载
 *
 *  【使用场景】
 *  - 欢迎页面的语言选择器调用此服务
 *  - Configure Display Language 命令使用此服务
 *  - 应用启动时加载语言包
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { language } from '../../../base/common/platform.js';
import { URI } from '../../../base/common/uri.js';
import { IQuickPickItem } from '../../quickinput/common/quickInput.js';
import { localize } from '../../../nls.js';
import { IExtensionGalleryService, IGalleryExtension } from '../../extensionManagement/common/extensionManagement.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export function getLocale(extension: IGalleryExtension): string | undefined {
	return extension.tags.find(t => t.startsWith('lp-'))?.split('lp-')[1];
}

export const ILanguagePackService = createDecorator<ILanguagePackService>('languagePackService');

export interface ILanguagePackItem extends IQuickPickItem {
	readonly extensionId?: string;
	readonly galleryExtension?: IGalleryExtension;
}

export interface ILanguagePackService {
	readonly _serviceBrand: undefined;
	getAvailableLanguages(): Promise<Array<ILanguagePackItem>>;
	getInstalledLanguages(): Promise<Array<ILanguagePackItem>>;
	getBuiltInExtensionTranslationsUri(id: string, language: string): Promise<URI | undefined>;
}

export abstract class LanguagePackBaseService extends Disposable implements ILanguagePackService {
	declare readonly _serviceBrand: undefined;

	constructor(@IExtensionGalleryService protected readonly extensionGalleryService: IExtensionGalleryService) {
		super();
	}

	abstract getBuiltInExtensionTranslationsUri(id: string, language: string): Promise<URI | undefined>;

	abstract getInstalledLanguages(): Promise<Array<ILanguagePackItem>>;

	async getAvailableLanguages(): Promise<ILanguagePackItem[]> {
		const timeout = new CancellationTokenSource();
		setTimeout(() => timeout.cancel(), 1000);

		let result;
		try {
			result = await this.extensionGalleryService.query({
				text: 'category:"language packs"',
				pageSize: 20
			}, timeout.token);
		} catch (_) {
			// This method is best effort. So, we ignore any errors.
			return [];
		}

		const languagePackExtensions = result.firstPage.filter(e => e.properties.localizedLanguages?.length && e.tags.some(t => t.startsWith('lp-')));
		const allFromMarketplace: ILanguagePackItem[] = languagePackExtensions.map(lp => {
			const languageName = lp.properties.localizedLanguages?.[0];
			const locale = getLocale(lp)!;
			const baseQuickPick = this.createQuickPickItem(locale, languageName, lp);
			return {
				...baseQuickPick,
				extensionId: lp.identifier.id,
				galleryExtension: lp
			};
		});

		allFromMarketplace.push(this.createQuickPickItem('en', 'English'));

		return allFromMarketplace;
	}

	protected createQuickPickItem(locale: string, languageName?: string, languagePack?: IGalleryExtension): IQuickPickItem {
		const label = languageName ?? locale;
		let description: string | undefined;
		if (label !== locale) {
			description = `(${locale})`;
		}

		if (locale.toLowerCase() === language.toLowerCase()) {
			description ??= '';
			description += localize('currentDisplayLanguage', " (Current)");
		}

		if (languagePack?.installCount) {
			description ??= '';

			const count = languagePack.installCount;
			let countLabel: string;
			if (count > 1000000) {
				countLabel = `${Math.floor(count / 100000) / 10}M`;
			} else if (count > 1000) {
				countLabel = `${Math.floor(count / 1000)}K`;
			} else {
				countLabel = String(count);
			}
			description += ` $(cloud-download) ${countLabel}`;
		}

		return {
			id: locale,
			label,
			description
		};
	}
}
