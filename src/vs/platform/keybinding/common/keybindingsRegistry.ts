/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 快捷键注册系统】
 *  本文件实现 VSCode/Void 的快捷键注册和管理系统，提供跨平台的键绑定支持：
 *
 *  【核心职责】
 *  1. 定义快捷键项接口（IKeybindingItem）
 *  2. 支持跨平台快捷键（Windows/Linux/macOS）
 *  3. 实现快捷键权重系统（weight）
 *  4. 支持上下文条件（when）
 *  5. 管理命令与快捷键的关联
 *
 *  【快捷键结构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  IKeybindings - 快捷键定义                            │
 *  │  ├─ primary: 主快捷键                                 │
 *  │  ├─ secondary: 次要快捷键数组                         │
 *  │  ├─ win: Windows 特定快捷键                           │
 *  │  ├─ linux: Linux 特定快捷键                           │
 *  │  └─ mac: macOS 特定快捷键                             │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  IKeybindingRule - 快捷键规则                         │
 *  │  ├─ id: 命令 ID                                         │
 *  │  ├─ weight: 权重（用于冲突解决）                        │
 *  │  ├─ args: 命令参数                                      │
 *  │  └─ when: 上下文条件表达式                              │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【权重系统】
 *  - 内置命令：较高的权重
 *  - 扩展命令：中等权重
 *  - 用户自定义：最高权重（可覆盖内置）
 *
 *  【使用场景】
 *  - 注册编辑器快捷键（Ctrl+S 保存）
 *  - 注册工作台快捷键（Ctrl+Shift+P 命令面板）
 *  - 为命令添加上下文条件（仅在编辑器中生效）
 *  - 处理跨平台键绑定差异（Ctrl vs Cmd）
 *
 *  【与 keybinding.ts 的关系】
 *  - keybindingsRegistry.ts 定义注册结构
 *  - keybinding.ts 提供运行时查询和执行
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { decodeKeybinding, Keybinding } from '../../../base/common/keybindings.js';
import { OperatingSystem, OS } from '../../../base/common/platform.js';
import { CommandsRegistry, ICommandHandler, ICommandMetadata } from '../../commands/common/commands.js';
import { ContextKeyExpression } from '../../contextkey/common/contextkey.js';
import { Registry } from '../../registry/common/platform.js';
import { combinedDisposable, DisposableStore, IDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { LinkedList } from '../../../base/common/linkedList.js';

export interface IKeybindingItem {
	keybinding: Keybinding | null;
	command: string | null;
	commandArgs?: any;
	when: ContextKeyExpression | null | undefined;
	weight1: number;
	weight2: number;
	extensionId: string | null;
	isBuiltinExtension: boolean;
}

export interface IKeybindings {
	primary?: number;
	secondary?: number[];
	win?: {
		primary: number;
		secondary?: number[];
	};
	linux?: {
		primary: number;
		secondary?: number[];
	};
	mac?: {
		primary: number;
		secondary?: number[];
	};
}

export interface IKeybindingRule extends IKeybindings {
	id: string;
	weight: number;
	args?: any;
	/**
	 * Keybinding is disabled if expression returns false.
	 */
	when?: ContextKeyExpression | null | undefined;
}

export interface IExtensionKeybindingRule {
	keybinding: Keybinding | null;
	id: string;
	args?: any;
	weight: number;
	when: ContextKeyExpression | undefined;
	extensionId?: string;
	isBuiltinExtension?: boolean;
}

export const enum KeybindingWeight {
	EditorCore = 0,
	EditorContrib = 100,
	WorkbenchContrib = 200,
	BuiltinExtension = 300,
	ExternalExtension = 400,
	VoidExtension = 605, // Void -  must trump any external extension
}

export interface ICommandAndKeybindingRule extends IKeybindingRule {
	handler: ICommandHandler;
	metadata?: ICommandMetadata | null;
}

export interface IKeybindingsRegistry {
	registerKeybindingRule(rule: IKeybindingRule): IDisposable;
	setExtensionKeybindings(rules: IExtensionKeybindingRule[]): void;
	registerCommandAndKeybindingRule(desc: ICommandAndKeybindingRule): IDisposable;
	getDefaultKeybindings(): IKeybindingItem[];
}

/**
 * Stores all built-in and extension-provided keybindings (but not ones that user defines themselves)
 */
class KeybindingsRegistryImpl implements IKeybindingsRegistry {

	private _coreKeybindings: LinkedList<IKeybindingItem>;
	private _extensionKeybindings: IKeybindingItem[];
	private _cachedMergedKeybindings: IKeybindingItem[] | null;

	constructor() {
		this._coreKeybindings = new LinkedList();
		this._extensionKeybindings = [];
		this._cachedMergedKeybindings = null;
	}

	/**
	 * Take current platform into account and reduce to primary & secondary.
	 */
	private static bindToCurrentPlatform(kb: IKeybindings): { primary?: number; secondary?: number[] } {
		if (OS === OperatingSystem.Windows) {
			if (kb && kb.win) {
				return kb.win;
			}
		} else if (OS === OperatingSystem.Macintosh) {
			if (kb && kb.mac) {
				return kb.mac;
			}
		} else {
			if (kb && kb.linux) {
				return kb.linux;
			}
		}

		return kb;
	}

	public registerKeybindingRule(rule: IKeybindingRule): IDisposable {
		const actualKb = KeybindingsRegistryImpl.bindToCurrentPlatform(rule);
		const result = new DisposableStore();

		if (actualKb && actualKb.primary) {
			const kk = decodeKeybinding(actualKb.primary, OS);
			if (kk) {
				result.add(this._registerDefaultKeybinding(kk, rule.id, rule.args, rule.weight, 0, rule.when));
			}
		}

		if (actualKb && Array.isArray(actualKb.secondary)) {
			for (let i = 0, len = actualKb.secondary.length; i < len; i++) {
				const k = actualKb.secondary[i];
				const kk = decodeKeybinding(k, OS);
				if (kk) {
					result.add(this._registerDefaultKeybinding(kk, rule.id, rule.args, rule.weight, -i - 1, rule.when));
				}
			}
		}
		return result;
	}

	public setExtensionKeybindings(rules: IExtensionKeybindingRule[]): void {
		const result: IKeybindingItem[] = [];
		let keybindingsLen = 0;
		for (const rule of rules) {
			if (rule.keybinding) {
				result[keybindingsLen++] = {
					keybinding: rule.keybinding,
					command: rule.id,
					commandArgs: rule.args,
					when: rule.when,
					weight1: rule.weight,
					weight2: 0,
					extensionId: rule.extensionId || null,
					isBuiltinExtension: rule.isBuiltinExtension || false
				};
			}
		}

		this._extensionKeybindings = result;
		this._cachedMergedKeybindings = null;
	}

	public registerCommandAndKeybindingRule(desc: ICommandAndKeybindingRule): IDisposable {
		return combinedDisposable(
			this.registerKeybindingRule(desc),
			CommandsRegistry.registerCommand(desc)
		);
	}

	private _registerDefaultKeybinding(keybinding: Keybinding, commandId: string, commandArgs: any, weight1: number, weight2: number, when: ContextKeyExpression | null | undefined): IDisposable {
		const remove = this._coreKeybindings.push({
			keybinding: keybinding,
			command: commandId,
			commandArgs: commandArgs,
			when: when,
			weight1: weight1,
			weight2: weight2,
			extensionId: null,
			isBuiltinExtension: false
		});
		this._cachedMergedKeybindings = null;

		return toDisposable(() => {
			remove();
			this._cachedMergedKeybindings = null;
		});
	}

	public getDefaultKeybindings(): IKeybindingItem[] {
		if (!this._cachedMergedKeybindings) {
			this._cachedMergedKeybindings = Array.from(this._coreKeybindings).concat(this._extensionKeybindings);
			this._cachedMergedKeybindings.sort(sorter);
		}
		return this._cachedMergedKeybindings.slice(0);
	}
}
export const KeybindingsRegistry: IKeybindingsRegistry = new KeybindingsRegistryImpl();

// Define extension point ids
export const Extensions = {
	EditorModes: 'platform.keybindingsRegistry'
};
Registry.add(Extensions.EditorModes, KeybindingsRegistry);

function sorter(a: IKeybindingItem, b: IKeybindingItem): number {
	if (a.weight1 !== b.weight1) {
		return a.weight1 - b.weight1;
	}
	if (a.command && b.command) {
		if (a.command < b.command) {
			return -1;
		}
		if (a.command > b.command) {
			return 1;
		}
	}
	return a.weight2 - b.weight2;
}
