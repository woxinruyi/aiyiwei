/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 语言服务】
 *  本文件实现语言服务，负责管理编程语言的注册和语言特性请求：
 *
 *  【核心职责】
 *  1. 注册和管理编程语言定义
 *  2. 处理语言特性请求（基础特性、高级特性）
 *  3. 管理语言 ID 编解码器
 *  4. 触发语言注册表变更事件
 *  5. 支持语言选择器（ILanguageSelection）
 *
 *  【语言特性】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  基础语言特性（Basic Language Features）                 │
 *  │  - 自动关闭括号                                         │
 *  │  - 行注释                                               │
 *  │  - 单词定义                                             │
 *  │  - 触发字符                                             │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  高级语言特性（Rich Language Features）                  │
 *  │  - 语法高亮                                             │
 *  │  - 代码补全                                             │
 *  │  - 诊断/错误检查                                        │
 *  │  - 悬停提示                                             │
 *  │  - 代码导航                                             │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - registerLanguage(): 注册新语言
 *  - createById(): 按语言 ID 创建语言选择器
 *  - createByLanguageModeId(): 按模式 ID 创建
 *  - requestBasicLanguageFeatures(): 请求基础特性
 *  - requestRichLanguageFeatures(): 请求高级特性
 *
 *  【事件系统】
 *  - onDidChange: 语言注册表变更
 *  - onDidRequestBasicLanguageFeatures: 基础特性请求
 *  - onDidRequestRichLanguageFeatures: 高级特性请求
 *
 *  【使用场景】
 *  - 注册新的编程语言支持
 *  - 根据文件扩展名确定语言
 *  - 请求语言特性服务激活
 *  - 多语言混合编辑支持
 *
 *  【与 languagesRegistry.ts 的关系】
 *  - LanguageService 使用 LanguagesRegistry 管理语言定义
 *  - LanguagesRegistry 提供底层的语言注册功能
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { LanguagesRegistry } from './languagesRegistry.js';
import { ILanguageNameIdPair, ILanguageSelection, ILanguageService, ILanguageIcon, ILanguageExtensionPoint } from '../languages/language.js';
import { ILanguageIdCodec, TokenizationRegistry } from '../languages.js';
import { PLAINTEXT_LANGUAGE_ID } from '../languages/modesRegistry.js';
import { IObservable, observableFromEvent } from '../../../base/common/observable.js';

export class LanguageService extends Disposable implements ILanguageService {
	public _serviceBrand: undefined;

	static instanceCount = 0;

	private readonly _onDidRequestBasicLanguageFeatures = this._register(new Emitter<string>());
	public readonly onDidRequestBasicLanguageFeatures = this._onDidRequestBasicLanguageFeatures.event;

	private readonly _onDidRequestRichLanguageFeatures = this._register(new Emitter<string>());
	public readonly onDidRequestRichLanguageFeatures = this._onDidRequestRichLanguageFeatures.event;

	protected readonly _onDidChange = this._register(new Emitter<void>({ leakWarningThreshold: 200 /* https://github.com/microsoft/vscode/issues/119968 */ }));
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly _requestedBasicLanguages = new Set<string>();
	private readonly _requestedRichLanguages = new Set<string>();

	protected readonly _registry: LanguagesRegistry;
	public readonly languageIdCodec: ILanguageIdCodec;

	constructor(warnOnOverwrite = false) {
		super();
		LanguageService.instanceCount++;
		this._registry = this._register(new LanguagesRegistry(true, warnOnOverwrite));
		this.languageIdCodec = this._registry.languageIdCodec;
		this._register(this._registry.onDidChange(() => this._onDidChange.fire()));
	}

	public override dispose(): void {
		LanguageService.instanceCount--;
		super.dispose();
	}

	public registerLanguage(def: ILanguageExtensionPoint): IDisposable {
		return this._registry.registerLanguage(def);
	}

	public isRegisteredLanguageId(languageId: string | null | undefined): boolean {
		return this._registry.isRegisteredLanguageId(languageId);
	}

	public getRegisteredLanguageIds(): string[] {
		return this._registry.getRegisteredLanguageIds();
	}

	public getSortedRegisteredLanguageNames(): ILanguageNameIdPair[] {
		return this._registry.getSortedRegisteredLanguageNames();
	}

	public getLanguageName(languageId: string): string | null {
		return this._registry.getLanguageName(languageId);
	}

	public getMimeType(languageId: string): string | null {
		return this._registry.getMimeType(languageId);
	}

	public getIcon(languageId: string): ILanguageIcon | null {
		return this._registry.getIcon(languageId);
	}

	public getExtensions(languageId: string): ReadonlyArray<string> {
		return this._registry.getExtensions(languageId);
	}

	public getFilenames(languageId: string): ReadonlyArray<string> {
		return this._registry.getFilenames(languageId);
	}

	public getConfigurationFiles(languageId: string): ReadonlyArray<URI> {
		return this._registry.getConfigurationFiles(languageId);
	}

	public getLanguageIdByLanguageName(languageName: string): string | null {
		return this._registry.getLanguageIdByLanguageName(languageName);
	}

	public getLanguageIdByMimeType(mimeType: string | null | undefined): string | null {
		return this._registry.getLanguageIdByMimeType(mimeType);
	}

	public guessLanguageIdByFilepathOrFirstLine(resource: URI | null, firstLine?: string): string | null {
		const languageIds = this._registry.guessLanguageIdByFilepathOrFirstLine(resource, firstLine);
		return languageIds.at(0) ?? null;
	}

	public createById(languageId: string | null | undefined): ILanguageSelection {
		return new LanguageSelection(this.onDidChange, () => {
			return this._createAndGetLanguageIdentifier(languageId);
		});
	}

	public createByMimeType(mimeType: string | null | undefined): ILanguageSelection {
		return new LanguageSelection(this.onDidChange, () => {
			const languageId = this.getLanguageIdByMimeType(mimeType);
			return this._createAndGetLanguageIdentifier(languageId);
		});
	}

	public createByFilepathOrFirstLine(resource: URI | null, firstLine?: string): ILanguageSelection {
		return new LanguageSelection(this.onDidChange, () => {
			const languageId = this.guessLanguageIdByFilepathOrFirstLine(resource, firstLine);
			return this._createAndGetLanguageIdentifier(languageId);
		});
	}

	private _createAndGetLanguageIdentifier(languageId: string | null | undefined): string {
		if (!languageId || !this.isRegisteredLanguageId(languageId)) {
			// Fall back to plain text if language is unknown
			languageId = PLAINTEXT_LANGUAGE_ID;
		}

		return languageId;
	}

	public requestBasicLanguageFeatures(languageId: string): void {
		if (!this._requestedBasicLanguages.has(languageId)) {
			this._requestedBasicLanguages.add(languageId);
			this._onDidRequestBasicLanguageFeatures.fire(languageId);
		}
	}

	public requestRichLanguageFeatures(languageId: string): void {
		if (!this._requestedRichLanguages.has(languageId)) {
			this._requestedRichLanguages.add(languageId);

			// Ensure basic features are requested
			this.requestBasicLanguageFeatures(languageId);

			// Ensure tokenizers are created
			TokenizationRegistry.getOrCreate(languageId);

			this._onDidRequestRichLanguageFeatures.fire(languageId);
		}
	}
}

class LanguageSelection implements ILanguageSelection {
	private readonly _value: IObservable<string>;
	public readonly onDidChange: Event<string>;

	constructor(onDidChangeLanguages: Event<void>, selector: () => string) {
		this._value = observableFromEvent(this, onDidChangeLanguages, () => selector());
		this.onDidChange = Event.fromObservable(this._value);
	}

	public get languageId(): string {
		return this._value.get();
	}
}
