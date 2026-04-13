/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 主机服务接口】
 *  本文件定义主机服务的核心接口，管理窗口焦点、打开操作和重启功能：
 *
 *  【核心职责】
 *  1. 管理窗口焦点状态（onDidChangeFocus, hasFocus）
 *  2. 支持打开文件夹/工作区/文件（openWindow）
 *  3. 支持打开空窗口（openEmptyWindow）
 *  4. 提供窗口关闭控制（closeWindow, quit）
 *  5. 支持应用重启（restart, reload）
 *
 *  【核心方法】
 *  - hadLastFocus(): 检查窗口是否最后获得焦点
 *  - focus(options): 将窗口带到前台并聚焦
 *  - openWindow(toOpen, options): 打开文件夹/工作区/文件
 *  - openEmptyWindow(options): 打开新空窗口
 *  - toggleFullScreen(): 切换全屏模式
 *  - restart(): 重启应用
 *  - reload(): 重新加载窗口
 *
 *  【与语言设置的关系】
 *  - 语言设置更改后需要重启应用
 *  - localeService.ts 调用 hostService.restart() 重启
 *  - 重启后读取新的 argv.json 配置
 *
 *  【使用场景】
 *  - 语言切换后重启应用
 *  - 打开文件夹时创建新窗口
 *  - 全屏模式切换
 *  - 窗口聚焦控制
 *
 *  【平台差异】
 *  - 浏览器环境: 使用 IHostService
 *  - 原生环境: 使用 INativeHostService（扩展接口）
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWindowOpenable, IOpenWindowOptions, IOpenEmptyWindowOptions, IPoint, IRectangle } from '../../../../platform/window/common/window.js';

export const IHostService = createDecorator<IHostService>('hostService');

/**
 * A set of methods supported in both web and native environments.
 *
 * @see {@link INativeHostService} for methods that are specific to native
 * environments.
 */
export interface IHostService {

	readonly _serviceBrand: undefined;

	//#region Focus

	/**
	 * Emitted when the focus of the window changes.
	 *
	 * Note: this considers the main window as well as auxiliary windows
	 * when they are in focus. As long as the main window or any of its
	 * auxiliary windows have focus, this event fires with `true`. It will
	 * fire with `false` when neither the main window nor any of its
	 * auxiliary windows have focus.
	 */
	readonly onDidChangeFocus: Event<boolean>;

	/**
	 * Find out if the window or any of its auxiliary windows have focus.
	 */
	readonly hasFocus: boolean;

	/**
	 * Find out if the window had the last focus.
	 */
	hadLastFocus(): Promise<boolean>;

	/**
	 * Attempt to bring the window to the foreground and focus it.
	 *
	 * @param options Pass `force: true` if you want to make the window take
	 * focus even if the application does not have focus currently. This option
	 * should only be used if it is necessary to steal focus from the current
	 * focused application which may not be VSCode. It may not be supported
	 * in all environments.
	 */
	focus(targetWindow: Window, options?: { force: boolean }): Promise<void>;

	//#endregion

	//#region Window

	/**
	 * Emitted when the active window changes between main window
	 * and auxiliary windows.
	 */
	readonly onDidChangeActiveWindow: Event<number>;

	/**
	 * Emitted when the window with the given identifier changes
	 * its fullscreen state.
	 */
	readonly onDidChangeFullScreen: Event<{ windowId: number; fullscreen: boolean }>;

	/**
	 * Opens an empty window. The optional parameter allows to define if
	 * a new window should open or the existing one change to an empty.
	 */
	openWindow(options?: IOpenEmptyWindowOptions): Promise<void>;

	/**
	 * Opens the provided array of openables in a window with the provided options.
	 */
	openWindow(toOpen: IWindowOpenable[], options?: IOpenWindowOptions): Promise<void>;

	/**
	 * Switch between fullscreen and normal window.
	 */
	toggleFullScreen(targetWindow: Window): Promise<void>;

	/**
	 * Bring a window to the front and restore it if needed.
	 */
	moveTop(targetWindow: Window): Promise<void>;

	/**
	 * Get the location of the mouse cursor and its display bounds or `undefined` if unavailable.
	 */
	getCursorScreenPoint(): Promise<{ readonly point: IPoint; readonly display: IRectangle } | undefined>;

	//#endregion

	//#region Lifecycle

	/**
	 * Restart the entire application.
	 */
	restart(): Promise<void>;

	/**
	 * Reload the currently active main window.
	 */
	reload(options?: { disableExtensions?: boolean }): Promise<void>;

	/**
	 * Attempt to close the active main window.
	 */
	close(): Promise<void>;

	/**
	 * Execute an asynchronous `expectedShutdownTask`. While this task is
	 * in progress, attempts to quit the application will not be vetoed with a dialog.
	 */
	withExpectedShutdown<T>(expectedShutdownTask: () => Promise<T>): Promise<T>;

	//#endregion

	//#region Screenshots

	/**
	 * Captures a screenshot.
	 */
	getScreenshot(): Promise<ArrayBufferLike | undefined>;

	//#endregion

	//#region Native Handle

	/**
	 * Get the native handle of the window.
	 */
	getNativeWindowHandle(windowId: number): Promise<VSBuffer | undefined>;

	//#endregion
}
