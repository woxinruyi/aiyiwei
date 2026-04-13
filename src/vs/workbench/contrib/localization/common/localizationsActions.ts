/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 配置显示语言命令】
 *  本文件实现 "Configure Display Language" 命令（workbench.action.configureLocale），负责：
 *
 *  【核心职责】
 *  1. 注册命令到命令面板（Command Palette）
 *  2. 显示语言选择器 QuickPick 界面
 *  3. 处理用户选择并调用 ILocaleService 设置语言
 *  4. 显示语言包安装提示（如未安装）
 *
 *  【命令信息】
 *  - 命令 ID: workbench.action.configureLocale
 *  - 标题: "Configure Display Language"
 *  - 位置: Command Palette (Ctrl+Shift+P)
 *  - 描述: 基于已安装的语言包更改显示语言
 *
 *  【执行流程】
 *  ConfigureDisplayLanguageAction.run()
 *       │
 *       ├── 1. 获取服务实例
 *       │   ├─ languagePackService - 获取语言列表
 *       │   ├─ quickInputService - 显示选择器
 *       │   ├─ localeService - 设置语言
 *       │   └─ extensionWorkbenchService - 安装语言包
 *       │
 *       ├── 2. 获取已安装语言
 *       │   └─ languagePackService.getInstalledLanguages()
 *       │
 *       ├── 3. 创建 QuickPick
 *       │   ├─ 分隔符: "Installed"
 *       │   ├─ 已安装语言列表
 *       │   ├─ 分隔符: "Available"
 *       │   └─ 可用语言列表
 *       │
 *       ├── 4. 用户选择语言
 *       │   └─ onDidAccept 事件
 *       │
 *       └── 5. 设置语言
 *           └─ localeService.setLocale(selected)
 *               ├─ 检查语言包是否安装
 *               ├─ 如未安装 → 提示安装
 *               └─ 写入配置 → 提示重启
 *
 *  【与欢迎页面语言按钮的关系】
 *  - 欢迎页面直接调用 showLanguageSelector()（内部使用此命令）
 *  - 两种方式最终都执行相同逻辑
 *
 *  【使用场景】
 *  - 用户按 Ctrl+Shift+P 输入 "Configure Display Language"
 *  - 欢迎页面点击 🌐 Language 按钮
 *  - 设置面板选择语言配置
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { IQuickInputService, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILanguagePackItem, ILanguagePackService } from '../../../../platform/languagePacks/common/languagePacks.js';
import { ILocaleService } from '../../../services/localization/common/locale.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';

export class ConfigureDisplayLanguageAction extends Action2 {
	public static readonly ID = 'workbench.action.configureLocale';

	constructor() {
		super({
			id: ConfigureDisplayLanguageAction.ID,
			title: localize2('configureLocale', "Configure Display Language"),
			menu: {
				id: MenuId.CommandPalette
			},
			metadata: {
				description: localize2('configureLocaleDescription', "Changes the locale of VS Code based on installed language packs. Common languages include French, Chinese, Spanish, Japanese, German, Korean, and more.")
			}
		});
	}

	public async run(accessor: ServicesAccessor): Promise<void> {
		const languagePackService: ILanguagePackService = accessor.get(ILanguagePackService);
		const quickInputService: IQuickInputService = accessor.get(IQuickInputService);
		const localeService: ILocaleService = accessor.get(ILocaleService);
		const extensionWorkbenchService: IExtensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);

		const installedLanguages = await languagePackService.getInstalledLanguages();

		const disposables = new DisposableStore();
		const qp = disposables.add(quickInputService.createQuickPick<ILanguagePackItem>({ useSeparators: true }));
		qp.matchOnDescription = true;
		qp.placeholder = localize('chooseLocale', "Select Display Language");

		if (installedLanguages?.length) {
			const items: Array<ILanguagePackItem | IQuickPickSeparator> = [{ type: 'separator', label: localize('installed', "Installed") }];
			qp.items = items.concat(this.withMoreInfoButton(installedLanguages));
		}

		const source = new CancellationTokenSource();
		disposables.add(qp.onDispose(() => {
			source.cancel();
			disposables.dispose();
		}));

		const installedSet = new Set<string>(installedLanguages?.map(language => language.id!) ?? []);
		languagePackService.getAvailableLanguages().then(availableLanguages => {
			const newLanguages = availableLanguages.filter(l => l.id && !installedSet.has(l.id));
			if (newLanguages.length) {
				qp.items = [
					...qp.items,
					{ type: 'separator', label: localize('available', "Available") },
					...this.withMoreInfoButton(newLanguages)
				];
			}
			qp.busy = false;
		});

		disposables.add(qp.onDidAccept(async () => {
			const selectedLanguage = qp.activeItems[0] as ILanguagePackItem | undefined;
			if (selectedLanguage) {
				qp.hide();
				await localeService.setLocale(selectedLanguage);
			}
		}));

		disposables.add(qp.onDidTriggerItemButton(async e => {
			qp.hide();
			if (e.item.extensionId) {
				await extensionWorkbenchService.open(e.item.extensionId);
			}
		}));

		qp.show();
		qp.busy = true;
	}

	private withMoreInfoButton(items: ILanguagePackItem[]): ILanguagePackItem[] {
		for (const item of items) {
			if (item.extensionId) {
				item.buttons = [{
					tooltip: localize('moreInfo', "More Info"),
					iconClass: 'codicon-info'
				}];
			}
		}
		return items;
	}
}

export class ClearDisplayLanguageAction extends Action2 {
	public static readonly ID = 'workbench.action.clearLocalePreference';
	public static readonly LABEL = localize2('clearDisplayLanguage', "Clear Display Language Preference");

	constructor() {
		super({
			id: ClearDisplayLanguageAction.ID,
			title: ClearDisplayLanguageAction.LABEL,
			menu: {
				id: MenuId.CommandPalette
			}
		});
	}

	public async run(accessor: ServicesAccessor): Promise<void> {
		const localeService: ILocaleService = accessor.get(ILocaleService);
		await localeService.clearLocalePreference();
	}
}
