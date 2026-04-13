/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作台快速输入服务】
 *  本文件实现工作台的快速输入服务，继承自平台基础实现并添加工作台特定功能：
 *
 *  【核心职责】
 *  1. 继承平台 QuickInputService 基础功能
 *  2. 添加上下文键管理（InQuickPickContextKey）
 *  3. 集成快捷键服务显示返回键绑定
 *  4. 响应配置变更（closeOnFocusLost）
 *
 *  【继承关系】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  IQuickInputService（接口）                            │
 *  │       ↑ 继承                                           │
 *  │  QuickInputService（平台基础实现）                     │
 *  │       ↑ 继承                                           │
 *  │  QuickInputService（本文件-工作台实现）                │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【上下文键】
 *  - inQuickInputContext: 标记是否正在显示 QuickInput
 *  - onShow: 显示时设置为 true
 *  - onHide: 隐藏时设置为 false
 *
 *  【配置项】
 *  - workbench.quickOpen.closeOnFocusLost: 失去焦点时关闭
 *
 *  【快捷键】
 *  - 显示返回键的快捷键提示（workbench.action.quickInputBack）
 *
 *  【使用场景】
 *  - 命令面板（Ctrl+Shift+P）
 *  - 快速文件导航（Ctrl+P）
 *  - 语言选择器
 *
 *  【与平台服务的关系】
 *  - 本文件扩展平台 QuickInputService
 *  - 添加工作台特定的上下文和配置
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { QuickInputController } from '../../../../platform/quickinput/browser/quickInputController.js';
import { QuickInputService as BaseQuickInputService } from '../../../../platform/quickinput/browser/quickInputService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { InQuickPickContextKey } from '../../../browser/quickaccess.js';

export class QuickInputService extends BaseQuickInputService {

	private readonly inQuickInputContext = InQuickPickContextKey.bindTo(this.contextKeyService);

	constructor(
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
	) {
		super(instantiationService, contextKeyService, themeService, layoutService, configurationService);

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.onShow(() => this.inQuickInputContext.set(true)));
		this._register(this.onHide(() => this.inQuickInputContext.set(false)));
	}

	protected override createController(): QuickInputController {
		return super.createController(this.layoutService, {
			ignoreFocusOut: () => !this.configurationService.getValue('workbench.quickOpen.closeOnFocusLost'),
			backKeybindingLabel: () => this.keybindingService.lookupKeybinding('workbench.action.quickInputBack')?.getLabel() || undefined,
		});
	}
}

registerSingleton(IQuickInputService, QuickInputService, InstantiationType.Delayed);
