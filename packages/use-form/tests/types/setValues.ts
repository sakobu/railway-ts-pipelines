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
