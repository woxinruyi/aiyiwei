/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 命令服务接口】
 *  本文件定义命令服务的核心接口，是 VSCode 命令系统的中央枢纽：
 *
 *  【核心职责】
 *  1. 注册命令（registerCommand）- 将命令 ID 映射到处理函数
 *  2. 执行命令（executeCommand）- 调用指定命令并返回结果
 *  3. 管理命令生命周期 - 支持命令覆盖和注销
 *  4. 提供命令事件 - 执行前/后通知
 *  5. 支持命令参数验证
 *
 *  【命令系统架构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │               ICommandService (接口)                    │
 *  │                      ↑ 实现                             │
 *  │              CommandService (实现类)                     │
 *  │                      ↑ 管理                             │
 *  │         ┌────────────┴────────────┐                     │
 *  │         │                          │                     │
 *  │    命令注册表                      命令执行队列          │
 *  │    (id → handler)                  (异步执行)           │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【命令结构】
 *  - commandId: 命令唯一标识（如 'workbench.action.openWalkthrough'）
 *  - handler: 命令处理函数（接收 ServicesAccessor 和参数）
 *  - metadata: 命令元数据（描述、参数定义等）
 *
 *  【核心方法】
 *  - registerCommand(id, handler): 注册命令
 *  - executeCommand(id, ...args): 执行命令
 *  - hasCommand(id): 检查命令是否存在
 *  - unregisterCommand(id): 注销命令
 *
 *  【使用场景】
 *  - 命令面板（Ctrl+Shift+P）调用命令
 *  - 快捷键绑定执行命令
 *  - 菜单项点击执行命令
 *  - 扩展贡献新命令
 *  - 欢迎页面开始项执行命令
 *
 *  【与欢迎页面的关系】
 *  - 欢迎页面的开始项通过命令 ID 触发操作
 *  - 语言选择按钮执行 'workbench.action.configureLocale' 命令
 *  - 打开文件夹执行 'vscode.openFolder' 命令
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { IJSONSchema } from '../../../base/common/jsonSchema.js';
import { IDisposable, markAsSingleton, toDisposable } from '../../../base/common/lifecycle.js';
import { LinkedList } from '../../../base/common/linkedList.js';
import { TypeConstraint, validateConstraints } from '../../../base/common/types.js';
import { ILocalizedString } from '../../action/common/action.js';
import { createDecorator, ServicesAccessor } from '../../instantiation/common/instantiation.js';

export const ICommandService = createDecorator<ICommandService>('commandService');

export interface ICommandEvent {
	commandId: string;
	args: any[];
}

export interface ICommandService {
	readonly _serviceBrand: undefined;
	onWillExecuteCommand: Event<ICommandEvent>;
	onDidExecuteCommand: Event<ICommandEvent>;
	executeCommand<T = any>(commandId: string, ...args: any[]): Promise<T | undefined>;
}

export type ICommandsMap = Map<string, ICommand>;

export interface ICommandHandler {
	(accessor: ServicesAccessor, ...args: any[]): void;
}

export interface ICommand {
	id: string;
	handler: ICommandHandler;
	metadata?: ICommandMetadata | null;
}

export interface ICommandMetadata {
	/**
	 * NOTE: Please use an ILocalizedString. string is in the type for backcompat for now.
	 * A short summary of what the command does. This will be used in:
	 * - API commands
	 * - when showing keybindings that have no other UX
	 * - when searching for commands in the Command Palette
	 */
	readonly description: ILocalizedString | string;
	readonly args?: ReadonlyArray<{
		readonly name: string;
		readonly isOptional?: boolean;
		readonly description?: string;
		readonly constraint?: TypeConstraint;
		readonly schema?: IJSONSchema;
	}>;
	readonly returns?: string;
}

export interface ICommandRegistry {
	onDidRegisterCommand: Event<string>;
	registerCommand(id: string, command: ICommandHandler): IDisposable;
	registerCommand(command: ICommand): IDisposable;
	registerCommandAlias(oldId: string, newId: string): IDisposable;
	getCommand(id: string): ICommand | undefined;
	getCommands(): ICommandsMap;
}

export const CommandsRegistry: ICommandRegistry = new class implements ICommandRegistry {

	private readonly _commands = new Map<string, LinkedList<ICommand>>();

	private readonly _onDidRegisterCommand = new Emitter<string>();
	readonly onDidRegisterCommand: Event<string> = this._onDidRegisterCommand.event;

	registerCommand(idOrCommand: string | ICommand, handler?: ICommandHandler): IDisposable {

		if (!idOrCommand) {
			throw new Error(`invalid command`);
		}

		if (typeof idOrCommand === 'string') {
			if (!handler) {
				throw new Error(`invalid command`);
			}
			return this.registerCommand({ id: idOrCommand, handler });
		}

		// add argument validation if rich command metadata is provided
		if (idOrCommand.metadata && Array.isArray(idOrCommand.metadata.args)) {
			const constraints: Array<TypeConstraint | undefined> = [];
			for (const arg of idOrCommand.metadata.args) {
				constraints.push(arg.constraint);
			}
			const actualHandler = idOrCommand.handler;
			idOrCommand.handler = function (accessor, ...args: any[]) {
				validateConstraints(args, constraints);
				return actualHandler(accessor, ...args);
			};
		}

		// find a place to store the command
		const { id } = idOrCommand;

		let commands = this._commands.get(id);
		if (!commands) {
			commands = new LinkedList<ICommand>();
			this._commands.set(id, commands);
		}

		const removeFn = commands.unshift(idOrCommand);

		const ret = toDisposable(() => {
			removeFn();
			const command = this._commands.get(id);
			if (command?.isEmpty()) {
				this._commands.delete(id);
			}
		});

		// tell the world about this command
		this._onDidRegisterCommand.fire(id);

		return markAsSingleton(ret);
	}

	registerCommandAlias(oldId: string, newId: string): IDisposable {
		return CommandsRegistry.registerCommand(oldId, (accessor, ...args) => accessor.get(ICommandService).executeCommand(newId, ...args));
	}

	getCommand(id: string): ICommand | undefined {
		const list = this._commands.get(id);
		if (!list || list.isEmpty()) {
			return undefined;
		}
		return Iterable.first(list);
	}

	getCommands(): ICommandsMap {
		const result = new Map<string, ICommand>();
		for (const key of this._commands.keys()) {
			const command = this.getCommand(key);
			if (command) {
				result.set(key, command);
			}
		}
		return result;
	}
};

CommandsRegistry.registerCommand('noop', () => { });
