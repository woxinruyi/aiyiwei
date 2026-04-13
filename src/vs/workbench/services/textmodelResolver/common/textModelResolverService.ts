/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 文本模型解析服务】
 *  本文件实现文本模型解析服务，负责将 URI 解析为可编辑的文本模型：
 *
 *  【核心职责】
 *  1. 将 URI 解析为文本模型（ITextModel）
 *  2. 管理模型引用计数（Reference Counting）
 *  3. 支持内容提供者注册（IContentProvider）
 *  4. 处理不同 scheme 的资源（file, inMemory, untitled 等）
 *  5. 协调文本文件服务和未命名文件服务
 *
 *  【模型解析流程】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  1. 接收 URI                                             │
 *  │     └─ 如 file:///path/to/file.ts                      │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  2. 检查 scheme 类型                                     │
 *  │     └─ file: 使用 TextFileService                      │
 *  │     └─ inMemory: 使用 ModelService 缓存                │
 *  │     └─ untitled: 使用 UntitledTextEditorService        │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  3. 创建或获取模型                                       │
 *  │     └─ 引用计数 +1                                       │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  4. 返回模型引用                                         │
 *  │     └─ 释放时引用计数 -1                                 │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【引用计数管理】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  ResourceModelCollection 管理模型生命周期：               │
 *  │  - createReferencedObject(): 创建模型                   │
 *  │  - destroyReferencedObject(): 销毁模型                │
 *  │  - 引用计数为 0 时自动清理                               │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心类】
 *  - ResourceModelCollection: 资源模型集合（引用计数管理）
 *  - TextModelResolverService: 服务实现类
 *
 *  【支持的 URI Scheme】
 *  - file: 本地文件系统
 *  - inMemory: 内存中的临时模型
 *  - untitled: 未命名文件
 *  - vscode-remote: 远程文件
 *  - 自定义 scheme（通过内容提供者）
 *
 *  【使用场景】
 *  - 编辑器打开文件时解析模型
 *  - 搜索服务获取文件内容
 *  - 差异编辑器比较文件
 *  - 预览编辑器显示内容
 *
 *  【与 resolverService.ts 的关系】
 *  - 实现 editor/common/services/resolverService 中的接口
 *  - ITextModelService.createModelReference() 的主要实现
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IDisposable, toDisposable, IReference, ReferenceCollection, Disposable, AsyncReferenceCollection } from '../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { TextResourceEditorModel } from '../../../common/editor/textResourceEditorModel.js';
import { ITextFileService, TextFileResolveReason } from '../../textfile/common/textfiles.js';
import { Schemas } from '../../../../base/common/network.js';
import { ITextModelService, ITextModelContentProvider, ITextEditorModel, IResolvedTextEditorModel, isResolvedTextEditorModel } from '../../../../editor/common/services/resolverService.js';
import { TextFileEditorModel } from '../../textfile/common/textFileEditorModel.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IUndoRedoService } from '../../../../platform/undoRedo/common/undoRedo.js';
import { ModelUndoRedoParticipant } from '../../../../editor/common/services/modelUndoRedoParticipant.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { UntitledTextEditorModel } from '../../untitled/common/untitledTextEditorModel.js';

class ResourceModelCollection extends ReferenceCollection<Promise<IResolvedTextEditorModel>> {

	private readonly providers = new Map<string, ITextModelContentProvider[]>();
	private readonly modelsToDispose = new Set<string>();

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IFileService private readonly fileService: IFileService,
		@IModelService private readonly modelService: IModelService
	) {
		super();
	}

	protected createReferencedObject(key: string): Promise<IResolvedTextEditorModel> {
		return this.doCreateReferencedObject(key);
	}

	private async doCreateReferencedObject(key: string, skipActivateProvider?: boolean): Promise<IResolvedTextEditorModel> {

		// Untrack as being disposed
		this.modelsToDispose.delete(key);

		// inMemory Schema: go through model service cache
		const resource = URI.parse(key);
		if (resource.scheme === Schemas.inMemory) {
			const cachedModel = this.modelService.getModel(resource);
			if (!cachedModel) {
				throw new Error(`Unable to resolve inMemory resource ${key}`);
			}

			const model = this.instantiationService.createInstance(TextResourceEditorModel, resource);
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// Untitled Schema: go through untitled text service
		if (resource.scheme === Schemas.untitled) {
			const model = await this.textFileService.untitled.resolve({ untitledResource: resource });
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// File or remote file: go through text file service
		if (this.fileService.hasProvider(resource)) {
			const model = await this.textFileService.files.resolve(resource, { reason: TextFileResolveReason.REFERENCE });
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// Virtual documents
		if (this.providers.has(resource.scheme)) {
			await this.resolveTextModelContent(key);

			const model = this.instantiationService.createInstance(TextResourceEditorModel, resource);
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// Either unknown schema, or not yet registered, try to activate
		if (!skipActivateProvider) {
			await this.fileService.activateProvider(resource.scheme);

			return this.doCreateReferencedObject(key, true);
		}

		throw new Error(`Unable to resolve resource ${key}`);
	}

	private ensureResolvedModel(model: ITextEditorModel, key: string): model is IResolvedTextEditorModel {
		if (isResolvedTextEditorModel(model)) {
			return true;
		}

		throw new Error(`Unable to resolve resource ${key}`);
	}

	protected destroyReferencedObject(key: string, modelPromise: Promise<ITextEditorModel>): void {

		// inMemory is bound to a different lifecycle
		const resource = URI.parse(key);
		if (resource.scheme === Schemas.inMemory) {
			return;
		}

		// Track as being disposed before waiting for model to load
		// to handle the case that the reference is acquired again
		this.modelsToDispose.add(key);

		(async () => {
			try {
				const model = await modelPromise;

				if (!this.modelsToDispose.has(key)) {
					// return if model has been acquired again meanwhile
					return;
				}

				if (model instanceof TextFileEditorModel) {
					// text file models have conditions that prevent them
					// from dispose, so we have to wait until we can dispose
					await this.textFileService.files.canDispose(model);
				} else if (model instanceof UntitledTextEditorModel) {
					// untitled file models have conditions that prevent them
					// from dispose, so we have to wait until we can dispose
					await this.textFileService.untitled.canDispose(model);
				}

				if (!this.modelsToDispose.has(key)) {
					// return if model has been acquired again meanwhile
					return;
				}

				// Finally we can dispose the model
				model.dispose();
			} catch (error) {
				// ignore
			} finally {
				this.modelsToDispose.delete(key); // Untrack as being disposed
			}
		})();
	}

	registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable {
		let providers = this.providers.get(scheme);
		if (!providers) {
			providers = [];
			this.providers.set(scheme, providers);
		}

		providers.unshift(provider);

		return toDisposable(() => {
			const providersForScheme = this.providers.get(scheme);
			if (!providersForScheme) {
				return;
			}

			const index = providersForScheme.indexOf(provider);
			if (index === -1) {
				return;
			}

			providersForScheme.splice(index, 1);

			if (providersForScheme.length === 0) {
				this.providers.delete(scheme);
			}
		});
	}

	hasTextModelContentProvider(scheme: string): boolean {
		return this.providers.get(scheme) !== undefined;
	}

	private async resolveTextModelContent(key: string): Promise<ITextModel> {
		const resource = URI.parse(key);
		const providersForScheme = this.providers.get(resource.scheme) || [];

		for (const provider of providersForScheme) {
			const value = await provider.provideTextContent(resource);
			if (value) {
				return value;
			}
		}

		throw new Error(`Unable to resolve text model content for resource ${key}`);
	}
}

export class TextModelResolverService extends Disposable implements ITextModelService {

	declare readonly _serviceBrand: undefined;

	private _resourceModelCollection: ResourceModelCollection & ReferenceCollection<Promise<IResolvedTextEditorModel>> /* TS Fail */ | undefined = undefined;
	private get resourceModelCollection() {
		if (!this._resourceModelCollection) {
			this._resourceModelCollection = this.instantiationService.createInstance(ResourceModelCollection);
		}

		return this._resourceModelCollection;
	}

	private _asyncModelCollection: AsyncReferenceCollection<IResolvedTextEditorModel> | undefined = undefined;
	private get asyncModelCollection() {
		if (!this._asyncModelCollection) {
			this._asyncModelCollection = new AsyncReferenceCollection(this.resourceModelCollection);
		}

		return this._asyncModelCollection;
	}

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IFileService private readonly fileService: IFileService,
		@IUndoRedoService private readonly undoRedoService: IUndoRedoService,
		@IModelService private readonly modelService: IModelService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
	) {
		super();

		this._register(new ModelUndoRedoParticipant(this.modelService, this, this.undoRedoService));
	}

	async createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>> {

		// From this moment on, only operate on the canonical resource
		// to ensure we reduce the chance of resolving the same resource
		// with different resource forms (e.g. path casing on Windows)
		resource = this.uriIdentityService.asCanonicalUri(resource);

		return await this.asyncModelCollection.acquire(resource.toString());
	}

	registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable {
		return this.resourceModelCollection.registerTextModelContentProvider(scheme, provider);
	}

	canHandleResource(resource: URI): boolean {
		if (this.fileService.hasProvider(resource) || resource.scheme === Schemas.untitled || resource.scheme === Schemas.inMemory) {
			return true; // we handle file://, untitled:// and inMemory:// automatically
		}

		return this.resourceModelCollection.hasTextModelContentProvider(resource.scheme);
	}
}

registerSingleton(ITextModelService, TextModelResolverService, InstantiationType.Delayed);
