// An ESM consumer of the built package. `bun run test:package` type-checks this
// with skipLibCheck off; every @ts-expect-error below must stay an error.
import { pipe } from '@railway-ts/pipelines/composition';
import { mapToResult, some, type Option } from '@railway-ts/pipelines/option';
import { mapToOption, ok, type Result } from '@railway-ts/pipelines/result';
import {
  number,
  object,
  optional,
  required,
  string,
  tuple,
  validate,
  type InferSchemaType,
  type MaybeAsyncValidator,
  type ValidationError,
  type Validator,
} from '@railway-ts/pipelines/schema';

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

// object() output makes undefined-accepting keys optional, matching InferSchemaType.
type OutputOf<V> = V extends Validator<unknown, infer O> ? O : never;
const user = object({ name: required(string()), age: optional(number()) });
export const withoutAge: OutputOf<typeof user> = { name: 'a' };
declare const out: OutputOf<typeof user>;
declare const inferred: InferSchemaType<typeof user>;
export const outToInfer: InferSchemaType<typeof user> = out;
export const inferToOut: OutputOf<typeof user> = inferred;
// @ts-expect-error age is a number when present
export const badAge: OutputOf<typeof user> = { name: 'a', age: '1' };
export const validated: Result<{ name: string; age?: number }, ValidationError[]> = validate({}, user);

// InferSchemaType of a hand-typed validator: the same before and after ProcessType reuses ObjectOutput.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Hand = Validator<unknown, { a: number | undefined; list: { b: string | undefined }[] }>;
export const handInferred: Equal<InferSchemaType<Hand>, { a?: number; list: { b?: string }[] }> = true;

declare const slow: MaybeAsyncValidator<unknown, string>;
const userAsync = object({ name: slow, age: optional(number()) });
type AsyncOutputOf<V> = V extends MaybeAsyncValidator<unknown, infer O> ? O : never;
export const asyncOut: Equal<AsyncOutputOf<typeof userAsync>, { name: string; age?: number }> = true;
