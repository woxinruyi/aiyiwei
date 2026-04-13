/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 差异编辑器输入】
 *  本文件实现差异编辑器（Diff Editor）的输入类，用于比较两个文件版本：
 *
 *  【核心职责】
 *  1. 组合原始版本和修改版本的编辑器输入
 *  2. 提供差异比较视图的标题和描述
 *  3. 支持文本和二进制文件的差异比较
 *  4. 管理差异编辑器的生命周期
 *  5. 支持并排（Side-by-Side）和内联（Inline）两种差异视图
 *
 *  【差异编辑器概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  DiffEditorInput 由两个编辑器输入组成                   │
 *  │                                                          │
 *  │  ┌──────────────┐              ┌──────────────┐       │
 *  │  │  Original    │              │  Modified    │       │
 *  │  │  原始版本    │     VS       │  修改版本    │       │
 *  │  │  (左侧)     │              │  (右侧)     │       │
 *  │  └──────────────┘              └──────────────┘       │
 *  │                                                          │
 *  │  用途：                                                    │
 *  │  - Git 版本控制：工作区 vs 暂存区                        │
 *  │  - Git 历史比较：commit A vs commit B                    │
 *  │  - 文件比较：任意两个文件的差异                          │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【编辑器类型】
 *  - TEXT_DIFF_EDITOR_ID: 文本差异编辑器
 *  - BINARY_DIFF_EDITOR_ID: 二进制文件差异编辑器（不支持内容比较）
 *
 *  【核心方法】
 *  - getName(): 获取差异编辑器标题（如"文件A ↔ 文件B"）
 *  - getTitle(verbosity): 获取不同详细程度的标题
 *  - resolve(): 解析为 DiffEditorModel
 *  - serialize(): 序列化保存状态
 *
 *  【继承关系】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  EditorInput（编辑器输入基类）                          │
 *  │       ↑ 继承                                            │
 *  │  SideBySideEditorInput（并排编辑器输入）               │
 *  │       ↑ 继承                                            │
 *  │  DiffEditorInput（本类）                                │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【使用场景】
 *  - Git 源代码管理：查看文件变更
 *  - 版本历史：比较不同版本
 *  - 文件比较：任意两个文件
 *  - 代码审查：查看 Pull Request 差异
 *
 *  【与 sideBySideEditorInput.ts 的关系】
 *  - 继承 SideBySideEditorInput 的并排显示逻辑
 *  - 添加差异比较特定的功能（标题、描述）
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../nls.js';
import { AbstractSideBySideEditorInputSerializer, SideBySideEditorInput } from './sideBySideEditorInput.js';
import { EditorInput, IUntypedEditorOptions } from './editorInput.js';
import { EditorModel } from './editorModel.js';
import { TEXT_DIFF_EDITOR_ID, BINARY_DIFF_EDITOR_ID, Verbosity, IEditorDescriptor, IEditorPane, IResourceDiffEditorInput, IUntypedEditorInput, isResourceDiffEditorInput, IDiffEditorInput, IResourceSideBySideEditorInput, EditorInputCapabilities } from '../editor.js';
import { BaseTextEditorModel } from './textEditorModel.js';
import { DiffEditorModel } from './diffEditorModel.js';
import { TextDiffEditorModel } from './textDiffEditorModel.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { shorten } from '../../../base/common/labels.js';
import { isResolvedEditorModel } from '../../../platform/editor/common/editor.js';

interface IDiffEditorInputLabels {
	readonly name: string;

	readonly shortDescription: string | undefined;
	readonly mediumDescription: string | undefined;
	readonly longDescription: string | undefined;

	readonly forceDescription: boolean;

	readonly shortTitle: string;
	readonly mediumTitle: string;
	readonly longTitle: string;
}

/**
 * The base editor input for the diff editor. It is made up of two editor inputs, the original version
 * and the modified version.
 */
export class DiffEditorInput extends SideBySideEditorInput implements IDiffEditorInput {

	static override readonly ID: string = 'workbench.editors.diffEditorInput';

	override get typeId(): string {
		return DiffEditorInput.ID;
	}

	override get editorId(): string | undefined {
		return this.modified.editorId === this.original.editorId ? this.modified.editorId : undefined;
	}

	override get capabilities(): EditorInputCapabilities {
		let capabilities = super.capabilities;

		// Force description capability depends on labels
		if (this.labels.forceDescription) {
			capabilities |= EditorInputCapabilities.ForceDescription;
		}

		return capabilities;
	}

	private cachedModel: DiffEditorModel | undefined = undefined;

	private readonly labels: IDiffEditorInputLabels;

	constructor(
		preferredName: string | undefined,
		preferredDescription: string | undefined,
		readonly original: EditorInput,
		readonly modified: EditorInput,
		private readonly forceOpenAsBinary: boolean | undefined,
		@IEditorService editorService: IEditorService
	) {
		super(preferredName, preferredDescription, original, modified, editorService);

		this.labels = this.computeLabels();
	}

	private computeLabels(): IDiffEditorInputLabels {

		// Name
		let name: string;
		let forceDescription = false;
		if (this.preferredName) {
			name = this.preferredName;
		} else {
			const originalName = this.original.getName();
			const modifiedName = this.modified.getName();

			name = localize('sideBySideLabels', "{0} ↔ {1}", originalName, modifiedName);

			// Enforce description when the names are identical
			forceDescription = originalName === modifiedName;
		}

		// Description
		let shortDescription: string | undefined;
		let mediumDescription: string | undefined;
		let longDescription: string | undefined;
		if (this.preferredDescription) {
			shortDescription = this.preferredDescription;
			mediumDescription = this.preferredDescription;
			longDescription = this.preferredDescription;
		} else {
			shortDescription = this.computeLabel(this.original.getDescription(Verbosity.SHORT), this.modified.getDescription(Verbosity.SHORT));
			longDescription = this.computeLabel(this.original.getDescription(Verbosity.LONG), this.modified.getDescription(Verbosity.LONG));

			// Medium Description: try to be verbose by computing
			// a label that resembles the difference between the two
			const originalMediumDescription = this.original.getDescription(Verbosity.MEDIUM);
			const modifiedMediumDescription = this.modified.getDescription(Verbosity.MEDIUM);
			if (
				(typeof originalMediumDescription === 'string' && typeof modifiedMediumDescription === 'string') && // we can only `shorten` when both sides are strings...
				(originalMediumDescription || modifiedMediumDescription) 											// ...however never when both sides are empty strings
			) {
				const [shortenedOriginalMediumDescription, shortenedModifiedMediumDescription] = shorten([originalMediumDescription, modifiedMediumDescription]);
				mediumDescription = this.computeLabel(shortenedOriginalMediumDescription, shortenedModifiedMediumDescription);
			}
		}

		// Title
		let shortTitle = this.computeLabel(this.original.getTitle(Verbosity.SHORT) ?? this.original.getName(), this.modified.getTitle(Verbosity.SHORT) ?? this.modified.getName(), ' ↔ ');
		let mediumTitle = this.computeLabel(this.original.getTitle(Verbosity.MEDIUM) ?? this.original.getName(), this.modified.getTitle(Verbosity.MEDIUM) ?? this.modified.getName(), ' ↔ ');
		let longTitle = this.computeLabel(this.original.getTitle(Verbosity.LONG) ?? this.original.getName(), this.modified.getTitle(Verbosity.LONG) ?? this.modified.getName(), ' ↔ ');

		const preferredTitle = this.getPreferredTitle();
		if (preferredTitle) {
			shortTitle = `${preferredTitle} (${shortTitle})`;
			mediumTitle = `${preferredTitle} (${mediumTitle})`;
			longTitle = `${preferredTitle} (${longTitle})`;
		}

		return { name, shortDescription, mediumDescription, longDescription, forceDescription, shortTitle, mediumTitle, longTitle };
	}

	private computeLabel(originalLabel: string, modifiedLabel: string, separator?: string): string;
	private computeLabel(originalLabel: string | undefined, modifiedLabel: string | undefined, separator?: string): string | undefined;
	private computeLabel(originalLabel: string | undefined, modifiedLabel: string | undefined, separator = ' - '): string | undefined {
		if (!originalLabel || !modifiedLabel) {
			return undefined;
		}

		if (originalLabel === modifiedLabel) {
			return modifiedLabel;
		}

		return `${originalLabel}${separator}${modifiedLabel}`;
	}

	override getName(): string {
		return this.labels.name;
	}

	override getDescription(verbosity = Verbosity.MEDIUM): string | undefined {
		switch (verbosity) {
			case Verbosity.SHORT:
				return this.labels.shortDescription;
			case Verbosity.LONG:
				return this.labels.longDescription;
			case Verbosity.MEDIUM:
			default:
				return this.labels.mediumDescription;
		}
	}

	override getTitle(verbosity?: Verbosity): string {
		switch (verbosity) {
			case Verbosity.SHORT:
				return this.labels.shortTitle;
			case Verbosity.LONG:
				return this.labels.longTitle;
			default:
			case Verbosity.MEDIUM:
				return this.labels.mediumTitle;
		}
	}

	override async resolve(): Promise<EditorModel> {

		// Create Model - we never reuse our cached model if refresh is true because we cannot
		// decide for the inputs within if the cached model can be reused or not. There may be
		// inputs that need to be loaded again and thus we always recreate the model and dispose
		// the previous one - if any.
		const resolvedModel = await this.createModel();
		this.cachedModel?.dispose();

		this.cachedModel = resolvedModel;

		return this.cachedModel;
	}

	override prefersEditorPane<T extends IEditorDescriptor<IEditorPane>>(editorPanes: T[]): T | undefined {
		if (this.forceOpenAsBinary) {
			return editorPanes.find(editorPane => editorPane.typeId === BINARY_DIFF_EDITOR_ID);
		}

		return editorPanes.find(editorPane => editorPane.typeId === TEXT_DIFF_EDITOR_ID);
	}

	private async createModel(): Promise<DiffEditorModel> {

		// Join resolve call over two inputs and build diff editor model
		const [originalEditorModel, modifiedEditorModel] = await Promise.all([
			this.original.resolve(),
			this.modified.resolve()
		]);

		// If both are text models, return textdiffeditor model
		if (modifiedEditorModel instanceof BaseTextEditorModel && originalEditorModel instanceof BaseTextEditorModel) {
			return new TextDiffEditorModel(originalEditorModel, modifiedEditorModel);
		}

		// Otherwise return normal diff model
		return new DiffEditorModel(isResolvedEditorModel(originalEditorModel) ? originalEditorModel : undefined, isResolvedEditorModel(modifiedEditorModel) ? modifiedEditorModel : undefined);
	}

	override toUntyped(options?: IUntypedEditorOptions): (IResourceDiffEditorInput & IResourceSideBySideEditorInput) | undefined {
		const untyped = super.toUntyped(options);
		if (untyped) {
			return {
				...untyped,
				modified: untyped.primary,
				original: untyped.secondary
			};
		}

		return undefined;
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (this === otherInput) {
			return true;
		}

		if (otherInput instanceof DiffEditorInput) {
			return this.modified.matches(otherInput.modified) && this.original.matches(otherInput.original) && otherInput.forceOpenAsBinary === this.forceOpenAsBinary;
		}

		if (isResourceDiffEditorInput(otherInput)) {
			return this.modified.matches(otherInput.modified) && this.original.matches(otherInput.original);
		}

		return false;
	}

	override dispose(): void {

		// Free the diff editor model but do not propagate the dispose() call to the two inputs
		// We never created the two inputs (original and modified) so we can not dispose
		// them without sideeffects.
		if (this.cachedModel) {
			this.cachedModel.dispose();
			this.cachedModel = undefined;
		}

		super.dispose();
	}
}

export class DiffEditorInputSerializer extends AbstractSideBySideEditorInputSerializer {

	protected createEditorInput(instantiationService: IInstantiationService, name: string | undefined, description: string | undefined, secondaryInput: EditorInput, primaryInput: EditorInput): EditorInput {
		return instantiationService.createInstance(DiffEditorInput, name, description, secondaryInput, primaryInput, undefined);
	}
}
