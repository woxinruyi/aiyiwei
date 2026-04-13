/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 依赖注入系统核心】
 *  本文件实现 VSCode/Void 的依赖注入（DI）系统，提供服务注册、解析和生命周期管理：
 *
 *  【核心职责】
 *  1. 定义服务标识符（ServiceIdentifier）
 *  2. 实现服务装饰器（createDecorator）
 *  3. 提供服务访问器（ServicesAccessor）
 *  4. 实现服务集合（ServiceCollection）
 *  5. 管理服务的依赖关系
 *
 *  【依赖注入架构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  createDecorator<T>(id) - 创建服务装饰器               │
 *  │  ├─ 生成唯一服务标识符                                  │
 *  │  ├─ 附加到类构造函数                                    │
 *  │  └─ 注入到构造函数参数                                  │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  ServiceCollection - 服务集合                          │
 *  │  ├─ set(id, instance): 注册服务实例                     │
 *  │  ├─ get(id): 获取服务实例                               │
 *  │  └─ 管理所有服务的生命周期                              │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  IInstantiationService - 实例化服务                    │
 *  │  ├─ createInstance(ctor, ...args): 创建服务实例         │
 *  │  ├─ invokeFunction(fn, ...args): 调用函数并注入服务       │
 *  │  └─ 自动解析和注入依赖                                  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【使用场景】
 *  - 注册服务: registerSingleton(IMyService, MyService)
 *  - 使用服务: constructor(@IMyService private myService: IMyService)
 *  - 创建实例: instantiationService.createInstance(MyClass)
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../base/common/lifecycle.js';
import * as descriptors from './descriptors.js';
import { ServiceCollection } from './serviceCollection.js';

// ------ internal util

export namespace _util {

	export const serviceIds = new Map<string, ServiceIdentifier<any>>();

	export const DI_TARGET = '$di$target';
	export const DI_DEPENDENCIES = '$di$dependencies';

	export function getServiceDependencies(ctor: any): { id: ServiceIdentifier<any>; index: number }[] {
		return ctor[DI_DEPENDENCIES] || [];
	}
}

// --- interfaces ------

export type BrandedService = { _serviceBrand: undefined };

export interface IConstructorSignature<T, Args extends any[] = []> {
	new <Services extends BrandedService[]>(...args: [...Args, ...Services]): T;
}

export interface ServicesAccessor {
	get<T>(id: ServiceIdentifier<T>): T;
}

export const IInstantiationService = createDecorator<IInstantiationService>('instantiationService');

/**
 * Given a list of arguments as a tuple, attempt to extract the leading, non-service arguments
 * to their own tuple.
 */
export type GetLeadingNonServiceArgs<TArgs extends any[]> =
	TArgs extends [] ? []
	: TArgs extends [...infer TFirst, BrandedService] ? GetLeadingNonServiceArgs<TFirst>
	: TArgs;

export interface IInstantiationService {

	readonly _serviceBrand: undefined;

	/**
	 * Synchronously creates an instance that is denoted by the descriptor
	 */
	createInstance<T>(descriptor: descriptors.SyncDescriptor0<T>): T;
	createInstance<Ctor extends new (...args: any[]) => unknown, R extends InstanceType<Ctor>>(ctor: Ctor, ...args: GetLeadingNonServiceArgs<ConstructorParameters<Ctor>>): R;

	/**
	 * Calls a function with a service accessor.
	 */
	invokeFunction<R, TS extends any[] = []>(fn: (accessor: ServicesAccessor, ...args: TS) => R, ...args: TS): R;

	/**
	 * Creates a child of this service which inherits all current services
	 * and adds/overwrites the given services.
	 *
	 * NOTE that the returned child is `disposable` and should be disposed when not used
	 * anymore. This will also dispose all the services that this service has created.
	 */
	createChild(services: ServiceCollection, store?: DisposableStore): IInstantiationService;

	/**
	 * Disposes this instantiation service.
	 *
	 * - Will dispose all services that this instantiation service has created.
	 * - Will dispose all its children but not its parent.
	 * - Will NOT dispose services-instances that this service has been created with
	 * - Will NOT dispose consumer-instances this service has created
	 */
	dispose(): void;
}


/**
 * Identifies a service of type `T`.
 */
export interface ServiceIdentifier<T> {
	(...args: any[]): void;
	type: T;
}

function storeServiceDependency(id: Function, target: Function, index: number): void {
	if ((target as any)[_util.DI_TARGET] === target) {
		(target as any)[_util.DI_DEPENDENCIES].push({ id, index });
	} else {
		(target as any)[_util.DI_DEPENDENCIES] = [{ id, index }];
		(target as any)[_util.DI_TARGET] = target;
	}
}

/**
 * The *only* valid way to create a {{ServiceIdentifier}}.
 */
export function createDecorator<T>(serviceId: string): ServiceIdentifier<T> {

	if (_util.serviceIds.has(serviceId)) {
		return _util.serviceIds.get(serviceId)!;
	}

	const id = <any>function (target: Function, key: string, index: number) {
		if (arguments.length !== 3) {
			throw new Error('@IServiceName-decorator can only be used to decorate a parameter');
		}
		storeServiceDependency(id, target, index);
	};

	id.toString = () => serviceId;

	_util.serviceIds.set(serviceId, id);
	return id;
}

export function refineServiceDecorator<T1, T extends T1>(serviceIdentifier: ServiceIdentifier<T1>): ServiceIdentifier<T> {
	return <ServiceIdentifier<T>>serviceIdentifier;
}
