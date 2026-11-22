// An ESM consumer of the built package. `bun run test:package` type-checks this
// with skipLibCheck off; every @ts-expect-error below must stay an error.
import { pipe } from '@railway-ts/pipelines/composition';
import { mapToResult, some, type Option } from '@railway-ts/pipelines/option';
import { mapToOption, ok, type Result } from '@railway-ts/pipelines/result';
import { number, string, tuple, type Validator } from '@railway-ts/pipelines/schema';

export const fromResult: Option<number> = mapToOption(ok(1));
export const fromOption: Result<number, string> = mapToResult(some(1), 'missing');
export const piped: number = pipe(1, (n: number) => n + 1);

// The brand keeps Result and Option nominal: a hand-made object must not pass.
// @ts-expect-error a forged Result is not a Result
export const forgedResult: Result<number, string> = { ok: true, value: 1 };
// @ts-expect-error a forged Option is not an Option
export const forgedOption: Option<number> = { some: true, value: 1 };

// tuple() keeps its element types in the published declarations (they used to
// point at a stripped `TupleType`). `as const` is needed for tuple inference.
type PairOf<V> = V extends Validator<unknown, infer O> ? O : never;
const pair = tuple([string(), number()] as const);
export const validatePair: typeof pair = pair;
export const goodPair: PairOf<typeof pair> = ['a', 1];
// @ts-expect-error element types are [string, number]
export const badPair: PairOf<typeof pair> = [1, 'a'];
