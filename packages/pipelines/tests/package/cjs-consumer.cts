// A CommonJS consumer. Under `module: nodenext` these imports compile to
// require() of the ESM package (Node 22.12+) and get the package's only declarations.
import { isOk, ok, type Result } from '@railway-ts/pipelines/result';

export const checked: boolean = isOk(ok(1));
// @ts-expect-error a forged Result is not a Result
export const forged: Result<number, string> = { ok: true, value: 1 };
