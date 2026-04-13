/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 快捷键服务接口】
 *  本文件定义快捷键服务的核心接口，负责：
 *
 *  【核心职责】
 *  1. 注册和解析快捷键绑定（Keybinding）
 *  2. 处理键盘事件（IKeyboardEvent）
 *  3. 根据上下文（Context Key）决定快捷键是否可用
 *  4. 支持用户自定义快捷键（keybindings.json）
 *  5. 提供快捷键冲突检测
 *
 *  【关键接口】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │              IKeybindingService (接口)                 │
 *  │                     ↑ 实现                             │
 *  │         WorkbenchKeybindingService (实现类)             │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - registerKeybinding(): 注册快捷键
 *  - resolve(): 解析快捷键对应的命令
 *  - dispatchEvent(): 分发键盘事件
 *  - customKeybindingsCount(): 获取用户自定义快捷键数量
 *
 *  【键盘事件结构】
 *  IKeyboardEvent {
 *    ctrlKey: boolean,      // Ctrl 是否按下
 *    shiftKey: boolean,     // Shift 是否按下
 *    altKey: boolean,       // Alt 是否按下
 *    metaKey: boolean,      // Meta (Cmd/Win) 是否按下
 *    keyCode: KeyCode,      // 按键代码
 *    code: string           // 物理按键代码
 *  }
 *
 *  【快捷键绑定格式】
 *  IUserFriendlyKeybinding {
 *    key: "ctrl+shift+p",   // 快捷键组合
 *    command: "workbench.action.showCommands", // 命令 ID
 *    when: "editorTextFocus", // 上下文条件
 *    args: {}               // 可选参数
 *  }
 *
 *  【使用场景】
 *  - Ctrl+Shift+P: 打开命令面板
 *  - Ctrl+L: Void 侧边栏快捷键
 *  - Ctrl+K: Void 快速编辑
 *
 *  【与欢迎页面的关系】
 *  - 欢迎页面的开始项可以通过快捷键触发
 *  - 语言选择命令可以通过快捷键调用
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IJSONSchema } from '../../../base/common/jsonSchema.js';
import { KeyCode } from '../../../base/common/keyCodes.js';
import { ResolvedKeybinding, Keybinding } from '../../../base/common/keybindings.js';
import { IContextKeyService, IContextKeyServiceTarget } from '../../contextkey/common/contextkey.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ResolutionResult } from './keybindingResolver.js';
import { ResolvedKeybindingItem } from './resolvedKeybindingItem.js';

export interface IUserFriendlyKeybinding {
	key: string;
	command: string;
	args?: any;
	when?: string;
}

export interface IKeyboardEvent {
	readonly _standardKeyboardEventBrand: true;

	readonly ctrlKey: boolean;
	readonly shiftKey: boolean;
	readonly altKey: boolean;
	readonly metaKey: boolean;
	readonly altGraphKey: boolean;
	readonly keyCode: KeyCode;
	readonly code: string;
}

export interface KeybindingsSchemaContribution {
	readonly onDidChange?: Event<void>;

	getSchemaAdditions(): IJSONSchema[];
}

export const IKeybindingService = createDecorator<IKeybindingService>('keybindingService');

export interface IKeybindingService {
	readonly _serviceBrand: undefined;

	readonly inChordMode: boolean;

	onDidUpdateKeybindings: Event<void>;

	/**
	 * Returns none, one or many (depending on keyboard layout)!
	 */
	resolveKeybinding(keybinding: Keybinding): ResolvedKeybinding[];

	resolveKeyboardEvent(keyboardEvent: IKeyboardEvent): ResolvedKeybinding;

	resolveUserBinding(userBinding: string): ResolvedKeybinding[];

	/**
	 * Resolve and dispatch `keyboardEvent` and invoke the command.
	 */
	dispatchEvent(e: IKeyboardEvent, target: IContextKeyServiceTarget): boolean;

	/**
	 * Resolve and dispatch `keyboardEvent`, but do not invoke the command or change inner state.
	 */
	softDispatch(keyboardEvent: IKeyboardEvent, target: IContextKeyServiceTarget): ResolutionResult;

	/**
	 * Enable hold mode for this command. This is only possible if the command is current being dispatched, meaning
	 * we are after its keydown and before is keyup event.
	 *
	 * @returns A promise that resolves when hold stops, returns undefined if hold mode could not be enabled.
	 */
	enableKeybindingHoldMode(commandId: string): Promise<void> | undefined;

	dispatchByUserSettingsLabel(userSettingsLabel: string, target: IContextKeyServiceTarget): void;

	/**
	 * Look up keybindings for a command.
	 * Use `lookupKeybinding` if you are interested in the preferred keybinding.
	 */
	lookupKeybindings(commandId: string): ResolvedKeybinding[];

	/**
	 * Look up the preferred (last defined) keybinding for a command.
	 * @returns The preferred keybinding or null if the command is not bound.
	 */
	lookupKeybinding(commandId: string, context?: IContextKeyService, enforceContextCheck?: boolean): ResolvedKeybinding | undefined;

	getDefaultKeybindingsContent(): string;

	getDefaultKeybindings(): readonly ResolvedKeybindingItem[];

	getKeybindings(): readonly ResolvedKeybindingItem[];

	customKeybindingsCount(): number;

	/**
	 * Will the given key event produce a character that's rendered on screen, e.g. in a
	 * text box. *Note* that the results of this function can be incorrect.
	 */
	mightProducePrintableCharacter(event: IKeyboardEvent): boolean;

	registerSchemaContribution(contribution: KeybindingsSchemaContribution): void;

	toggleLogging(): boolean;

	_dumpDebugInfo(): string;
	_dumpDebugInfoJSON(): string;
}
