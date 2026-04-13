/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 工作台配置服务常量】
 *  本文件定义工作台配置服务的常量和类型，用于管理 VSCode/Void 的配置层级：
 *
 *  【核心职责】
 *  1. 定义配置文件夹名称（.vscode）
 *  2. 定义配置文件路径（settings.json, launch.json, tasks.json）
 *  3. 定义配置模式 ID（Schema IDs）
 *  4. 定义配置作用域常量（Scopes）
 *  5. 区分用户和工作区的独立配置
 *
 *  【配置文件夹结构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  .vscode/ - 工作区配置文件夹                           │
 *  │  ├─ settings.json - 工作区设置                        │
 *  │  ├─ launch.json - 调试配置                            │
 *  │  ├─ tasks.json - 任务配置                            │
 *  │  └─ mcp.json - Model Context Protocol 配置             │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【配置作用域（Scopes）】
 *  - APPLICATION_SCOPES: 应用级配置
 *  - PROFILE_SCOPES: 用户配置档配置
 *  - LOCAL_MACHINE_SCOPES: 本地机器配置
 *  - REMOTE_MACHINE_SCOPES: 远程机器配置
 *  - WORKSPACE_SCOPES: 工作区配置
 *  - FOLDER_SCOPES: 文件夹配置
 *
 *  【与 platform/configuration 的关系】
 *  - 本文件定义工作台特定的配置常量
 *  - platform/configuration 定义通用配置接口
 *
 *  【修改历史】2026-04-02: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { IAnyWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';

export const FOLDER_CONFIG_FOLDER_NAME = '.vscode';
export const FOLDER_SETTINGS_NAME = 'settings';
export const FOLDER_SETTINGS_PATH = `${FOLDER_CONFIG_FOLDER_NAME}/${FOLDER_SETTINGS_NAME}.json`;

export const defaultSettingsSchemaId = 'vscode://schemas/settings/default';
export const userSettingsSchemaId = 'vscode://schemas/settings/user';
export const profileSettingsSchemaId = 'vscode://schemas/settings/profile';
export const machineSettingsSchemaId = 'vscode://schemas/settings/machine';
export const workspaceSettingsSchemaId = 'vscode://schemas/settings/workspace';
export const folderSettingsSchemaId = 'vscode://schemas/settings/folder';
export const launchSchemaId = 'vscode://schemas/launch';
export const tasksSchemaId = 'vscode://schemas/tasks';
export const mcpSchemaId = 'vscode://schemas/mcp';

export const APPLICATION_SCOPES = [ConfigurationScope.APPLICATION, ConfigurationScope.APPLICATION_MACHINE];
export const PROFILE_SCOPES = [ConfigurationScope.MACHINE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const LOCAL_MACHINE_PROFILE_SCOPES = [ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE];
export const LOCAL_MACHINE_SCOPES = [ConfigurationScope.APPLICATION, ...LOCAL_MACHINE_PROFILE_SCOPES];
export const REMOTE_MACHINE_SCOPES = [ConfigurationScope.MACHINE, ConfigurationScope.APPLICATION_MACHINE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const WORKSPACE_SCOPES = [ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const FOLDER_SCOPES = [ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];

export const TASKS_CONFIGURATION_KEY = 'tasks';
export const LAUNCH_CONFIGURATION_KEY = 'launch';
export const MCP_CONFIGURATION_KEY = 'mcp';

export const WORKSPACE_STANDALONE_CONFIGURATIONS = Object.create(null);
WORKSPACE_STANDALONE_CONFIGURATIONS[TASKS_CONFIGURATION_KEY] = `${FOLDER_CONFIG_FOLDER_NAME}/${TASKS_CONFIGURATION_KEY}.json`;
WORKSPACE_STANDALONE_CONFIGURATIONS[LAUNCH_CONFIGURATION_KEY] = `${FOLDER_CONFIG_FOLDER_NAME}/${LAUNCH_CONFIGURATION_KEY}.json`;
WORKSPACE_STANDALONE_CONFIGURATIONS[MCP_CONFIGURATION_KEY] = `${FOLDER_CONFIG_FOLDER_NAME}/${MCP_CONFIGURATION_KEY}.json`;
export const USER_STANDALONE_CONFIGURATIONS = Object.create(null);
USER_STANDALONE_CONFIGURATIONS[TASKS_CONFIGURATION_KEY] = `${TASKS_CONFIGURATION_KEY}.json`;
USER_STANDALONE_CONFIGURATIONS[MCP_CONFIGURATION_KEY] = `${MCP_CONFIGURATION_KEY}.json`;

export type ConfigurationKey = { type: 'defaults' | 'user' | 'workspaces' | 'folder'; key: string };

export interface IConfigurationCache {

	needsCaching(resource: URI): boolean;
	read(key: ConfigurationKey): Promise<string>;
	write(key: ConfigurationKey, content: string): Promise<void>;
	remove(key: ConfigurationKey): Promise<void>;

}

export type RestrictedSettings = {
	default: ReadonlyArray<string>;
	application?: ReadonlyArray<string>;
	userLocal?: ReadonlyArray<string>;
	userRemote?: ReadonlyArray<string>;
	workspace?: ReadonlyArray<string>;
	workspaceFolder?: ResourceMap<ReadonlyArray<string>>;
};

export const IWorkbenchConfigurationService = refineServiceDecorator<IConfigurationService, IWorkbenchConfigurationService>(IConfigurationService);
export interface IWorkbenchConfigurationService extends IConfigurationService {
	/**
	 * Restricted settings defined in each configuration target
	 */
	readonly restrictedSettings: RestrictedSettings;

	/**
	 * Event that triggers when the restricted settings changes
	 */
	readonly onDidChangeRestrictedSettings: Event<RestrictedSettings>;

	/**
	 * A promise that resolves when the remote configuration is loaded in a remote window.
	 * The promise is resolved immediately if the window is not remote.
	 */
	whenRemoteConfigurationLoaded(): Promise<void>;

	/**
	 * Initialize configuration service for the given workspace
	 * @param arg workspace Identifier
	 */
	initialize(arg: IAnyWorkspaceIdentifier): Promise<void>;

	/**
	 * Returns true if the setting can be applied for all profiles otherwise false.
	 * @param setting
	 */
	isSettingAppliedForAllProfiles(setting: string): boolean;
}

export const TASKS_DEFAULT = '{\n\t\"version\": \"2.0.0\",\n\t\"tasks\": []\n}';

export const APPLY_ALL_PROFILES_SETTING = 'workbench.settings.applyToAllProfiles';
