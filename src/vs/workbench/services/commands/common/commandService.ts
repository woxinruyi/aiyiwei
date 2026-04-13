/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作台命令服务】
 *  本文件实现工作台的命令服务，负责命令的注册、执行和扩展集成：
 *
 *  【核心职责】
 *  1. 实现 ICommandService 接口，提供命令执行功能
 *  2. 与扩展服务集成，支持扩展命令的延迟加载
 *  3. 处理命令执行前后的事件通知
 *  4. 管理扩展激活事件（* activation）
 *  5. 提供命令执行的超时保护
 *
 *  【与 platform/commands 的关系】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  CommandsRegistry（平台层）                            │
 *  │       ↑ 使用                                           │
 *  │  CommandService（工作台层）                            │
 *  │       ↑ 扩展支持                                       │
 *  │  扩展命令                                              │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【命令执行流程】
 *  1. 检查扩展服务是否就绪
 *  2. 触发 * activation 事件（等待最多 30s）
 *  3. 通过 CommandsRegistry 执行命令
 *  4. 触发执行前/后事件
 *
 *  【核心方法】
 *  - executeCommand(id, ...args): 执行命令
 *  - onWillExecuteCommand: 命令执行前事件
 *  - onDidExecuteCommand: 命令执行后事件
 *
 *  【使用场景】
 *  - 命令面板执行命令
 *  - 快捷键触发命令
 *  - 菜单项触发命令
 *  - 扩展调用其他命令
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService, ICommandEvent, CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { timeout } from '../../../../base/common/async.js';

export class CommandService extends Disposable implements ICommandService {

	declare readonly _serviceBrand: undefined;

	private _extensionHostIsReady: boolean = false;
	private _starActivation: Promise<void> | null;

	private readonly _onWillExecuteCommand: Emitter<ICommandEvent> = this._register(new Emitter<ICommandEvent>());
	public readonly onWillExecuteCommand: Event<ICommandEvent> = this._onWillExecuteCommand.event;

	private readonly _onDidExecuteCommand: Emitter<ICommandEvent> = new Emitter<ICommandEvent>();
	public readonly onDidExecuteCommand: Event<ICommandEvent> = this._onDidExecuteCommand.event;

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._extensionService.whenInstalledExtensionsRegistered().then(value => this._extensionHostIsReady = value);
		this._starActivation = null;
	}

	private _activateStar(): Promise<void> {
		if (!this._starActivation) {
			// wait for * activation, limited to at most 30s
			this._starActivation = Promise.race<any>([
				this._extensionService.activateByEvent(`*`),
				timeout(30000)
			]);
		}
		return this._starActivation;
	}

	async executeCommand<T>(id: string, ...args: any[]): Promise<T> {
		this._logService.trace('CommandService#executeCommand', id);

		const activationEvent = `onCommand:${id}`;
		const commandIsRegistered = !!CommandsRegistry.getCommand(id);

		if (commandIsRegistered) {

			// if the activation event has already resolved (i.e. subsequent call),
			// we will execute the registered command immediately
			if (this._extensionService.activationEventIsDone(activationEvent)) {
				return this._tryExecuteCommand(id, args);
			}

			// if the extension host didn't start yet, we will execute the registered
			// command immediately and send an activation event, but not wait for it
			if (!this._extensionHostIsReady) {
				this._extensionService.activateByEvent(activationEvent); // intentionally not awaited
				return this._tryExecuteCommand(id, args);
			}

			// we will wait for a simple activation event (e.g. in case an extension wants to overwrite it)
			await this._extensionService.activateByEvent(activationEvent);
			return this._tryExecuteCommand(id, args);
		}

		// finally, if the command is not registered we will send a simple activation event
		// as well as a * activation event raced against registration and against 30s
		await Promise.all([
			this._extensionService.activateByEvent(activationEvent),
			Promise.race<any>([
				// race * activation against command registration
				this._activateStar(),
				Event.toPromise(Event.filter(CommandsRegistry.onDidRegisterCommand, e => e === id))
			]),
		]);
		return this._tryExecuteCommand(id, args);
	}

	private _tryExecuteCommand(id: string, args: any[]): Promise<any> {
		const command = CommandsRegistry.getCommand(id);
		if (!command) {
			return Promise.reject(new Error(`command '${id}' not found`));
		}
		try {
			this._onWillExecuteCommand.fire({ commandId: id, args });
			const result = this._instantiationService.invokeFunction(command.handler, ...args);
			this._onDidExecuteCommand.fire({ commandId: id, args });
			return Promise.resolve(result);
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

registerSingleton(ICommandService, CommandService, InstantiationType.Delayed);
