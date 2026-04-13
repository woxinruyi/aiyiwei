/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 编辑器模型服务】
 *  本文件定义文本模型管理的核心接口，负责管理编辑器中的文本内容：
 *
 *  【核心职责】
 *  1. 创建文本模型（createModel）- 将文件内容加载为可编辑模型
 *  2. 更新文本模型（updateModel）- 更新模型内容
 *  3. 销毁文本模型（destroyModel）- 释放资源
 *  4. 管理模型生命周期（添加、移除事件）
 *  5. 支持多语言模型（根据语言 ID）
 *
 *  【模型概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  ITextModel - 文本模型代表一个可编辑的文档              │
 *  │  - 存储文本内容                                         │
 *  │  - 维护编辑历史（撤销/重做）                            │
 *  │  - 支持语法高亮                                         │
 *  │  - 管理行号和光标位置                                   │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - createModel(value, language, resource): 创建新模型
 *  - updateModel(model, value): 更新模型内容
 *  - destroyModel(resource): 销毁指定 URI 的模型
 *  - getModel(resource): 获取指定 URI 的模型
 *  - getModels(): 获取所有模型
 *
 *  【事件系统】
 *  - onModelAdded: 模型添加事件
 *  - onModelRemoved: 模型移除事件
 *  - onModelLanguageChanged: 语言变更事件
 *
 *  【使用场景】
 *  - 打开文件时创建文本模型
 *  - 保存文件时更新模型
 *  - 关闭编辑器时销毁模型
 *  - 语言切换时更新模型语言
 *
 *  【与编辑器的关系】
 *  - CodeEditor 显示 ITextModel 的内容
 *  - 编辑器操作（输入、删除）修改模型
 *  - 模型变更触发编辑器重绘
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { URI } from '../../../base/common/uri.js';
import { ITextBufferFactory, ITextModel, ITextModelCreationOptions } from '../model.js';
import { ILanguageSelection } from '../languages/language.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { DocumentSemanticTokensProvider, DocumentRangeSemanticTokensProvider } from '../languages.js';

export const IModelService = createDecorator<IModelService>('modelService');

export type DocumentTokensProvider = DocumentSemanticTokensProvider | DocumentRangeSemanticTokensProvider;

export interface IModelService {
	readonly _serviceBrand: undefined;

	createModel(value: string | ITextBufferFactory, languageSelection: ILanguageSelection | null, resource?: URI, isForSimpleWidget?: boolean): ITextModel;

	updateModel(model: ITextModel, value: string | ITextBufferFactory): void;

	destroyModel(resource: URI): void;

	getModels(): ITextModel[];

	getCreationOptions(language: string, resource: URI, isForSimpleWidget: boolean): ITextModelCreationOptions;

	getModel(resource: URI): ITextModel | null;

	readonly onModelAdded: Event<ITextModel>;

	readonly onModelRemoved: Event<ITextModel>;

	readonly onModelLanguageChanged: Event<{ readonly model: ITextModel; readonly oldLanguageId: string }>;
}
