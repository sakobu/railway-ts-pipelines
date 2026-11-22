// A CommonJS consumer: under node16 resolution these imports compile to require(),
// so they must resolve to CommonJS declarations (.d.cts), not ESM ones.
import { isOk, ok, type Result } from '@railway-ts/pipelines/result';

export const checked: boolean = isOk(ok(1));
// @ts-expect-error a forged Result is not a Result
export const forged: Result<number, string> = { ok: true, value: 1 };
