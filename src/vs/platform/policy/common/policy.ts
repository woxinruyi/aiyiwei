/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 策略服务接口】
 *  本文件定义策略服务，负责管理企业级策略配置（组策略/MDM）：
 *
 *  【核心职责】
 *  1. 管理企业策略定义和值
 *  2. 支持策略定义更新
 *  3. 提供策略值查询接口
 *  4. 触发策略变更事件
 *  5. 序列化策略状态
 *
 *  【策略概念】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  策略用于企业环境中集中管理 VSCode/Void 配置：          │
 *  │  - IT 管理员可通过组策略或 MDM 控制应用设置              │
 *  │  - 策略值覆盖用户设置                                    │
 *  │  - 支持字符串、数字、布尔值类型                          │
 *  │                                                          │
 *  │  示例策略：                                              │
 *  │  - update.mode: 控制更新行为                            │
 *  │  - telemetry.telemetryLevel: 控制遥测级别               │
 *  │  - workbench.enableExperiments: 启用实验性功能         │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【策略定义】
 *  - type: 'string' | 'number' | 'boolean'
 *  - previewFeature: 是否为预览功能
 *  - defaultValue: 默认值
 *
 *  【核心接口】
 *  - IPolicyService: 策略服务接口
 *  - AbstractPolicyService: 抽象基类
 *  - PolicyValue: 策略值类型
 *  - PolicyDefinition: 策略定义类型
 *
 *  【核心方法】
 *  - updatePolicyDefinitions(definitions): 更新策略定义
 *  - getPolicyValue(name): 获取策略值
 *  - serialize(): 序列化策略状态
 *
 *  【使用场景】
 *  - 企业 IT 管理
 *  - 合规性控制
 *  - 集中配置管理
 *  - 限制用户可更改的设置
 *
 *  【与 configuration.ts 的关系】
 *  - 策略值优先于用户设置
 *  - 配置服务检查策略值
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { IStringDictionary } from '../../../base/common/collections.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { PolicyName } from '../../../base/common/policy.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export type PolicyValue = string | number | boolean;
export type PolicyDefinition = { type: 'string' | 'number' | 'boolean'; previewFeature?: boolean; defaultValue?: string | number | boolean };

export const IPolicyService = createDecorator<IPolicyService>('policy');

export interface IPolicyService {
	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<readonly PolicyName[]>;
	updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<IStringDictionary<PolicyValue>>;
	getPolicyValue(name: PolicyName): PolicyValue | undefined;
	serialize(): IStringDictionary<{ definition: PolicyDefinition; value: PolicyValue }> | undefined;
	readonly policyDefinitions: IStringDictionary<PolicyDefinition>;
}

export abstract class AbstractPolicyService extends Disposable implements IPolicyService {
	readonly _serviceBrand: undefined;

	public policyDefinitions: IStringDictionary<PolicyDefinition> = {};
	protected policies = new Map<PolicyName, PolicyValue>();

	protected readonly _onDidChange = this._register(new Emitter<readonly PolicyName[]>());
	readonly onDidChange = this._onDidChange.event;

	async updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<IStringDictionary<PolicyValue>> {
		const size = Object.keys(this.policyDefinitions).length;
		this.policyDefinitions = { ...policyDefinitions, ...this.policyDefinitions };

		if (size !== Object.keys(this.policyDefinitions).length) {
			await this._updatePolicyDefinitions(this.policyDefinitions);
		}

		return Iterable.reduce(this.policies.entries(), (r, [name, value]) => ({ ...r, [name]: value }), {});
	}

	getPolicyValue(name: PolicyName): PolicyValue | undefined {
		return this.policies.get(name);
	}

	serialize(): IStringDictionary<{ definition: PolicyDefinition; value: PolicyValue }> {
		return Iterable.reduce<[PolicyName, PolicyDefinition], IStringDictionary<{ definition: PolicyDefinition; value: PolicyValue }>>(Object.entries(this.policyDefinitions), (r, [name, definition]) => ({ ...r, [name]: { definition, value: this.policies.get(name)! } }), {});
	}

	protected abstract _updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<void>;
}

export class NullPolicyService implements IPolicyService {
	readonly _serviceBrand: undefined;
	readonly onDidChange = Event.None;
	async updatePolicyDefinitions() { return {}; }
	getPolicyValue() { return undefined; }
	serialize() { return undefined; }
	policyDefinitions: IStringDictionary<PolicyDefinition> = {};
}
