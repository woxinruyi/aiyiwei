/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 嵌入式终端服务】
 *  本文件定义嵌入式终端服务，用于在终端贡献模块加载前创建终端：
 *
 *  【核心职责】
 *  1. 在终端贡献模块可用前管理终端创建
 *  2. 提供伪终端（Pseudoterminal）接口给嵌入者
 *  3. 支持自定义 PTY 实现
 *  4. 管理终端生命周期事件
 *  5. 桥接嵌入者和终端系统
 *
 *  【嵌入式终端概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  嵌入式终端用于以下场景：                               │
 *  │  - VS Code Web 版（如 vscode.dev）                      │
 *  │  - 嵌入式编辑器场景                                      │
 *  │  - 需要在终端服务就绪前创建终端的情况                    │
 *  │                                                          │
 *  │  特点：                                                   │
 *  │  - 不依赖本地 shell                                       │
 *  │  - 使用自定义 PTY 实现                                    │
 *  │  - 由嵌入者提供终端逻辑                                   │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【伪终端接口】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  IEmbedderTerminalPty - 伪终端接口                     │
 *  │  - onDidWrite: 终端输出事件                             │
 *  │  - onDidClose: 终端关闭事件                             │
 *  │  - onDidChangeName: 终端名称变更                        │
 *  │  - open(): 打开终端                                     │
 *  │  - close(): 关闭终端                                    │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - IEmbedderTerminalService: 嵌入式终端服务接口
 *  - IEmbedderTerminalOptions: 终端创建选项
 *  - IEmbedderTerminalPty: 伪终端接口
 *  - EmbedderTerminal: 终端类型定义
 *
 *  【核心方法】
 *  - createTerminal(options): 创建嵌入式终端
 *  - onDidCreateTerminal: 终端创建事件
 *
 *  【使用场景】
 *  - VS Code for Web 的终端实现
 *  - 远程开发环境的终端
 *  - 自定义终端集成
 *  - 需要在启动时立即创建终端的场景
 *
 *  【与 terminal.ts 的关系】
 *  - 使用 platform/terminal/common/terminal.ts 中的类型
 *  - 提供简化的终端接口给嵌入者
 *
 *  【限制】
 *  - 暂不支持 iconPath、color、location 等高级选项
 *  - 暂不支持 onDidOverrideDimensions 事件
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IProcessDataEvent, IProcessProperty, IProcessPropertyMap, IProcessReadyEvent, IShellLaunchConfig, ITerminalChildProcess, ITerminalLaunchError, ProcessPropertyType } from '../../../../platform/terminal/common/terminal.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

export const IEmbedderTerminalService = createDecorator<IEmbedderTerminalService>('embedderTerminalService');

/**
 * Manages terminals that the embedder can create before the terminal contrib is available.
 */
export interface IEmbedderTerminalService {
	readonly _serviceBrand: undefined;

	readonly onDidCreateTerminal: Event<IShellLaunchConfig>;

	createTerminal(options: IEmbedderTerminalOptions): void;
}

export type EmbedderTerminal = IShellLaunchConfig & Required<Pick<IShellLaunchConfig, 'customPtyImplementation'>>;

export interface IEmbedderTerminalOptions {
	name: string;
	pty: IEmbedderTerminalPty;

	// Extension APIs that have not been implemented for embedders:
	//   iconPath?: URI | { light: URI; dark: URI } | ThemeIcon;
	//   color?: ThemeColor;
	//   location?: TerminalLocation | TerminalEditorLocationOptions | TerminalSplitLocationOptions;
	//   isTransient?: boolean;
}

/**
 * See Pseudoterminal on the vscode API for usage.
 */
export interface IEmbedderTerminalPty {
	onDidWrite: Event<string>;
	onDidClose?: Event<void | number>;
	onDidChangeName?: Event<string>;

	open(): void;
	close(): void;

	// Extension APIs that have not been implemented for embedders:
	//   onDidOverrideDimensions?: Event<TerminalDimensions | undefined>;
	//   handleInput?(data: string): void;
	//   setDimensions?(dimensions: TerminalDimensions): void;
}

class EmbedderTerminalService implements IEmbedderTerminalService {
	declare _serviceBrand: undefined;

	private readonly _onDidCreateTerminal = new Emitter<IShellLaunchConfig>();
	readonly onDidCreateTerminal = Event.buffer(this._onDidCreateTerminal.event);

	createTerminal(options: IEmbedderTerminalOptions): void {
		const slc: EmbedderTerminal = {
			name: options.name,
			isFeatureTerminal: true,
			customPtyImplementation(terminalId, cols, rows) {
				return new EmbedderTerminalProcess(terminalId, options.pty);
			},
		};
		this._onDidCreateTerminal.fire(slc);
	}
}


class EmbedderTerminalProcess extends Disposable implements ITerminalChildProcess {
	private readonly _pty: IEmbedderTerminalPty;

	readonly shouldPersist = false;

	readonly onProcessData: Event<IProcessDataEvent | string>;
	private readonly _onProcessReady = this._register(new Emitter<IProcessReadyEvent>());
	readonly onProcessReady = this._onProcessReady.event;
	private readonly _onDidChangeProperty = this._register(new Emitter<IProcessProperty<any>>());
	readonly onDidChangeProperty = this._onDidChangeProperty.event;
	private readonly _onProcessExit = this._register(new Emitter<number | undefined>());
	readonly onProcessExit = this._onProcessExit.event;

	constructor(
		readonly id: number,
		pty: IEmbedderTerminalPty
	) {
		super();

		this._pty = pty;
		this.onProcessData = this._pty.onDidWrite;
		if (this._pty.onDidClose) {
			this._register(this._pty.onDidClose(e => this._onProcessExit.fire(e || undefined)));
		}
		if (this._pty.onDidChangeName) {
			this._register(this._pty.onDidChangeName(e => this._onDidChangeProperty.fire({
				type: ProcessPropertyType.Title,
				value: e
			})));
		}
	}

	async start(): Promise<ITerminalLaunchError | undefined> {
		this._onProcessReady.fire({ pid: -1, cwd: '', windowsPty: undefined });
		this._pty.open();
		return undefined;
	}
	shutdown(): void {
		this._pty.close();
	}

	// TODO: A lot of these aren't useful for some implementations of ITerminalChildProcess, should
	// they be optional? Should there be a base class for "external" consumers to implement?

	input(): void {
		// not supported
	}
	async processBinary(): Promise<void> {
		// not supported
	}
	resize(): void {
		// no-op
	}
	clearBuffer(): void | Promise<void> {
		// no-op
	}
	acknowledgeDataEvent(): void {
		// no-op, flow control not currently implemented
	}
	async setUnicodeVersion(): Promise<void> {
		// no-op
	}
	async getInitialCwd(): Promise<string> {
		return '';
	}
	async getCwd(): Promise<string> {
		return '';
	}
	refreshProperty<T extends ProcessPropertyType>(property: ProcessPropertyType): Promise<IProcessPropertyMap[T]> {
		throw new Error(`refreshProperty is not suppported in EmbedderTerminalProcess. property: ${property}`);
	}

	updateProperty(property: ProcessPropertyType, value: any): Promise<void> {
		throw new Error(`updateProperty is not suppported in EmbedderTerminalProcess. property: ${property}, value: ${value}`);
	}
}

registerSingleton(IEmbedderTerminalService, EmbedderTerminalService, InstantiationType.Delayed);
