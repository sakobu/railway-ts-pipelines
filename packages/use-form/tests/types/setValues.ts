import type { UseFormReturn } from '../../src';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const expectTrue = <T extends true>(): T | undefined => undefined;

type SetValuesInput<TValues extends Record<string, unknown>> = Parameters<UseFormReturn<TValues>['setValues']>[0];

// setValues stores a Map or Set as given, so its partial takes the whole value, not a partial of its methods
type Collections = {
  tags: Map<string, number>;
  ids: Set<number>;
  readonlyTags: ReadonlyMap<string, number>;
  readonlyIds: ReadonlySet<number>;
};
expectTrue<
  Equal<
    SetValuesInput<Collections>,
    {
      tags?: Map<string, number>;
      ids?: Set<number>;
      readonlyTags?: ReadonlyMap<string, number>;
      readonlyIds?: ReadonlySet<number>;
    }
  >
>();

// Plain nested objects still take a partial
type Nested = { address: { city: string; zip: string }; avatar: File };
expectTrue<Equal<SetValuesInput<Nested>, { address?: { city?: string; zip?: string }; avatar?: File }>>();

// setValues stores an array as given, so readonly arrays and tuples are given whole too
type Rows = { rows: ReadonlyArray<{ street: string; city: string }>; point: readonly [number, number] };
expectTrue<
  Equal<
    SetValuesInput<Rows>,
    { rows?: ReadonlyArray<{ street: string; city: string }>; point?: readonly [number, number] }
  >
>();

// A value with methods (a URL, a Temporal date, a dayjs-style class) is given whole, so its methods aren't lost
class DayjsLike {
  $d = new Date();
  format(): string {
    return this.$d.toISOString();
  }
}
type Dates = { when: DayjsLike; link: URL; day: Temporal.PlainDate };
expectTrue<Equal<SetValuesInput<Dates>, { when?: DayjsLike; link?: URL; day?: Temporal.PlainDate }>>();

// A record class with only fields takes a partial, which merges into its fields
class Address {
  street = '';
  city = '';
}
expectTrue<Equal<SetValuesInput<{ address: Address }>, { address?: { street?: string; city?: string } }>>();
