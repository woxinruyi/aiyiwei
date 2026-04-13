/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 标记服务接口】
 *  本文件定义标记（Marker）服务接口，负责管理代码诊断、错误、警告等信息：
 *
 *  【核心职责】
 *  1. 管理代码标记（错误、警告、信息、提示）
 *  2. 支持按资源（URI）和所有者分类管理
 *  3. 提供标记统计信息
 *  4. 支持标记变更事件
 *  5. 资源过滤功能
 *
 *  【标记概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  标记表示代码中的诊断信息：                             │
 *  │  - 错误（Error）：编译错误、语法错误                   │
 *  │  - 警告（Warning）：潜在问题                             │
 *  │  - 信息（Info）：代码提示                                │
 *  │  - 提示（Hint）：风格建议                                │
 *  │                                                          │
 *  │  来源（Owner）：                                         │
 *  │  - TypeScript 语言服务器                                │
 *  │  - ESLint 扩展                                          │
 *  │  - 其他诊断提供者                                         │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【标记严重性】
 *  - Hint (1): 轻微提示
 *  - Info (2): 信息性消息
 *  - Warning (4): 警告
 *  - Error (8): 错误
 *
 *  【标记标签】
 *  - Unnecessary: 不必要的代码
 *  - Deprecated: 已弃用的 API
 *
 *  【核心接口】
 *  - IMarkerService: 标记服务接口
 *  - IMarkerData: 标记数据结构
 *  - IRelatedInformation: 相关信息
 *  - IResourceMarker: 资源标记
 *
 *  【核心方法】
 *  - changeOne(owner, resource, markers): 修改单个资源的标记
 *  - changeAll(owner, data): 批量修改标记
 *  - read(filter): 读取标记（支持过滤）
 *  - remove(owner, resources): 删除标记
 *  - getStatistics(): 获取统计信息
 *
 *  【使用场景】
 *  - 问题面板显示诊断信息
 *  - 编辑器内联错误显示
 *  - F8 导航到下一个错误
 *  - 构建任务输出解析
 *  - 扩展贡献诊断
 *
 *  【与 markerService.ts 的关系】
 *  - 本文件定义接口
 *  - markerService.ts 提供实现
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export interface IMarkerService {
	readonly _serviceBrand: undefined;

	getStatistics(): MarkerStatistics;

	changeOne(owner: string, resource: URI, markers: IMarkerData[]): void;

	changeAll(owner: string, data: IResourceMarker[]): void;

	remove(owner: string, resources: URI[]): void;

	read(filter?: { owner?: string; resource?: URI; severities?: number; take?: number }): IMarker[];

	installResourceFilter(resource: URI, reason: string): IDisposable;

	readonly onMarkerChanged: Event<readonly URI[]>;
}

/**
 *
 */
export interface IRelatedInformation {
	resource: URI;
	message: string;
	startLineNumber: number;
	startColumn: number;
	endLineNumber: number;
	endColumn: number;
}

export const enum MarkerTag {
	Unnecessary = 1,
	Deprecated = 2
}

export enum MarkerSeverity {
	Hint = 1,
	Info = 2,
	Warning = 4,
	Error = 8,
}

export namespace MarkerSeverity {

	export function compare(a: MarkerSeverity, b: MarkerSeverity): number {
		return b - a;
	}

	const _displayStrings: { [value: number]: string } = Object.create(null);
	_displayStrings[MarkerSeverity.Error] = localize('sev.error', "Error");
	_displayStrings[MarkerSeverity.Warning] = localize('sev.warning', "Warning");
	_displayStrings[MarkerSeverity.Info] = localize('sev.info', "Info");

	export function toString(a: MarkerSeverity): string {
		return _displayStrings[a] || '';
	}

	const _displayStringsPlural: { [value: number]: string } = Object.create(null);
	_displayStringsPlural[MarkerSeverity.Error] = localize('sev.errors', "Errors");
	_displayStringsPlural[MarkerSeverity.Warning] = localize('sev.warnings', "Warnings");
	_displayStringsPlural[MarkerSeverity.Info] = localize('sev.infos', "Infos");

	export function toStringPlural(a: MarkerSeverity): string {
		return _displayStringsPlural[a] || '';
	}

	export function fromSeverity(severity: Severity): MarkerSeverity {
		switch (severity) {
			case Severity.Error: return MarkerSeverity.Error;
			case Severity.Warning: return MarkerSeverity.Warning;
			case Severity.Info: return MarkerSeverity.Info;
			case Severity.Ignore: return MarkerSeverity.Hint;
		}
	}

	export function toSeverity(severity: MarkerSeverity): Severity {
		switch (severity) {
			case MarkerSeverity.Error: return Severity.Error;
			case MarkerSeverity.Warning: return Severity.Warning;
			case MarkerSeverity.Info: return Severity.Info;
			case MarkerSeverity.Hint: return Severity.Ignore;
		}
	}
}

/**
 * A structure defining a problem/warning/etc.
 */
export interface IMarkerData {
	code?: string | { value: string; target: URI };
	severity: MarkerSeverity;
	message: string;
	source?: string;
	startLineNumber: number;
	startColumn: number;
	endLineNumber: number;
	endColumn: number;
	modelVersionId?: number;
	relatedInformation?: IRelatedInformation[];
	tags?: MarkerTag[];
}

export interface IResourceMarker {
	resource: URI;
	marker: IMarkerData;
}

export interface IMarker {
	owner: string;
	resource: URI;
	severity: MarkerSeverity;
	code?: string | { value: string; target: URI };
	message: string;
	source?: string;
	startLineNumber: number;
	startColumn: number;
	endLineNumber: number;
	endColumn: number;
	modelVersionId?: number;
	relatedInformation?: IRelatedInformation[];
	tags?: MarkerTag[];
}

export interface MarkerStatistics {
	errors: number;
	warnings: number;
	infos: number;
	unknowns: number;
}

export namespace IMarkerData {
	const emptyString = '';
	export function makeKey(markerData: IMarkerData): string {
		return makeKeyOptionalMessage(markerData, true);
	}

	export function makeKeyOptionalMessage(markerData: IMarkerData, useMessage: boolean): string {
		const result: string[] = [emptyString];
		if (markerData.source) {
			result.push(markerData.source.replace('¦', '\\¦'));
		} else {
			result.push(emptyString);
		}
		if (markerData.code) {
			if (typeof markerData.code === 'string') {
				result.push(markerData.code.replace('¦', '\\¦'));
			} else {
				result.push(markerData.code.value.replace('¦', '\\¦'));
			}
		} else {
			result.push(emptyString);
		}
		if (markerData.severity !== undefined && markerData.severity !== null) {
			result.push(MarkerSeverity.toString(markerData.severity));
		} else {
			result.push(emptyString);
		}

		// Modifed to not include the message as part of the marker key to work around
		// https://github.com/microsoft/vscode/issues/77475
		if (markerData.message && useMessage) {
			result.push(markerData.message.replace('¦', '\\¦'));
		} else {
			result.push(emptyString);
		}
		if (markerData.startLineNumber !== undefined && markerData.startLineNumber !== null) {
			result.push(markerData.startLineNumber.toString());
		} else {
			result.push(emptyString);
		}
		if (markerData.startColumn !== undefined && markerData.startColumn !== null) {
			result.push(markerData.startColumn.toString());
		} else {
			result.push(emptyString);
		}
		if (markerData.endLineNumber !== undefined && markerData.endLineNumber !== null) {
			result.push(markerData.endLineNumber.toString());
		} else {
			result.push(emptyString);
		}
		if (markerData.endColumn !== undefined && markerData.endColumn !== null) {
			result.push(markerData.endColumn.toString());
		} else {
			result.push(emptyString);
		}
		result.push(emptyString);
		return result.join('¦');
	}
}

export const IMarkerService = createDecorator<IMarkerService>('markerService');
