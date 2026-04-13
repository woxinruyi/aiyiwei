/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 遥测服务接口】
 *  本文件定义遥测（Telemetry）服务的核心接口，用于收集应用使用数据：
 *
 *  【核心职责】
 *  1. 收集匿名使用数据（用户行为、功能使用情况）
 *  2. 发送错误遥测（崩溃、异常）
 *  3. 支持 GDPR 合规的数据分类
 *  4. 提供遥测级别控制（关闭、错误、全部）
 *
 *  【遥测级别】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  TelemetryLevel.NONE     - 关闭遥测                     │
 *  │  TelemetryLevel.ERROR    - 仅收集错误                   │
 *  │  TelemetryLevel.USAGE    - 收集使用和错误数据            │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - publicLog(eventName, data): 发送遥测事件
 *  - publicLog2(eventName, data): 带 GDPR 注解的遥测（推荐）
 *  - publicLogError(error): 发送错误遥测
 *
 *  【数据分类（GDPR）】
 *  - SystemMetaData: 系统元数据（匿名）
 *  - CallstackOrException: 调用栈或异常
 *  - FeatureInsight: 功能洞察
 *  - BusinessInsight: 业务洞察
 *  - PublicNonPersonalData: 公开非个人数据
 *  - EndUserPseudonymizedInformation: 最终用户假名信息
 *
 *  【标识符】
 *  - sessionId: 会话 ID（每次启动重新生成）
 *  - machineId: 机器 ID（重置后重新生成）
 *  - devDeviceId: 开发设备 ID
 *
 *  【隐私合规】
 *  - 遵守 GDPR 规范
 *  - 用户可随时关闭遥测
 *  - 不收集个人身份信息（PII）
 *
 *  【使用场景】
 *  - 记录功能使用情况（如欢迎页面打开次数）
 *  - 记录错误和崩溃
 *  - 收集性能指标
 *
 *  【与欢迎页面的关系】
 *  - 记录用户是否完成入门教程
 *  - 统计语言切换行为
 *  - 分析启动页面偏好
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ClassifiedEvent, IGDPRProperty, OmitMetadata, StrictPropertyCheck } from './gdprTypings.js';

export const ITelemetryService = createDecorator<ITelemetryService>('telemetryService');

export interface ITelemetryData {
	from?: string;
	target?: string;
	[key: string]: any;
}

export interface ITelemetryService {

	readonly _serviceBrand: undefined;

	readonly telemetryLevel: TelemetryLevel;

	readonly sessionId: string;
	readonly machineId: string;
	readonly sqmId: string;
	readonly devDeviceId: string;
	readonly firstSessionDate: string;
	readonly msftInternal?: boolean;

	/**
	 * Whether error telemetry will get sent. If false, `publicLogError` will no-op.
	 */
	readonly sendErrorTelemetry: boolean;

	/**
	 * @deprecated Use publicLog2 and the typescript GDPR annotation where possible
	 */
	publicLog(eventName: string, data?: ITelemetryData): void;

	/**
	 * Sends a telemetry event that has been privacy approved.
	 * Do not call this unless you have been given approval.
	 */
	publicLog2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>): void;

	/**
	 * @deprecated Use publicLogError2 and the typescript GDPR annotation where possible
	 */
	publicLogError(errorEventName: string, data?: ITelemetryData): void;

	publicLogError2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>): void;

	setExperimentProperty(name: string, value: string): void;
}

export interface ITelemetryEndpoint {
	id: string;
	aiKey: string;
	sendErrorTelemetry: boolean;
}

export const ICustomEndpointTelemetryService = createDecorator<ICustomEndpointTelemetryService>('customEndpointTelemetryService');

export interface ICustomEndpointTelemetryService {
	readonly _serviceBrand: undefined;

	publicLog(endpoint: ITelemetryEndpoint, eventName: string, data?: ITelemetryData): void;
	publicLogError(endpoint: ITelemetryEndpoint, errorEventName: string, data?: ITelemetryData): void;
}

// Keys
export const currentSessionDateStorageKey = 'telemetry.currentSessionDate';
export const firstSessionDateStorageKey = 'telemetry.firstSessionDate';
export const lastSessionDateStorageKey = 'telemetry.lastSessionDate';
export const machineIdKey = 'telemetry.machineId';
export const sqmIdKey = 'telemetry.sqmId';
export const devDeviceIdKey = 'telemetry.devDeviceId';

// Configuration Keys
export const TELEMETRY_SECTION_ID = 'telemetry';
export const TELEMETRY_SETTING_ID = 'telemetry.telemetryLevel';
export const TELEMETRY_CRASH_REPORTER_SETTING_ID = 'telemetry.enableCrashReporter';
export const TELEMETRY_OLD_SETTING_ID = 'telemetry.enableTelemetry';

export const enum TelemetryLevel {
	NONE = 0,
	CRASH = 1,
	ERROR = 2,
	USAGE = 3
}

export const enum TelemetryConfiguration {
	OFF = 'off',
	CRASH = 'crash',
	ERROR = 'error',
	ON = 'all'
}

export interface ICommonProperties {
	[name: string]: string | boolean | undefined;
}
