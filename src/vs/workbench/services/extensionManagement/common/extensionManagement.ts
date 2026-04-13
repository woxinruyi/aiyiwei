/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作台扩展管理服务】
 *  本文件定义工作台层扩展管理服务的扩展接口，支持配置档感知和多服务器环境：
 *
 *  【核心职责】
 *  1. 支持配置档感知的扩展管理（IProfileAwareExtensionManagementService）
 *  2. 管理多服务器扩展安装位置（本地、远程、Web）
 *  3. 提供扩展管理服务器服务（IExtensionManagementServerService）
 *  4. 处理扩展图标和资源访问
 *
 *  【扩展安装位置】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Local  - 本地扩展（默认安装位置）                      │
 *  │  安装在本地文件系统                                      │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Remote - 远程扩展                                      │
 *  │  安装在远程服务器（SSH/容器/WSL）                      │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Web    - Web 扩展                                     │
 *  │  运行在浏览器环境的扩展                                  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【配置档感知】
 *  - 支持用户配置档（User Data Profile）
 *  - 每个配置档可以有不同的扩展集合
 *  - 切换配置档时自动同步扩展
 *
 *  【核心接口】
 *  - IProfileAwareExtensionManagementService: 配置档感知扩展管理
 *  - IExtensionManagementServer: 扩展管理服务器
 *  - IExtensionManagementServerService: 服务器管理服务
 *  - IResourceExtension: 资源扩展（从本地路径加载）
 *
 *  【使用场景】
 *  - 远程开发时管理本地和远程扩展
 *  - 切换用户配置档时同步扩展
 *  - 从本地文件安装扩展
 *
 *  【与 platform/extensionManagement 的关系】
 *  - 本文件扩展平台层的扩展管理服务
 *  - 添加工作台特定的功能（配置档、多服务器）
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator, refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IExtension, ExtensionType, IExtensionManifest, IExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IExtensionManagementService, IGalleryExtension, ILocalExtension, InstallOptions, InstallExtensionEvent, DidUninstallExtensionEvent, InstallExtensionResult, Metadata, UninstallExtensionEvent, DidUpdateExtensionMetadata, InstallExtensionInfo } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { URI } from '../../../../base/common/uri.js';
import { FileAccess } from '../../../../base/common/network.js';
import { IMarkdownString } from '../../../../base/common/htmlContent.js';

export type DidChangeProfileEvent = { readonly added: ILocalExtension[]; readonly removed: ILocalExtension[] };

export const IProfileAwareExtensionManagementService = refineServiceDecorator<IExtensionManagementService, IProfileAwareExtensionManagementService>(IExtensionManagementService);
export interface IProfileAwareExtensionManagementService extends IExtensionManagementService {
	readonly onProfileAwareDidInstallExtensions: Event<readonly InstallExtensionResult[]>;
	readonly onProfileAwareDidUninstallExtension: Event<DidUninstallExtensionEvent>;
	readonly onProfileAwareDidUpdateExtensionMetadata: Event<DidUpdateExtensionMetadata>;
	readonly onDidChangeProfile: Event<DidChangeProfileEvent>;
}

export interface IExtensionManagementServer {
	readonly id: string;
	readonly label: string;
	readonly extensionManagementService: IProfileAwareExtensionManagementService;
}

export const enum ExtensionInstallLocation {
	Local = 1,
	Remote,
	Web
}

export const IExtensionManagementServerService = createDecorator<IExtensionManagementServerService>('extensionManagementServerService');
export interface IExtensionManagementServerService {
	readonly _serviceBrand: undefined;
	readonly localExtensionManagementServer: IExtensionManagementServer | null;
	readonly remoteExtensionManagementServer: IExtensionManagementServer | null;
	readonly webExtensionManagementServer: IExtensionManagementServer | null;
	getExtensionManagementServer(extension: IExtension): IExtensionManagementServer | null;
	getExtensionInstallLocation(extension: IExtension): ExtensionInstallLocation | null;
}

export const DefaultIconPath = FileAccess.asBrowserUri('vs/workbench/services/extensionManagement/common/media/defaultIcon.png').toString(true);

export interface IResourceExtension {
	readonly type: 'resource';
	readonly identifier: IExtensionIdentifier;
	readonly location: URI;
	readonly manifest: IExtensionManifest;
	readonly readmeUri?: URI;
	readonly changelogUri?: URI;
}

export type InstallExtensionOnServerEvent = InstallExtensionEvent & { server: IExtensionManagementServer };
export type UninstallExtensionOnServerEvent = UninstallExtensionEvent & { server: IExtensionManagementServer };
export type DidUninstallExtensionOnServerEvent = DidUninstallExtensionEvent & { server: IExtensionManagementServer };
export type DidChangeProfileForServerEvent = DidChangeProfileEvent & { server: IExtensionManagementServer };

export interface IPublisherInfo {
	readonly publisher: string;
	readonly publisherDisplayName: string;
}

export const IWorkbenchExtensionManagementService = refineServiceDecorator<IProfileAwareExtensionManagementService, IWorkbenchExtensionManagementService>(IProfileAwareExtensionManagementService);
export interface IWorkbenchExtensionManagementService extends IProfileAwareExtensionManagementService {
	readonly _serviceBrand: undefined;

	readonly onInstallExtension: Event<InstallExtensionOnServerEvent>;
	readonly onDidInstallExtensions: Event<readonly InstallExtensionResult[]>;
	readonly onUninstallExtension: Event<UninstallExtensionOnServerEvent>;
	readonly onDidUninstallExtension: Event<DidUninstallExtensionOnServerEvent>;
	readonly onDidChangeProfile: Event<DidChangeProfileForServerEvent>;
	readonly onDidEnableExtensions: Event<IExtension[]>;

	readonly onProfileAwareDidInstallExtensions: Event<readonly InstallExtensionResult[]>;
	readonly onProfileAwareDidUninstallExtension: Event<DidUninstallExtensionOnServerEvent>;
	readonly onProfileAwareDidUpdateExtensionMetadata: Event<DidUpdateExtensionMetadata>;

	getExtensions(locations: URI[]): Promise<IResourceExtension[]>;
	getInstalledWorkspaceExtensionLocations(): URI[];
	getInstalledWorkspaceExtensions(includeInvalid: boolean): Promise<ILocalExtension[]>;

	canInstall(extension: IGalleryExtension | IResourceExtension): Promise<true | IMarkdownString>;

	getInstallableServers(extension: IGalleryExtension): Promise<IExtensionManagementServer[]>;
	installVSIX(location: URI, manifest: IExtensionManifest, installOptions?: InstallOptions): Promise<ILocalExtension>;
	installFromGallery(gallery: IGalleryExtension, installOptions?: InstallOptions, servers?: IExtensionManagementServer[]): Promise<ILocalExtension>;
	installFromLocation(location: URI): Promise<ILocalExtension>;
	installResourceExtension(extension: IResourceExtension, installOptions: InstallOptions): Promise<ILocalExtension>;

	updateFromGallery(gallery: IGalleryExtension, extension: ILocalExtension, installOptions?: InstallOptions): Promise<ILocalExtension>;
	updateMetadata(local: ILocalExtension, metadata: Partial<Metadata>): Promise<ILocalExtension>;

	requestPublisherTrust(extensions: InstallExtensionInfo[]): Promise<void>;
	isPublisherTrusted(extension: IGalleryExtension): boolean;
	getTrustedPublishers(): IPublisherInfo[];
	trustPublishers(...publishers: IPublisherInfo[]): void;
	untrustPublishers(...publishers: string[]): void;
}

export const enum EnablementState {
	DisabledByTrustRequirement,
	DisabledByExtensionKind,
	DisabledByEnvironment,
	EnabledByEnvironment,
	DisabledByMalicious,
	DisabledByVirtualWorkspace,
	DisabledByInvalidExtension,
	DisabledByAllowlist,
	DisabledByExtensionDependency,
	DisabledGlobally,
	DisabledWorkspace,
	EnabledGlobally,
	EnabledWorkspace
}

export const IWorkbenchExtensionEnablementService = createDecorator<IWorkbenchExtensionEnablementService>('extensionEnablementService');

export interface IWorkbenchExtensionEnablementService {
	readonly _serviceBrand: undefined;

	/**
	 * Event to listen on for extension enablement changes
	 */
	readonly onEnablementChanged: Event<readonly IExtension[]>;

	/**
	 * Returns the enablement state for the given extension
	 */
	getEnablementState(extension: IExtension): EnablementState;

	/**
	 * Returns the enablement states for the given extensions
	 * @param extensions list of extensions
	 * @param workspaceTypeOverrides Workspace type overrides
	 */
	getEnablementStates(extensions: IExtension[], workspaceTypeOverrides?: { trusted?: boolean }): EnablementState[];

	/**
	 * Returns the enablement states for the dependencies of the given extension
	 */
	getDependenciesEnablementStates(extension: IExtension): [IExtension, EnablementState][];

	/**
	 * Returns `true` if the enablement can be changed.
	 */
	canChangeEnablement(extension: IExtension): boolean;

	/**
	 * Returns `true` if the enablement can be changed.
	 */
	canChangeWorkspaceEnablement(extension: IExtension): boolean;

	/**
	 * Returns `true` if the given extension is enabled.
	 */
	isEnabled(extension: IExtension): boolean;

	/**
	 * Returns `true` if the given enablement state is enabled enablement state.
	 */
	isEnabledEnablementState(enablementState: EnablementState): boolean;

	/**
	 * Returns `true` if the given extension identifier is disabled globally.
	 * Extensions can be disabled globally or in workspace or both.
	 * If an extension is disabled in both then enablement state shows only workspace.
	 * This will
	 */
	isDisabledGlobally(extension: IExtension): boolean;

	/**
	 * Enable or disable the given extension.
	 * if `workspace` is `true` then enablement is done for workspace, otherwise globally.
	 *
	 * Returns a promise that resolves to boolean value.
	 * if resolves to `true` then requires restart for the change to take effect.
	 *
	 * Throws error if enablement is requested for workspace and there is no workspace
	 */
	setEnablement(extensions: IExtension[], state: EnablementState): Promise<boolean[]>;

	/**
	 * Updates the enablement state of the extensions when workspace trust changes.
	 */
	updateExtensionsEnablementsWhenWorkspaceTrustChanges(): Promise<void>;
}

export interface IScannedExtension extends IExtension {
	readonly metadata?: Metadata;
}

export type ScanOptions = { readonly skipInvalidExtensions?: boolean };

export const IWebExtensionsScannerService = createDecorator<IWebExtensionsScannerService>('IWebExtensionsScannerService');
export interface IWebExtensionsScannerService {
	readonly _serviceBrand: undefined;

	scanSystemExtensions(): Promise<IExtension[]>;
	scanUserExtensions(profileLocation: URI, options?: ScanOptions): Promise<IScannedExtension[]>;
	scanExtensionsUnderDevelopment(): Promise<IExtension[]>;
	scanExistingExtension(extensionLocation: URI, extensionType: ExtensionType, profileLocation: URI): Promise<IScannedExtension | null>;

	addExtension(location: URI, metadata: Metadata, profileLocation: URI): Promise<IScannedExtension>;
	addExtensionFromGallery(galleryExtension: IGalleryExtension, metadata: Metadata, profileLocation: URI): Promise<IScannedExtension>;
	removeExtension(extension: IScannedExtension, profileLocation: URI): Promise<void>;
	copyExtensions(fromProfileLocation: URI, toProfileLocation: URI, filter: (extension: IScannedExtension) => boolean): Promise<void>;

	updateMetadata(extension: IScannedExtension, metaData: Partial<Metadata>, profileLocation: URI): Promise<IScannedExtension>;

	scanExtensionManifest(extensionLocation: URI): Promise<IExtensionManifest | null>;
}
