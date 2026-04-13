/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 产品服务接口】
 *  本文件定义产品配置服务，提供应用的基本信息和元数据：
 *
 *  【核心职责】
 *  1. 提供产品基本信息（名称、版本、ID）
 *  2. 读取 product.json 配置
 *  3. 暴露产品特性开关和配置
 *
 *  【产品配置内容】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  基本信息                                               │
 *  │  - nameShort: "Void"                                    │
 *  │  - nameLong: "Void"                                     │
 *  │  - version: "1.99.3"                                    │
 *  │  - applicationName: "void"                            │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  功能开关                                               │
 *  │  - extensionEnabledApiProposals: 扩展 API 提案           │
 *  │  - builtInExtensions: 内置扩展列表                      │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  链接和文档                                             │
 *  │  - documentationUrl: 文档链接                         │
 *  │  - releaseNotesUrl: 发布说明链接                        │
 *  │  - licenseUrl: 许可证链接                               │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【使用场景】
 *  - 欢迎页面显示产品名称和版本
 *  - 检查产品特性是否启用
 *  - 获取产品相关链接
 *  - 区分不同产品变体（VSCode, Void 等）
 *
 *  【与欢迎页面的关系】
 *  - gettingStarted.ts 使用 productService.nameLong 显示标题
 *  - 产品信息在欢迎页面头部显示
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { IProductConfiguration } from '../../../base/common/product.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IProductService = createDecorator<IProductService>('productService');

export interface IProductService extends Readonly<IProductConfiguration> {

	readonly _serviceBrand: undefined;

}

export const productSchemaId = 'vscode://schemas/vscode-product';
