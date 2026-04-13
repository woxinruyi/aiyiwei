/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 路径服务接口】
 *  本文件定义路径服务的核心接口，提供与环境匹配的路径相关功能：
 *
 *  【核心职责】
 *  1. 提供正确的路径库（根据操作系统：Windows/win32 或 Unix/posix）
 *  2. 确定默认 URI 方案（file:// 或 vscode-remote://）
 *  3. 转换路径为文件 URI
 *  4. 处理虚拟工作区路径
 *  5. 支持远程环境路径处理
 *
 *  【路径库选择】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Windows 本地环境                                       │
 *  │  - 使用 win32 路径库                                    │
 *  │  - 路径分隔符: \                                        │
 *  │  - 示例: C:\Users\name\file.txt                         │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Linux/macOS 本地环境                                   │
 *  │  - 使用 posix 路径库                                    │
 *  │  - 路径分隔符: /                                        │
 *  │  - 示例: /home/name/file.txt                            │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  远程环境                                               │
 *  │  - 使用远程服务器的路径库                               │
 *  │  - 可能与本地不同（如 Windows 本地连接 Linux 远程）    │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【核心方法】
 *  - path: 获取路径库（win32 或 posix）
 *  - defaultUriScheme: 获取默认 URI 方案
 *  - fileURI(path): 将路径转换为文件 URI
 *
 *  【使用场景】
 *  - 创建文件 URI 时确保使用正确的路径格式
 *  - 处理跨平台文件路径
 *  - 远程开发时正确处理远程路径
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { isValidBasename } from '../../../../base/common/extpath.js';
import { Schemas } from '../../../../base/common/network.js';
import { IPath, win32, posix } from '../../../../base/common/path.js';
import { OperatingSystem, OS } from '../../../../base/common/platform.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { getVirtualWorkspaceScheme } from '../../../../platform/workspace/common/virtualWorkspace.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';

export const IPathService = createDecorator<IPathService>('pathService');

/**
 * Provides access to path related properties that will match the
 * environment. If the environment is connected to a remote, the
 * path properties will match that of the remotes operating system.
 */
export interface IPathService {

	readonly _serviceBrand: undefined;

	/**
	 * The correct path library to use for the target environment. If
	 * the environment is connected to a remote, this will be the
	 * path library of the remote file system. Otherwise it will be
	 * the local file system's path library depending on the OS.
	 */
	readonly path: Promise<IPath>;

	/**
	 * Determines the best default URI scheme for the current workspace.
	 * It uses information about whether we're running remote, in browser,
	 * or native combined with information about the current workspace to
	 * find the best default scheme.
	 */
	readonly defaultUriScheme: string;

	/**
	 * Converts the given path to a file URI to use for the target
	 * environment. If the environment is connected to a remote, it
	 * will use the path separators according to the remote file
	 * system. Otherwise it will use the local file system's path
	 * separators.
	 */
	fileURI(path: string): Promise<URI>;

	/**
	 * Resolves the user-home directory for the target environment.
	 * If the envrionment is connected to a remote, this will be the
	 * remote's user home directory, otherwise the local one unless
	 * `preferLocal` is set to `true`.
	 */
	userHome(options: { preferLocal: true }): URI;
	userHome(options?: { preferLocal: boolean }): Promise<URI>;

	/**
	 * Figures out if the provided resource has a valid file name
	 * for the operating system the file is saved to.
	 *
	 * Note: this currently only supports `file` and `vscode-file`
	 * protocols where we know the limits of the file systems behind
	 * these OS. Other remotes are not supported and this method
	 * will always return `true` for them.
	 */
	hasValidBasename(resource: URI, basename?: string): Promise<boolean>;
	hasValidBasename(resource: URI, os: OperatingSystem, basename?: string): boolean;

	/**
	 * @deprecated use `userHome` instead.
	 */
	readonly resolvedUserHome: URI | undefined;
}

export abstract class AbstractPathService implements IPathService {

	declare readonly _serviceBrand: undefined;

	private resolveOS: Promise<OperatingSystem>;

	private resolveUserHome: Promise<URI>;
	private maybeUnresolvedUserHome: URI | undefined;

	constructor(
		private localUserHome: URI,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService
	) {

		// OS
		this.resolveOS = (async () => {
			const env = await this.remoteAgentService.getEnvironment();

			return env?.os || OS;
		})();

		// User Home
		this.resolveUserHome = (async () => {
			const env = await this.remoteAgentService.getEnvironment();
			const userHome = this.maybeUnresolvedUserHome = env?.userHome ?? localUserHome;

			return userHome;
		})();
	}

	hasValidBasename(resource: URI, basename?: string): Promise<boolean>;
	hasValidBasename(resource: URI, os: OperatingSystem, basename?: string): boolean;
	hasValidBasename(resource: URI, arg2?: string | OperatingSystem, basename?: string): boolean | Promise<boolean> {

		// async version
		if (typeof arg2 === 'string' || typeof arg2 === 'undefined') {
			return this.resolveOS.then(os => this.doHasValidBasename(resource, os, arg2));
		}

		// sync version
		return this.doHasValidBasename(resource, arg2, basename);
	}

	private doHasValidBasename(resource: URI, os: OperatingSystem, name?: string): boolean {

		// Our `isValidBasename` method only works with our
		// standard schemes for files on disk, either locally
		// or remote.
		if (resource.scheme === Schemas.file || resource.scheme === Schemas.vscodeRemote) {
			return isValidBasename(name ?? basename(resource), os === OperatingSystem.Windows);
		}

		return true;
	}

	get defaultUriScheme(): string {
		return AbstractPathService.findDefaultUriScheme(this.environmentService, this.contextService);
	}

	static findDefaultUriScheme(environmentService: IWorkbenchEnvironmentService, contextService: IWorkspaceContextService): string {
		if (environmentService.remoteAuthority) {
			return Schemas.vscodeRemote;
		}

		const virtualWorkspace = getVirtualWorkspaceScheme(contextService.getWorkspace());
		if (virtualWorkspace) {
			return virtualWorkspace;
		}

		const firstFolder = contextService.getWorkspace().folders[0];
		if (firstFolder) {
			return firstFolder.uri.scheme;
		}

		const configuration = contextService.getWorkspace().configuration;
		if (configuration) {
			return configuration.scheme;
		}

		return Schemas.file;
	}

	userHome(options?: { preferLocal: boolean }): Promise<URI>;
	userHome(options: { preferLocal: true }): URI;
	userHome(options?: { preferLocal: boolean }): Promise<URI> | URI {
		return options?.preferLocal ? this.localUserHome : this.resolveUserHome;
	}

	get resolvedUserHome(): URI | undefined {
		return this.maybeUnresolvedUserHome;
	}

	get path(): Promise<IPath> {
		return this.resolveOS.then(os => {
			return os === OperatingSystem.Windows ?
				win32 :
				posix;
		});
	}

	async fileURI(_path: string): Promise<URI> {
		let authority = '';

		// normalize to fwd-slashes on windows,
		// on other systems bwd-slashes are valid
		// filename character, eg /f\oo/ba\r.txt
		const os = await this.resolveOS;
		if (os === OperatingSystem.Windows) {
			_path = _path.replace(/\\/g, '/');
		}

		// check for authority as used in UNC shares
		// or use the path as given
		if (_path[0] === '/' && _path[1] === '/') {
			const idx = _path.indexOf('/', 2);
			if (idx === -1) {
				authority = _path.substring(2);
				_path = '/';
			} else {
				authority = _path.substring(2, idx);
				_path = _path.substring(idx) || '/';
			}
		}

		return URI.from({
			scheme: Schemas.file,
			authority,
			path: _path,
			query: '',
			fragment: ''
		});
	}
}
