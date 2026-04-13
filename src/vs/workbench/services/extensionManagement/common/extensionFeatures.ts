/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 扩展特性注册表】
 *  本文件定义扩展详情页中特性展示的渲染系统，支持多种数据格式渲染：
 *
 *  【核心职责】
 *  1. 定义扩展特性渲染器接口（IExtensionFeatureRenderer）
 *  2. 支持 Markdown 格式渲染（IExtensionFeatureMarkdownRenderer）
 *  3. 支持表格格式渲染（IExtensionFeatureTableRenderer）
 *  4. 管理扩展特性注册表（ExtensionFeaturesRegistry）
 *  5. 处理扩展清单数据的渲染和展示
 *
 *  【渲染器类型】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Markdown 渲染器                                         │
 *  │  - 渲染 Markdown 格式的特性描述                          │
 *  │  - 支持富文本和链接                                      │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Table 渲染器                                            │
 *  │  - 渲染表格数据                                          │
 *  │  - 支持快捷键、颜色等复杂数据                            │
 *  │  - 表头和行数据自定义                                    │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - IExtensionFeatureRenderer: 基础渲染器接口
 *  - IExtensionFeatureMarkdownRenderer: Markdown 渲染器
 *  - IExtensionFeatureTableRenderer: 表格渲染器
 *  - IRenderedData<T>: 渲染数据包装器
 *
 *  【数据类型】
 *  - IRowData: 表格行数据（支持字符串、Markdown、快捷键、颜色）
 *  - ITableData: 表格数据（表头 + 行数据）
 *
 *  【使用场景】
 *  - 扩展详情页展示特性（Feature Contributions）
 *  - 快捷键绑定展示
 *  - 设置项展示
 *  - 自定义扩展信息展示
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { IMarkdownString } from '../../../../base/common/htmlContent.js';
import { Event } from '../../../../base/common/event.js';
import { ExtensionIdentifier, IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import Severity from '../../../../base/common/severity.js';
import { IStringDictionary } from '../../../../base/common/collections.js';
import { ResolvedKeybinding } from '../../../../base/common/keybindings.js';
import { Color } from '../../../../base/common/color.js';
import { ThemeIcon } from '../../../../base/common/themables.js';

export namespace Extensions {
	export const ExtensionFeaturesRegistry = 'workbench.registry.extensionFeatures';
}

export interface IExtensionFeatureRenderer extends IDisposable {
	type: string;
	shouldRender(manifest: IExtensionManifest): boolean;
	render(manifest: IExtensionManifest): IDisposable;
}

export interface IRenderedData<T> extends IDisposable {
	readonly data: T;
	readonly onDidChange?: Event<T>;
}

export interface IExtensionFeatureMarkdownRenderer extends IExtensionFeatureRenderer {
	type: 'markdown';
	render(manifest: IExtensionManifest): IRenderedData<IMarkdownString>;
}

export type IRowData = string | IMarkdownString | ResolvedKeybinding | Color | ReadonlyArray<ResolvedKeybinding | IMarkdownString | Color>;

export interface ITableData {
	headers: string[];
	rows: IRowData[][];
}

export interface IExtensionFeatureTableRenderer extends IExtensionFeatureRenderer {
	type: 'table';
	render(manifest: IExtensionManifest): IRenderedData<ITableData>;
}

export interface IExtensionFeatureMarkdownAndTableRenderer extends IExtensionFeatureRenderer {
	type: 'markdown+table';
	render(manifest: IExtensionManifest): IRenderedData<Array<IMarkdownString | ITableData>>;
}

export interface IExtensionFeatureDescriptor {
	readonly id: string;
	readonly label: string;
	// label of the access data, if different from the feature title.
	// This is useful when the feature is a part of a larger feature and the access data is not about the larger feature.
	// This is shown in the access chart like "There were ${accessCount} ${accessLabel} requests from this extension".
	readonly accessDataLabel?: string;
	readonly description?: string;
	readonly icon?: ThemeIcon;
	readonly access: {
		readonly canToggle?: boolean;
		readonly requireUserConsent?: boolean;
		readonly extensionsList?: IStringDictionary<boolean>;
	};
	readonly renderer?: SyncDescriptor<IExtensionFeatureRenderer>;
}

export interface IExtensionFeaturesRegistry {

	registerExtensionFeature(descriptor: IExtensionFeatureDescriptor): IDisposable;
	getExtensionFeature(id: string): IExtensionFeatureDescriptor | undefined;
	getExtensionFeatures(): ReadonlyArray<IExtensionFeatureDescriptor>;
}

export interface IExtensionFeatureAccessData {
	readonly current?: {
		readonly accessTimes: Date[];
		readonly lastAccessed: Date;
		readonly status?: { readonly severity: Severity; readonly message: string };
	};
	readonly accessTimes: Date[];
}

export const IExtensionFeaturesManagementService = createDecorator<IExtensionFeaturesManagementService>('IExtensionFeaturesManagementService');
export interface IExtensionFeaturesManagementService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeEnablement: Event<{ readonly extension: ExtensionIdentifier; readonly featureId: string; readonly enabled: boolean }>;
	isEnabled(extension: ExtensionIdentifier, featureId: string): boolean;
	setEnablement(extension: ExtensionIdentifier, featureId: string, enabled: boolean): void;
	getEnablementData(featureId: string): { readonly extension: ExtensionIdentifier; readonly enabled: boolean }[];

	getAccess(extension: ExtensionIdentifier, featureId: string, justification?: string): Promise<boolean>;

	readonly onDidChangeAccessData: Event<{ readonly extension: ExtensionIdentifier; readonly featureId: string; readonly accessData: IExtensionFeatureAccessData }>;
	getAllAccessDataForExtension(extension: ExtensionIdentifier): Map<string, IExtensionFeatureAccessData>;
	getAccessData(extension: ExtensionIdentifier, featureId: string): IExtensionFeatureAccessData | undefined;
	setStatus(extension: ExtensionIdentifier, featureId: string, status: { readonly severity: Severity; readonly message: string } | undefined): void;
}

class ExtensionFeaturesRegistry implements IExtensionFeaturesRegistry {

	private readonly extensionFeatures = new Map<string, IExtensionFeatureDescriptor>();

	registerExtensionFeature(descriptor: IExtensionFeatureDescriptor): IDisposable {
		if (this.extensionFeatures.has(descriptor.id)) {
			throw new Error(`Extension feature with id '${descriptor.id}' already exists`);
		}
		this.extensionFeatures.set(descriptor.id, descriptor);
		return {
			dispose: () => this.extensionFeatures.delete(descriptor.id)
		};
	}

	getExtensionFeature(id: string): IExtensionFeatureDescriptor | undefined {
		return this.extensionFeatures.get(id);
	}

	getExtensionFeatures(): ReadonlyArray<IExtensionFeatureDescriptor> {
		return Array.from(this.extensionFeatures.values());
	}
}

Registry.add(Extensions.ExtensionFeaturesRegistry, new ExtensionFeaturesRegistry());
