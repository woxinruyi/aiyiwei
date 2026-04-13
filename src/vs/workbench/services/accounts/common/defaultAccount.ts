/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 默认账户服务】
 *  本文件实现默认账户服务，管理用户的 VS Code 账户状态和订阅信息：
 *
 *  【核心职责】
 *  1. 管理用户账户状态（未初始化/不可用/可用）
 *  2. 查询用户订阅信息（免费/专业版）
 *  3. 管理 AI 功能配额（聊天次数、代码补全次数）
 *  4. 提供账户相关的上下文键
 *  5. 支持 Copilot/AI 功能的权限控制
 *
 *  【账户类型】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  免费用户（Limited）                                    │
 *  │  - 有限的聊天配额（limited_user_quotas.chat）          │
 *  │  - 有限的补全配额（limited_user_quotas.completions）  │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  专业版用户（Enterprise/Pro）                         │
 *  │  - 更高的月度配额（monthly_quotas）                   │
 *  │  - 优先访问新功能                                       │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【账户状态】
 *  - Uninitialized: 尚未初始化
 *  - Unavailable: 账户不可用
 *  - Available: 账户可用
 *
 *  【核心接口】
 *  - IDefaultAccount: 账户信息接口
 *  - CONTEXT_DEFAULT_ACCOUNT_STATE: 账户状态上下文键
 *  - DefaultAccountStatus: 状态枚举
 *
 *  【账户属性】
 *  - sessionId: 会话标识
 *  - enterprise: 是否企业用户
 *  - chat_enabled: 是否启用聊天功能
 *  - analytics_tracking_id: 分析跟踪 ID
 *  - quotas: 功能配额限制
 *
 *  【使用场景】
 *  - 状态栏显示账户状态
 *  - 控制 AI 功能可用性
 *  - 显示配额使用情况
 *  - 升级到专业版的提示
 *
 *  【与 authentication.ts 的关系】
 *  - 使用认证服务获取用户会话
 *  - 与 GitHub/Microsoft 账户关联
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IAuthenticationService } from '../../authentication/common/authentication.js';
import { asJson, IRequestService } from '../../../../platform/request/common/request.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ContextKeyExpr, IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { localize } from '../../../../nls.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Barrier } from '../../../../base/common/async.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { getErrorMessage } from '../../../../base/common/errors.js';

const enum DefaultAccountStatus {
	Uninitialized = 'uninitialized',
	Unavailable = 'unavailable',
	Available = 'available',
}

const CONTEXT_DEFAULT_ACCOUNT_STATE = new RawContextKey<string>('defaultAccountStatus', DefaultAccountStatus.Uninitialized);

export interface IDefaultAccount {
	readonly sessionId: string;
	readonly enterprise: boolean;
	readonly access_type_sku?: string;
	readonly assigned_date?: string;
	readonly can_signup_for_limited?: boolean;
	readonly chat_enabled?: boolean;
	readonly chat_preview_features_enabled?: boolean;
	readonly analytics_tracking_id?: string;
	readonly limited_user_quotas?: {
		readonly chat: number;
		readonly completions: number;
	};
	readonly monthly_quotas?: {
		readonly chat: number;
		readonly completions: number;
	};
	readonly limited_user_reset_date?: string;
}

interface IChatEntitlementsResponse {
	readonly access_type_sku: string;
	readonly assigned_date: string;
	readonly can_signup_for_limited: boolean;
	readonly chat_enabled: boolean;
	readonly analytics_tracking_id: string;
	readonly limited_user_quotas?: {
		readonly chat: number;
		readonly completions: number;
	};
	readonly monthly_quotas?: {
		readonly chat: number;
		readonly completions: number;
	};
	readonly limited_user_reset_date: string;
}

interface ITokenEntitlementsResponse {
	token: string;
}

export const IDefaultAccountService = createDecorator<IDefaultAccountService>('defaultAccountService');

export interface IDefaultAccountService {

	readonly _serviceBrand: undefined;

	readonly onDidChangeDefaultAccount: Event<IDefaultAccount | null>;

	getDefaultAccount(): Promise<IDefaultAccount | null>;
	setDefaultAccount(account: IDefaultAccount | null): void;
}

export class DefaultAccountService extends Disposable implements IDefaultAccountService {
	declare _serviceBrand: undefined;

	private _defaultAccount: IDefaultAccount | null | undefined = undefined;
	get defaultAccount(): IDefaultAccount | null { return this._defaultAccount ?? null; }

	private readonly initBarrier = new Barrier();

	private readonly _onDidChangeDefaultAccount = this._register(new Emitter<IDefaultAccount | null>());
	readonly onDidChangeDefaultAccount = this._onDidChangeDefaultAccount.event;

	async getDefaultAccount(): Promise<IDefaultAccount | null> {
		await this.initBarrier.wait();
		return this.defaultAccount;
	}

	setDefaultAccount(account: IDefaultAccount | null): void {
		const oldAccount = this._defaultAccount;
		this._defaultAccount = account;

		if (oldAccount !== this._defaultAccount) {
			this._onDidChangeDefaultAccount.fire(this._defaultAccount);
		}

		this.initBarrier.open();
	}

}

export class NullDefaultAccountService extends Disposable implements IDefaultAccountService {

	declare _serviceBrand: undefined;

	readonly onDidChangeDefaultAccount = Event.None;

	async getDefaultAccount(): Promise<IDefaultAccount | null> {
		return null;
	}

	setDefaultAccount(account: IDefaultAccount | null): void {
		// noop
	}

}

export class DefaultAccountManagementContribution extends Disposable implements IWorkbenchContribution {

	static ID = 'workbench.contributions.defaultAccountManagement';

	private defaultAccount: IDefaultAccount | null = null;
	private readonly accountStatusContext: IContextKey<string>;

	constructor(
		@IDefaultAccountService private readonly defaultAccountService: IDefaultAccountService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IProductService private readonly productService: IProductService,
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();
		this.accountStatusContext = CONTEXT_DEFAULT_ACCOUNT_STATE.bindTo(contextKeyService);
		this.initialize();
	}

	private async initialize(): Promise<void> {
		if (!this.productService.defaultAccount) {
			return;
		}

		const { authenticationProvider, tokenEntitlementUrl, chatEntitlementUrl } = this.productService.defaultAccount;
		await this.extensionService.whenInstalledExtensionsRegistered();

		const declaredProvider = this.authenticationService.declaredProviders.find(provider => provider.id === authenticationProvider.id);
		if (!declaredProvider) {
			this.logService.info(`Default account authentication provider ${authenticationProvider} is not declared.`);
			return;
		}

		this.registerSignInAction(authenticationProvider.id, declaredProvider.label, authenticationProvider.enterpriseProviderId, authenticationProvider.enterpriseProviderConfig, authenticationProvider.scopes);
		this.setDefaultAccount(await this.getDefaultAccountFromAuthenticatedSessions(authenticationProvider.id, authenticationProvider.enterpriseProviderId, authenticationProvider.enterpriseProviderConfig, authenticationProvider.scopes, tokenEntitlementUrl, chatEntitlementUrl));

		this._register(this.authenticationService.onDidChangeSessions(async e => {
			if (e.providerId !== authenticationProvider.id && e.providerId !== authenticationProvider.enterpriseProviderId) {
				return;
			}

			if (this.defaultAccount && e.event.removed?.some(session => session.id === this.defaultAccount?.sessionId)) {
				this.setDefaultAccount(null);
				return;
			}
			this.setDefaultAccount(await this.getDefaultAccountFromAuthenticatedSessions(authenticationProvider.id, authenticationProvider.enterpriseProviderId, authenticationProvider.enterpriseProviderConfig, authenticationProvider.scopes, tokenEntitlementUrl, chatEntitlementUrl));
		}));

	}

	private setDefaultAccount(account: IDefaultAccount | null): void {
		this.defaultAccount = account;
		this.defaultAccountService.setDefaultAccount(this.defaultAccount);
		if (this.defaultAccount) {
			this.accountStatusContext.set(DefaultAccountStatus.Available);
		} else {
			this.accountStatusContext.set(DefaultAccountStatus.Unavailable);
		}
	}

	private extractFromToken(token: string, key: string): string | undefined {
		const result = new Map<string, string>();
		const firstPart = token?.split(':')[0];
		const fields = firstPart?.split(';');
		for (const field of fields) {
			const [key, value] = field.split('=');
			result.set(key, value);
		}
		return result.get(key);
	}

	private async getDefaultAccountFromAuthenticatedSessions(authProviderId: string, enterpriseAuthProviderId: string, enterpriseAuthProviderConfig: string, scopes: string[], tokenEntitlementUrl: string, chatEntitlementUrl: string): Promise<IDefaultAccount | null> {
		const id = this.configurationService.getValue(enterpriseAuthProviderConfig) ? enterpriseAuthProviderId : authProviderId;
		const sessions = await this.authenticationService.getSessions(id, undefined, undefined, true);
		const session = sessions.find(s => this.scopesMatch(s.scopes, scopes));

		if (!session) {
			return null;
		}

		const [chatEntitlements, tokenEntitlements] = await Promise.all([
			this.getChatEntitlements(session.accessToken, chatEntitlementUrl),
			this.getTokenEntitlements(session.accessToken, tokenEntitlementUrl)
		]);

		return {
			sessionId: session.id,
			enterprise: id === enterpriseAuthProviderId || session.account.label.includes('_'),
			...chatEntitlements,
			...tokenEntitlements,
		};
	}

	private scopesMatch(scopes: ReadonlyArray<string>, expectedScopes: string[]): boolean {
		return scopes.length === expectedScopes.length && expectedScopes.every(scope => scopes.includes(scope));
	}

	private async getTokenEntitlements(accessToken: string, tokenEntitlementsUrl: string): Promise<Partial<IDefaultAccount>> {
		if (!tokenEntitlementsUrl) {
			return {};
		}

		try {
			const chatContext = await this.requestService.request({
				type: 'GET',
				url: tokenEntitlementsUrl,
				disableCache: true,
				headers: {
					'Authorization': `Bearer ${accessToken}`
				}
			}, CancellationToken.None);

			const chatData = await asJson<ITokenEntitlementsResponse>(chatContext);
			if (chatData) {
				return {
					// Editor preview features are disabled if the flag is present and set to 0
					chat_preview_features_enabled: this.extractFromToken(chatData.token, 'editor_preview_features') !== '0',
				};
			}
			this.logService.error('Failed to fetch token entitlements', 'No data returned');
		} catch (error) {
			this.logService.error('Failed to fetch token entitlements', getErrorMessage(error));
		}

		return {};
	}

	private async getChatEntitlements(accessToken: string, chatEntitlementsUrl: string): Promise<Partial<IChatEntitlementsResponse>> {
		if (!chatEntitlementsUrl) {
			return {};
		}

		try {
			const context = await this.requestService.request({
				type: 'GET',
				url: chatEntitlementsUrl,
				disableCache: true,
				headers: {
					'Authorization': `Bearer ${accessToken}`
				}
			}, CancellationToken.None);

			const data = await asJson<IChatEntitlementsResponse>(context);
			if (data) {
				return data;
			}
			this.logService.error('Failed to fetch entitlements', 'No data returned');
		} catch (error) {
			this.logService.error('Failed to fetch entitlements', getErrorMessage(error));
		}
		return {};
	}

	private registerSignInAction(authProviderId: string, authProviderLabel: string, enterpriseAuthProviderId: string, enterpriseAuthProviderConfig: string, scopes: string[]): void {
		const that = this;
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: 'workbench.accounts.actions.signin',
					title: localize('sign in', "Sign in to {0}", authProviderLabel),
					menu: {
						id: MenuId.AccountsContext,
						when: ContextKeyExpr.and(CONTEXT_DEFAULT_ACCOUNT_STATE.isEqualTo(DefaultAccountStatus.Unavailable), ContextKeyExpr.has('config.extensions.gallery.serviceUrl')),
						group: '0_signin',
					}
				});
			}
			run(): Promise<any> {
				const id = that.configurationService.getValue(enterpriseAuthProviderConfig) ? enterpriseAuthProviderId : authProviderId;
				return that.authenticationService.createSession(id, scopes);
			}
		}));
	}

}
