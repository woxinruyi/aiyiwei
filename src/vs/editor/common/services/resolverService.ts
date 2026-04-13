/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 文本模型解析服务接口】
 *  本文件定义文本模型解析服务的核心接口，负责将 URI 解析为可编辑的文本模型：
 *
 *  【核心职责】
 *  1. 将资源 URI 解析为文本模型引用（createModelReference）
 *  2. 支持自定义 scheme 的内容提供者注册
 *  3. 管理文本模型的生命周期（引用计数）
 *  4. 提供模型解析能力检测（canHandleResource）
 *  5. 支持多种 URI scheme 的资源解析
 *
 *  【模型解析流程】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  1. 接收 URI                                            │
 *  │     └─ 如 file:///path/to/file.ts                     │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  2. 查找内容提供者                                      │
 *  │     └─ 根据 URI scheme 匹配注册提供者                  │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  3. 创建模型引用                                        │
 *  │     └─ 引用计数 +1                                      │
 *  │     └─ 返回 IReference<ITextEditorModel>               │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  4. 释放引用                                            │
 *  │     └─ 引用计数 -1                                      │
 *  │     └─ 计数为 0 时销毁模型                            │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【内容提供者】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  ITextModelContentProvider 接口：                       │
 *  │  - provideTextContent(resource): 提供文本内容          │
 *  │                                                          │
 *  │  内建提供者：                                             │
 *  │  - file:// 文件系统                                     │
 *  │  - untitled:// 未命名文件                               │
 *  │  - inMemory:// 内存文件                                  │
 *  │  - vscode-remote:// 远程文件                           │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心接口】
 *  - ITextModelService: 文本模型服务接口
 *  - ITextModelContentProvider: 内容提供者接口
 *  - ITextEditorModel: 编辑器模型接口
 *  - IResolvedTextEditorModel: 已解析的编辑器模型
 *
 *  【核心方法】
 *  - createModelReference(resource): 创建模型引用
 *  - registerTextModelContentProvider(scheme, provider): 注册内容提供者
 *  - canHandleResource(resource): 检查能否处理资源
 *
 *  【使用场景】
 *  - 编辑器打开文件时解析模型
 *  - 差异编辑器加载文件内容
 *  - 搜索服务获取文件内容
 *  - 预览编辑器显示内容
 *  - 扩展贡献自定义资源类型
 *
 *  【与 textModelResolverService.ts 的关系】
 *  - 本文件定义接口
 *  - workbench/services/textmodelResolver 实现服务
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IMarkdownString } from '../../../base/common/htmlContent.js';
import { IDisposable, IReference } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { ITextModel, ITextSnapshot } from '../model.js';
import { IResolvableEditorModel } from '../../../platform/editor/common/editor.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const ITextModelService = createDecorator<ITextModelService>('textModelService');

export interface ITextModelService {
	readonly _serviceBrand: undefined;

	/**
	 * Provided a resource URI, it will return a model reference
	 * which should be disposed once not needed anymore.
	 */
	createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>>;

	/**
	 * Registers a specific `scheme` content provider.
	 */
	registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable;

	/**
	 * Check if the given resource can be resolved to a text model.
	 */
	canHandleResource(resource: URI): boolean;
}

export interface ITextModelContentProvider {

	/**
	 * Given a resource, return the content of the resource as `ITextModel`.
	 */
	provideTextContent(resource: URI): Promise<ITextModel | null> | null;
}

export interface ITextEditorModel extends IResolvableEditorModel {

	/**
	 * Emitted when the text model is about to be disposed.
	 */
	readonly onWillDispose: Event<void>;

	/**
	 * Provides access to the underlying `ITextModel`.
	 */
	readonly textEditorModel: ITextModel | null;

	/**
	 * Creates a snapshot of the model's contents.
	 */
	createSnapshot(this: IResolvedTextEditorModel): ITextSnapshot;
	createSnapshot(this: ITextEditorModel): ITextSnapshot | null;

	/**
	 * Signals if this model is readonly or not.
	 */
	isReadonly(): boolean | IMarkdownString;

	/**
	 * The language id of the text model if known.
	 */
	getLanguageId(): string | undefined;

	/**
	 * Find out if this text model has been disposed.
	 */
	isDisposed(): boolean;
}

export interface IResolvedTextEditorModel extends ITextEditorModel {

	/**
	 * Same as ITextEditorModel#textEditorModel, but never null.
	 */
	readonly textEditorModel: ITextModel;
}

export function isResolvedTextEditorModel(model: ITextEditorModel): model is IResolvedTextEditorModel {
	const candidate = model as IResolvedTextEditorModel;

	return !!candidate.textEditorModel;
}
