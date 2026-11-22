// An ESM file using a Result typed by the CommonJS declarations (cjs-result.cts).
//
// The .d.mts and .d.cts bundles each declare their own `unique symbol` brand, so under
// node16 resolution a Result typed by one is not assignable to the other, even though the
// runtime brands are shared (Symbol.for; see runtime.mjs). This pins that limitation: if
// the brand types are ever shared across the two bundles, this expect-error fails and the
// changelog/docs should be updated.
import { type Result } from '@railway-ts/pipelines/result';

import { cjsResult } from './cjs-result.cjs';

// @ts-expect-error ESM- and CommonJS-typed Results carry different brand types
export const fromCjs: Result<number, string> = cjsResult;
