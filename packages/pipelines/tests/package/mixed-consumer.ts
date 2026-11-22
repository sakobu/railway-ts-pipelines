// An ESM file using a Result created in a CommonJS file (cjs-result.cts). The package is
// ESM-only, so both files get their types from the same declarations and share one brand.
import { type Result } from '@railway-ts/pipelines/result';

import { cjsResult } from './cjs-result.cjs';

export const fromCjs: Result<number, string> = cjsResult;
