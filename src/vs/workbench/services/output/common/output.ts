/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 输出服务接口】
 *  本文件定义输出面板的核心接口和常量，负责管理扩展和系统的输出日志：
 *
 *  【核心职责】
 *  1. 定义输出编辑器的 MIME 类型和模式 ID
 *  2. 定义输出视图的唯一标识符
 *  3. 提供输出相关的上下文键（Context Keys）
 *  4. 支持日志级别过滤和滚动锁定
 *  5. 管理多个输出通道（Output Channels）
 *
 *  【输出类型】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  普通输出（Output）                                     │
 *  │  - 扩展的输出通道                                        │
 *  │  - MIME: text/x-code-output                              │
 *  │  - Mode ID: Log                                          │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  日志输出（Log Output）                                 │
 *  │  - 系统日志文件                                          │
 *  │  - MIME: text/x-code-log-output                          │
 *  │  - Mode ID: log                                          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【上下文键】
 *  - CONTEXT_IN_OUTPUT: 是否在输出面板
 *  - CONTEXT_ACTIVE_FILE_OUTPUT: 是否是活动文件输出
 *  - CONTEXT_ACTIVE_LOG_FILE_OUTPUT: 是否是日志文件输出
 *  - CONTEXT_ACTIVE_OUTPUT_LEVEL: 当前日志级别
 *  - CONTEXT_OUTPUT_SCROLL_LOCK: 滚动锁定状态
 *
 *  【日志级别过滤】
 *  - SHOW_TRACE_FILTER_CONTEXT: 显示 Trace 级别
 *  - SHOW_DEBUG_FILTER_CONTEXT: 显示 Debug 级别
 *  - SHOW_INFO_FILTER_CONTEXT: 显示 Info 级别
 *  - SHOW_WARNING_FILTER_CONTEXT: 显示 Warning 级别
 *
 *  【使用场景】
 *  - 查看扩展日志输出
 *  - 查看 Git 操作日志
 *  - 查看语言服务器日志
 *  - 调试时查看详细日志
 *
 *  【与 workbench.panel.output 的关系】
 *  - 输出面板 ID: workbench.panel.output
 *  - 位于底部面板区域
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from '../../../../base/common/event.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { LogLevel } from '../../../../platform/log/common/log.js';
import { Range } from '../../../../editor/common/core/range.js';

/**
 * Mime type used by the output editor.
 */
export const OUTPUT_MIME = 'text/x-code-output';

/**
 * Id used by the output editor.
 */
export const OUTPUT_MODE_ID = 'Log';

/**
 * Mime type used by the log output editor.
 */
export const LOG_MIME = 'text/x-code-log-output';

/**
 * Id used by the log output editor.
 */
export const LOG_MODE_ID = 'log';

/**
 * Output view id
 */
export const OUTPUT_VIEW_ID = 'workbench.panel.output';

export const CONTEXT_IN_OUTPUT = new RawContextKey<boolean>('inOutput', false);
export const CONTEXT_ACTIVE_FILE_OUTPUT = new RawContextKey<boolean>('activeLogOutput', false);
export const CONTEXT_ACTIVE_LOG_FILE_OUTPUT = new RawContextKey<boolean>('activeLogOutput.isLog', false);
export const CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE = new RawContextKey<boolean>('activeLogOutput.levelSettable', false);
export const CONTEXT_ACTIVE_OUTPUT_LEVEL = new RawContextKey<string>('activeLogOutput.level', '');
export const CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT = new RawContextKey<boolean>('activeLogOutput.levelIsDefault', false);
export const CONTEXT_OUTPUT_SCROLL_LOCK = new RawContextKey<boolean>(`outputView.scrollLock`, false);
export const ACTIVE_OUTPUT_CHANNEL_CONTEXT = new RawContextKey<string>('activeOutputChannel', '');
export const SHOW_TRACE_FILTER_CONTEXT = new RawContextKey<boolean>('output.filter.trace', true);
export const SHOW_DEBUG_FILTER_CONTEXT = new RawContextKey<boolean>('output.filter.debug', true);
export const SHOW_INFO_FILTER_CONTEXT = new RawContextKey<boolean>('output.filter.info', true);
export const SHOW_WARNING_FILTER_CONTEXT = new RawContextKey<boolean>('output.filter.warning', true);
export const SHOW_ERROR_FILTER_CONTEXT = new RawContextKey<boolean>('output.filter.error', true);
export const OUTPUT_FILTER_FOCUS_CONTEXT = new RawContextKey<boolean>('outputFilterFocus', false);
export const HIDE_CATEGORY_FILTER_CONTEXT = new RawContextKey<string>('output.filter.categories', '');

export interface IOutputViewFilters {
	readonly onDidChange: Event<void>;
	text: string;
	trace: boolean;
	debug: boolean;
	info: boolean;
	warning: boolean;
	error: boolean;
	categories: string;
	toggleCategory(category: string): void;
	hasCategory(category: string): boolean;
}

export const IOutputService = createDecorator<IOutputService>('outputService');

/**
 * The output service to manage output from the various processes running.
 */
export interface IOutputService {
	readonly _serviceBrand: undefined;

	/**
	 *  Output view filters.
	 */
	readonly filters: IOutputViewFilters;

	/**
	 * Given the channel id returns the output channel instance.
	 * Channel should be first registered via OutputChannelRegistry.
	 */
	getChannel(id: string): IOutputChannel | undefined;

	/**
	 * Given the channel id returns the registered output channel descriptor.
	 */
	getChannelDescriptor(id: string): IOutputChannelDescriptor | undefined;

	/**
	 * Returns an array of all known output channels descriptors.
	 */
	getChannelDescriptors(): IOutputChannelDescriptor[];

	/**
	 * Returns the currently active channel.
	 * Only one channel can be active at a given moment.
	 */
	getActiveChannel(): IOutputChannel | undefined;

	/**
	 * Show the channel with the passed id.
	 */
	showChannel(id: string, preserveFocus?: boolean): Promise<void>;

	/**
	 * Allows to register on active output channel change.
	 */
	onActiveOutputChannel: Event<string>;

	/**
	 * Register a compound log channel with the given channels.
	 */
	registerCompoundLogChannel(channels: IOutputChannelDescriptor[]): string;

	/**
	 * Save the logs to a file.
	 */
	saveOutputAs(...channels: IOutputChannelDescriptor[]): Promise<void>;

	/**
	 * Checks if the log level can be set for the given channel.
	 * @param channel
	 */
	canSetLogLevel(channel: IOutputChannelDescriptor): boolean;

	/**
	 * Returns the log level for the given channel.
	 * @param channel
	 */
	getLogLevel(channel: IOutputChannelDescriptor): LogLevel | undefined;

	/**
	 * Sets the log level for the given channel.
	 * @param channel
	 * @param logLevel
	 */
	setLogLevel(channel: IOutputChannelDescriptor, logLevel: LogLevel): void;
}

export enum OutputChannelUpdateMode {
	Append = 1,
	Replace,
	Clear
}

export interface ILogEntry {
	readonly range: Range;
	readonly timestamp: number;
	readonly timestampRange: Range;
	readonly logLevel: LogLevel;
	readonly logLevelRange: Range;
	readonly category: string | undefined;
}

export interface IOutputChannel {

	/**
	 * Identifier of the output channel.
	 */
	readonly id: string;

	/**
	 * Label of the output channel to be displayed to the user.
	 */
	readonly label: string;

	/**
	 * URI of the output channel.
	 */
	readonly uri: URI;

	/**
	 * Log entries of the output channel.
	 */
	getLogEntries(): readonly ILogEntry[];

	/**
	 * Appends output to the channel.
	 */
	append(output: string): void;

	/**
	 * Clears all received output for this channel.
	 */
	clear(): void;

	/**
	 * Replaces the content of the channel with given output
	 */
	replace(output: string): void;

	/**
	 * Update the channel.
	 */
	update(mode: OutputChannelUpdateMode.Append): void;
	update(mode: OutputChannelUpdateMode, till: number): void;

	/**
	 * Disposes the output channel.
	 */
	dispose(): void;
}

export const Extensions = {
	OutputChannels: 'workbench.contributions.outputChannels'
};

export interface IOutputChannelDescriptor {
	id: string;
	label: string;
	log: boolean;
	languageId?: string;
	source?: IOutputContentSource | ReadonlyArray<IOutputContentSource>;
	extensionId?: string;
	user?: boolean;
}

export interface ISingleSourceOutputChannelDescriptor extends IOutputChannelDescriptor {
	source: IOutputContentSource;
}

export interface IMultiSourceOutputChannelDescriptor extends IOutputChannelDescriptor {
	source: ReadonlyArray<IOutputContentSource>;
}

export function isSingleSourceOutputChannelDescriptor(descriptor: IOutputChannelDescriptor): descriptor is ISingleSourceOutputChannelDescriptor {
	return !!descriptor.source && !Array.isArray(descriptor.source);
}

export function isMultiSourceOutputChannelDescriptor(descriptor: IOutputChannelDescriptor): descriptor is IMultiSourceOutputChannelDescriptor {
	return Array.isArray(descriptor.source);
}

export interface IOutputContentSource {
	readonly name?: string;
	readonly resource: URI;
}

export interface IOutputChannelRegistry {

	readonly onDidRegisterChannel: Event<string>;
	readonly onDidRemoveChannel: Event<IOutputChannelDescriptor>;
	readonly onDidUpdateChannelSources: Event<IMultiSourceOutputChannelDescriptor>;

	/**
	 * Make an output channel known to the output world.
	 */
	registerChannel(descriptor: IOutputChannelDescriptor): void;

	/**
	 * Update the files for the given output channel.
	 */
	updateChannelSources(id: string, sources: IOutputContentSource[]): void;

	/**
	 * Returns the list of channels known to the output world.
	 */
	getChannels(): IOutputChannelDescriptor[];

	/**
	 * Returns the channel with the passed id.
	 */
	getChannel(id: string): IOutputChannelDescriptor | undefined;

	/**
	 * Remove the output channel with the passed id.
	 */
	removeChannel(id: string): void;
}

class OutputChannelRegistry implements IOutputChannelRegistry {
	private channels = new Map<string, IOutputChannelDescriptor>();

	private readonly _onDidRegisterChannel = new Emitter<string>();
	readonly onDidRegisterChannel = this._onDidRegisterChannel.event;

	private readonly _onDidRemoveChannel = new Emitter<IOutputChannelDescriptor>();
	readonly onDidRemoveChannel = this._onDidRemoveChannel.event;

	private readonly _onDidUpdateChannelFiles = new Emitter<IMultiSourceOutputChannelDescriptor>();
	readonly onDidUpdateChannelSources = this._onDidUpdateChannelFiles.event;

	public registerChannel(descriptor: IOutputChannelDescriptor): void {
		if (!this.channels.has(descriptor.id)) {
			this.channels.set(descriptor.id, descriptor);
			this._onDidRegisterChannel.fire(descriptor.id);
		}
	}

	public getChannels(): IOutputChannelDescriptor[] {
		const result: IOutputChannelDescriptor[] = [];
		this.channels.forEach(value => result.push(value));
		return result;
	}

	public getChannel(id: string): IOutputChannelDescriptor | undefined {
		return this.channels.get(id);
	}

	public updateChannelSources(id: string, sources: IOutputContentSource[]): void {
		const channel = this.channels.get(id);
		if (channel && isMultiSourceOutputChannelDescriptor(channel)) {
			channel.source = sources;
			this._onDidUpdateChannelFiles.fire(channel);
		}
	}

	public removeChannel(id: string): void {
		const channel = this.channels.get(id);
		if (channel) {
			this.channels.delete(id);
			this._onDidRemoveChannel.fire(channel);
		}
	}
}

Registry.add(Extensions.OutputChannels, new OutputChannelRegistry());
