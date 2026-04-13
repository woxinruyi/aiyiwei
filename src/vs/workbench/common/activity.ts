/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  【业务逻辑说明 - 活动栏标识常量】
 *  本文件定义活动栏（Activity Bar）的全局活动标识符常量：
 *
 *  【核心职责】
 *  1. 定义全局活动标识符（GLOBAL_ACTIVITY_ID）- 管理菜单
 *  2. 定义账户活动标识符（ACCOUNTS_ACTIVITY_ID）- 账户管理
 *  3. 统一活动栏动作的标识符命名规范
 *
 *  【活动栏结构】
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  活动栏（Activity Bar）位于工作台左侧                     │
 *  │  包含多个活动按钮：                                       │
 *  │  ├─ 资源管理器图标                                      │
 *  │  ├─ 搜索图标                                            │
 *  │  ├─ 源代码管理图标                                      │
 *  │  ├─ 运行和调试图标                                      │
 *  │  ├─ 扩展图标                                            │
 *  │  ├─ 账户图标（ACCOUNTS_ACTIVITY_ID）                   │
 *  │  └─ 管理图标（GLOBAL_ACTIVITY_ID）                     │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  【使用场景】
 *  - 活动栏按钮点击事件处理
 *  - 菜单贡献点注册（Menu Contributions）
 *  - 命令与活动栏的绑定
 *
 *  【与其他文件的关系】
 *  - 被 activityService.ts 使用，管理活动栏状态
 *  - 被各种贡献文件引用，注册活动栏菜单项
 *
 *  【修改历史】2026-04-03: 添加业务逻辑注释
 *--------------------------------------------------------------------------------------------*/

export const GLOBAL_ACTIVITY_ID = 'workbench.actions.manage';
export const ACCOUNTS_ACTIVITY_ID = 'workbench.actions.accounts';
