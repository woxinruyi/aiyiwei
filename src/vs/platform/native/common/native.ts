/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 原生主机服务接口】
 *  本文件定义原生主机服务的核心接口，提供 Electron 主进程的桥接功能：
 *
 *  【核心职责】
 *  1. 管理窗口生命周期（打开、关闭、焦点、最小化）
 *  2. 提供系统信息（OS、CPU、内存）
 *  3. 处理系统对话框（文件选择器、消息框）
 *  4. 管理剪贴板操作
 *  5. 提供 shell 功能（打开外部程序、托盘图标）
 *  6. 处理更新和重启
 *
 *  【窗口管理】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  窗口操作                                               │
 *  │  - openWindow(): 打开新窗口                           │
 *  │  - closeWindow(): 关闭窗口                            │
 *  │  - focusWindow(): 聚焦窗口                            │
 *  │  - minimizeWindow(): 最小化                           │
 *  │  - maximizeWindow(): 最大化                           │
 *  │  - fullscreenWindow(): 全屏                           │
 *  │  - setWindowZoomLevel(): 设置缩放                     │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【系统信息】
 *  - IOSProperties: 操作系统信息（类型、版本、架构）
 *  - ICPUProperties: CPU 信息（型号、速度）
 *  - IOSStatistics: 系统统计（内存、负载）
 *
 *  【对话框】
 *  - showOpenDialog(): 打开文件选择器
 *  - showSaveDialog(): 保存文件选择器
 *  - showMessageBox(): 显示消息框
 *
 *  【剪贴板】
 *  - readClipboardText(): 读取剪贴板文本
 *  - writeClipboardText(): 写入剪贴板文本
 *
 *  【Shell 功能】
 *  - openExternal(): 打开外部链接/程序
 *  - trash(): 移动到回收站
 *
 *  【使用场景】
 *  - 文件打开/保存对话框
 *  - 窗口管理（新建、关闭、切换）
 *  - 系统信息收集（遥测）
 *  - 剪贴板操作（复制/粘贴）
 *  - 外部链接打开
 *
 *  【与 Electron 的关系】
 *  - 本文件定义接口
 *  - electron-sandbox 提供渲染进程实现
 *  - electron-main 提供主进程实现
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../base/common/buffer.js';
import { Event } from '../../../base/common/event.js';
import { URI } from '../../../base/common/uri.js';
import { MessageBoxOptions, MessageBoxReturnValue, OpenDevToolsOptions, OpenDialogOptions, OpenDialogReturnValue, SaveDialogOptions, SaveDialogReturnValue } from '../../../base/parts/sandbox/common/electronTypes.js';
import { ISerializableCommandAction } from '../../action/common/action.js';
import { INativeOpenDialogOptions } from '../../dialogs/common/dialogs.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IV8Profile } from '../../profiling/common/profiling.js';
import { AuthInfo, Credentials } from '../../request/common/request.js';
import { IPartsSplash } from '../../theme/common/themeService.js';
import { IColorScheme, IOpenedAuxiliaryWindow, IOpenedMainWindow, IOpenEmptyWindowOptions, IOpenWindowOptions, IPoint, IRectangle, IWindowOpenable } from '../../window/common/window.js';

export interface ICPUProperties {
	model: string;
	speed: number;
}

export interface IOSProperties {
	type: string;
	release: string;
	arch: string;
	platform: string;
	cpus: ICPUProperties[];
}

export interface IOSStatistics {
	totalmem: number;
	freemem: number;
	loadavg: number[];
}

export interface INativeHostOptions {
	readonly targetWindowId?: number;
}

export interface ICommonNativeHostService {

	readonly _serviceBrand: undefined;

	// Properties
	readonly windowId: number;

	// Events
	readonly onDidOpenMainWindow: Event<number>;

	readonly onDidMaximizeWindow: Event<number>;
	readonly onDidUnmaximizeWindow: Event<number>;

	readonly onDidFocusMainWindow: Event<number>;
	readonly onDidBlurMainWindow: Event<number>;

	readonly onDidChangeWindowFullScreen: Event<{ windowId: number; fullscreen: boolean }>;

	readonly onDidFocusMainOrAuxiliaryWindow: Event<number>;
	readonly onDidBlurMainOrAuxiliaryWindow: Event<number>;

	readonly onDidChangeDisplay: Event<void>;

	readonly onDidResumeOS: Event<unknown>;

	readonly onDidChangeColorScheme: Event<IColorScheme>;

	readonly onDidChangePassword: Event<{ readonly service: string; readonly account: string }>;

	readonly onDidTriggerWindowSystemContextMenu: Event<{ readonly windowId: number; readonly x: number; readonly y: number }>;

	// Window
	getWindows(options: { includeAuxiliaryWindows: true }): Promise<Array<IOpenedMainWindow | IOpenedAuxiliaryWindow>>;
	getWindows(options: { includeAuxiliaryWindows: false }): Promise<Array<IOpenedMainWindow>>;
	getWindowCount(): Promise<number>;
	getActiveWindowId(): Promise<number | undefined>;
	getActiveWindowPosition(): Promise<IRectangle | undefined>;
	getNativeWindowHandle(windowId: number): Promise<VSBuffer | undefined>;

	openWindow(options?: IOpenEmptyWindowOptions): Promise<void>;
	openWindow(toOpen: IWindowOpenable[], options?: IOpenWindowOptions): Promise<void>;

	isFullScreen(options?: INativeHostOptions): Promise<boolean>;
	toggleFullScreen(options?: INativeHostOptions): Promise<void>;

	getCursorScreenPoint(): Promise<{ readonly point: IPoint; readonly display: IRectangle }>;

	isMaximized(options?: INativeHostOptions): Promise<boolean>;
	maximizeWindow(options?: INativeHostOptions): Promise<void>;
	unmaximizeWindow(options?: INativeHostOptions): Promise<void>;
	minimizeWindow(options?: INativeHostOptions): Promise<void>;
	moveWindowTop(options?: INativeHostOptions): Promise<void>;
	positionWindow(position: IRectangle, options?: INativeHostOptions): Promise<void>;

	/**
	 * Only supported on Windows and macOS. Updates the window controls to match the title bar size.
	 *
	 * @param options `backgroundColor` and `foregroundColor` are only supported on Windows
	 */
	updateWindowControls(options: INativeHostOptions & { height?: number; backgroundColor?: string; foregroundColor?: string }): Promise<void>;

	setMinimumSize(width: number | undefined, height: number | undefined): Promise<void>;

	saveWindowSplash(splash: IPartsSplash): Promise<void>;

	/**
	 * Make the window focused.
	 *
	 * @param options Pass `force: true` if you want to make the window take
	 * focus even if the application does not have focus currently. This option
	 * should only be used if it is necessary to steal focus from the current
	 * focused application which may not be VSCode.
	 */
	focusWindow(options?: INativeHostOptions & { force?: boolean }): Promise<void>;

	// Dialogs
	showMessageBox(options: MessageBoxOptions & INativeHostOptions): Promise<MessageBoxReturnValue>;
	showSaveDialog(options: SaveDialogOptions & INativeHostOptions): Promise<SaveDialogReturnValue>;
	showOpenDialog(options: OpenDialogOptions & INativeHostOptions): Promise<OpenDialogReturnValue>;

	pickFileFolderAndOpen(options: INativeOpenDialogOptions): Promise<void>;
	pickFileAndOpen(options: INativeOpenDialogOptions): Promise<void>;
	pickFolderAndOpen(options: INativeOpenDialogOptions): Promise<void>;
	pickWorkspaceAndOpen(options: INativeOpenDialogOptions): Promise<void>;

	// OS
	showItemInFolder(path: string): Promise<void>;
	setRepresentedFilename(path: string, options?: INativeHostOptions): Promise<void>;
	setDocumentEdited(edited: boolean, options?: INativeHostOptions): Promise<void>;
	openExternal(url: string, defaultApplication?: string): Promise<boolean>;
	moveItemToTrash(fullPath: string): Promise<void>;

	isAdmin(): Promise<boolean>;
	writeElevated(source: URI, target: URI, options?: { unlock?: boolean }): Promise<void>;
	isRunningUnderARM64Translation(): Promise<boolean>;

	getOSProperties(): Promise<IOSProperties>;
	getOSStatistics(): Promise<IOSStatistics>;
	getOSVirtualMachineHint(): Promise<number>;

	getOSColorScheme(): Promise<IColorScheme>;

	hasWSLFeatureInstalled(): Promise<boolean>;

	// Screenshots
	getScreenshot(): Promise<ArrayBufferLike | undefined>;

	// Process
	getProcessId(): Promise<number | undefined>;
	killProcess(pid: number, code: string): Promise<void>;

	// Clipboard
	readClipboardText(type?: 'selection' | 'clipboard'): Promise<string>;
	writeClipboardText(text: string, type?: 'selection' | 'clipboard'): Promise<void>;
	readClipboardFindText(): Promise<string>;
	writeClipboardFindText(text: string): Promise<void>;
	writeClipboardBuffer(format: string, buffer: VSBuffer, type?: 'selection' | 'clipboard'): Promise<void>;
	readClipboardBuffer(format: string): Promise<VSBuffer>;
	hasClipboard(format: string, type?: 'selection' | 'clipboard'): Promise<boolean>;
	readImage(): Promise<Uint8Array>;

	// macOS Touchbar
	newWindowTab(): Promise<void>;
	showPreviousWindowTab(): Promise<void>;
	showNextWindowTab(): Promise<void>;
	moveWindowTabToNewWindow(): Promise<void>;
	mergeAllWindowTabs(): Promise<void>;
	toggleWindowTabsBar(): Promise<void>;
	updateTouchBar(items: ISerializableCommandAction[][]): Promise<void>;

	// macOS Shell command
	installShellCommand(): Promise<void>;
	uninstallShellCommand(): Promise<void>;

	// Lifecycle
	notifyReady(): Promise<void>;
	relaunch(options?: { addArgs?: string[]; removeArgs?: string[] }): Promise<void>;
	reload(options?: { disableExtensions?: boolean }): Promise<void>;
	closeWindow(options?: INativeHostOptions): Promise<void>;
	quit(): Promise<void>;
	exit(code: number): Promise<void>;

	// Development
	openDevTools(options?: Partial<OpenDevToolsOptions> & INativeHostOptions): Promise<void>;
	toggleDevTools(options?: INativeHostOptions): Promise<void>;
	openGPUInfoWindow(): Promise<void>;

	// Perf Introspection
	profileRenderer(session: string, duration: number): Promise<IV8Profile>;

	// Connectivity
	resolveProxy(url: string): Promise<string | undefined>;
	lookupAuthorization(authInfo: AuthInfo): Promise<Credentials | undefined>;
	lookupKerberosAuthorization(url: string): Promise<string | undefined>;
	loadCertificates(): Promise<string[]>;
	findFreePort(startPort: number, giveUpAfter: number, timeout: number, stride?: number): Promise<number>;

	// Registry (Windows only)
	windowsGetStringRegKey(hive: 'HKEY_CURRENT_USER' | 'HKEY_LOCAL_MACHINE' | 'HKEY_CLASSES_ROOT' | 'HKEY_USERS' | 'HKEY_CURRENT_CONFIG', path: string, name: string): Promise<string | undefined>;
}

export const INativeHostService = createDecorator<INativeHostService>('nativeHostService');

/**
 * A set of methods specific to a native host, i.e. unsupported in web
 * environments.
 *
 * @see {@link IHostService} for methods that can be used in native and web
 * hosts.
 */
export interface INativeHostService extends ICommonNativeHostService { }
