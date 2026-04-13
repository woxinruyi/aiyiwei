/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Define TextEncoder + TextDecoder globals for both browser and node runtimes
//
// Proper fix: https://github.com/microsoft/TypeScript/issues/31535
//
// Note: Node.js v22+ already includes TextDecoder/TextEncoder types, so no declaration needed here.

export { };
