/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 生命周期服务实现】
 *  本文件实现抽象生命周期服务，控制应用启动、阶段变更和关闭流程：
 *
 *  【核心职责】
 *  1. 管理生命周期阶段变更（Starting → Ready → Restored → Eventually）
 *  2. 处理启动类型识别（NewWindow / ReloadedWindow / ReopenedWindow）
 *  3. 发送生命周期事件（onBeforeShutdown / onWillShutdown / onDidShutdown）
 *  4. 支持阶段等待机制（Barrier 模式）
 *  5. 保存和恢复关闭原因
 *
 *  【生命周期阶段管理】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Phase 1: Starting                                      │
 *  │  - 初始化阶段，服务正在准备                               │
 *  │  - 记录启动类型（startupKind）                           │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Phase 2: Ready                                         │
 *  │  - 服务就绪，UI 状态即将恢复                             │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Phase 3: Restored                                      │
 *  │  - 视图、面板、编辑器已恢复                              │
 *  │  - 大多数贡献点在此阶段注册                              │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Phase 4: Eventually                                    │
 *  │  - 延迟加载阶段（2-5秒后）                               │
 *  │  - 非关键服务在此阶段初始化                              │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【启动类型识别】
 *  - 通过存储的 LAST_SHUTDOWN_REASON_KEY 判断上次关闭原因
 *  - RELOAD → ReloadedWindow（窗口重新加载）
 *  - LOAD → ReopenedWindow（重新打开工作区）
 *  - 其他 → NewWindow（新窗口）
 *
 *  【阶段等待机制】
 *  - 使用 Barrier 实现异步阶段等待
 *  - when(phase) 方法允许组件等待特定阶段
 *  - 阶段到达时自动解锁对应 Barrier
 *
 *  【与 lifecycle.ts 的关系】
 *  - lifecycle.ts 定义接口和类型
 *  - 本文件提供抽象实现（AbstractLifecycleService）
 *  - 具体平台实现继承此类（browser/electron-sandbox）
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Barrier } from '../../../../base/common/async.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILifecycleService, WillShutdownEvent, StartupKind, LifecyclePhase, LifecyclePhaseToString, ShutdownReason, BeforeShutdownErrorEvent, InternalBeforeShutdownEvent } from './lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { mark } from '../../../../base/common/performance.js';
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from '../../../../platform/storage/common/storage.js';

export abstract class AbstractLifecycleService extends Disposable implements ILifecycleService {

	private static readonly LAST_SHUTDOWN_REASON_KEY = 'lifecyle.lastShutdownReason';

	declare readonly _serviceBrand: undefined;

	protected readonly _onBeforeShutdown = this._register(new Emitter<InternalBeforeShutdownEvent>());
	readonly onBeforeShutdown = this._onBeforeShutdown.event;

	protected readonly _onWillShutdown = this._register(new Emitter<WillShutdownEvent>());
	readonly onWillShutdown = this._onWillShutdown.event;

	protected readonly _onDidShutdown = this._register(new Emitter<void>());
	readonly onDidShutdown = this._onDidShutdown.event;

	protected readonly _onBeforeShutdownError = this._register(new Emitter<BeforeShutdownErrorEvent>());
	readonly onBeforeShutdownError = this._onBeforeShutdownError.event;

	protected readonly _onShutdownVeto = this._register(new Emitter<void>());
	readonly onShutdownVeto = this._onShutdownVeto.event;

	private _startupKind: StartupKind;
	get startupKind(): StartupKind { return this._startupKind; }

	private _phase = LifecyclePhase.Starting;
	get phase(): LifecyclePhase { return this._phase; }

	protected _willShutdown = false;
	get willShutdown(): boolean { return this._willShutdown; }

	private readonly phaseWhen = new Map<LifecyclePhase, Barrier>();

	protected shutdownReason: ShutdownReason | undefined;

	constructor(
		@ILogService protected readonly logService: ILogService,
		@IStorageService protected readonly storageService: IStorageService
	) {
		super();

		// Resolve startup kind
		this._startupKind = this.resolveStartupKind();

		// Save shutdown reason to retrieve on next startup
		this._register(this.storageService.onWillSaveState(e => {
			if (e.reason === WillSaveStateReason.SHUTDOWN) {
				this.storageService.store(AbstractLifecycleService.LAST_SHUTDOWN_REASON_KEY, this.shutdownReason, StorageScope.WORKSPACE, StorageTarget.MACHINE);
			}
		}));
	}

	private resolveStartupKind(): StartupKind {
		const startupKind = this.doResolveStartupKind() ?? StartupKind.NewWindow;
		this.logService.trace(`[lifecycle] starting up (startup kind: ${startupKind})`);

		return startupKind;
	}

	protected doResolveStartupKind(): StartupKind | undefined {

		// Retrieve and reset last shutdown reason
		const lastShutdownReason = this.storageService.getNumber(AbstractLifecycleService.LAST_SHUTDOWN_REASON_KEY, StorageScope.WORKSPACE);
		this.storageService.remove(AbstractLifecycleService.LAST_SHUTDOWN_REASON_KEY, StorageScope.WORKSPACE);

		// Convert into startup kind
		let startupKind: StartupKind | undefined = undefined;
		switch (lastShutdownReason) {
			case ShutdownReason.RELOAD:
				startupKind = StartupKind.ReloadedWindow;
				break;
			case ShutdownReason.LOAD:
				startupKind = StartupKind.ReopenedWindow;
				break;
		}

		return startupKind;
	}

	set phase(value: LifecyclePhase) {
		if (value < this.phase) {
			throw new Error('Lifecycle cannot go backwards');
		}

		if (this._phase === value) {
			return;
		}

		this.logService.trace(`lifecycle: phase changed (value: ${value})`);

		this._phase = value;
		mark(`code/LifecyclePhase/${LifecyclePhaseToString(value)}`);

		const barrier = this.phaseWhen.get(this._phase);
		if (barrier) {
			barrier.open();
			this.phaseWhen.delete(this._phase);
		}
	}

	async when(phase: LifecyclePhase): Promise<void> {
		if (phase <= this._phase) {
			return;
		}

		let barrier = this.phaseWhen.get(phase);
		if (!barrier) {
			barrier = new Barrier();
			this.phaseWhen.set(phase, barrier);
		}

		await barrier.wait();
	}

	/**
	 * Subclasses to implement the explicit shutdown method.
	 */
	abstract shutdown(): Promise<void>;
}
