// An ESM consumer of the built package. `bun run test:package` type-checks this
// with skipLibCheck off; every @ts-expect-error below must stay an error.
import { pipe } from '@railway-ts/pipelines/composition';
import { mapToResult, some, type Option } from '@railway-ts/pipelines/option';
import { mapToOption, ok, type Result } from '@railway-ts/pipelines/result';
import {
  minLength,
  number,
  object,
  optional,
  parseURL,
  required,
  string,
  tuple,
  validate,
  type AsyncValidator,
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

// object() output makes undefined-accepting keys optional, keeping undefined: { age?: number | undefined }.
type OutputOf<V> = V extends Validator<unknown, infer O> ? O : never;
const user = object({ name: required(string()), age: optional(number()) });
export const withoutAge: OutputOf<typeof user> = { name: 'a' };
export const undefinedAge: OutputOf<typeof user> = { name: 'a', age: undefined };
declare const maybeAge: number | undefined;
export const fromMaybe: InferSchemaType<typeof user> = { name: 'a', age: maybeAge };
declare const out: OutputOf<typeof user>;
// @ts-expect-error the output can hold age: undefined, so it isn't { age?: number } under the flag
export const notExact: { name: string; age?: number } = out;
// @ts-expect-error age is a number when present
export const badAge: OutputOf<typeof user> = { name: 'a', age: '1' };
export const validated: Result<{ name: string; age?: number | undefined }, ValidationError[]> = validate({}, user);

// InferSchemaType is the validator's output type, unchanged.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export const inferIsOutput: Equal<InferSchemaType<typeof user>, OutputOf<typeof user>> = true;
type Hand = Validator<unknown, { a: number | undefined; list: { b: string | undefined }[] }>;
export const handInferred: Equal<
  InferSchemaType<Hand>,
  { a: number | undefined; list: { b: string | undefined }[] }
> = true;
const site = object({ home: required(parseURL()) });
export const urlKept: Equal<InferSchemaType<typeof site>, { home: URL }> = true;
class Money {
  #cents = 0;
  get cents(): number {
    return this.#cents;
  }
}
declare const money: Validator<unknown, Money>;
export const classKept: Equal<InferSchemaType<typeof money>, Money> = true;
const priced = object({ price: money });
export const nestedClassKept: Equal<InferSchemaType<typeof priced>, { price: Money }> = true;
const atLeast3 = minLength(3);
export const nonUnknownInput: Equal<InferSchemaType<typeof atLeast3>, string> = true;
declare const fetchName: AsyncValidator<unknown, string>;
export const asyncInferred: Equal<InferSchemaType<typeof fetchName>, string> = true;

declare const slow: MaybeAsyncValidator<unknown, string>;
const userAsync = object({ name: slow, age: optional(number()) });
type AsyncOutputOf<V> = V extends MaybeAsyncValidator<unknown, infer O> ? O : never;
export const asyncOut: Equal<AsyncOutputOf<typeof userAsync>, { name: string; age?: number | undefined }> = true;
export const asyncInferIsOutput: Equal<InferSchemaType<typeof userAsync>, AsyncOutputOf<typeof userAsync>> = true;
