import { describe, test, expect } from 'bun:test';

import {
  type Option,
  some,
  none,
  isSome,
  isNone,
  map,
  bimap,
  flatMap,
  filter,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  combine,
  match,
  tap,
  mapToResult,
  fromNullable,
} from '@/option';
import { isOk, isErr } from '@/result';

describe('Option', () => {
  describe('bimap function', () => {
    test('maps Some using someFn and ignores noneFn', () => {
      const someValue = some(21);
      const mapped = bimap(
        someValue,
        (n) => some(n * 2),
        () => {
          throw new Error('noneFn should not be called');
        },
      );

      expect(isSome(mapped)).toBe(true);
      if (isSome(mapped)) {
        expect(mapped.value).toBe(42);
      }
    });

    test('maps None using noneFn and ignores someFn', () => {
      const noneValue = none<number>();
      const mapped = bimap(
        noneValue,
        (n) => {
          // If called, fail revealing the unexpected value
          throw new Error(`someFn should not be called: ${n}`);
        },
        () => some('fallback'),
      );

      expect(isSome(mapped)).toBe(true);
      if (isSome(mapped)) {
        expect(mapped.value).toBe('fallback');
      }
    });
  });
  describe('some and none constructors', () => {
    test('some creates an Option with a value', () => {
      const option = some(42);
      expect(option.some).toBe(true);
      expect(isSome(option)).toBe(true);
      expect(isNone(option)).toBe(false);

      if (isSome(option)) {
        expect(option.value).toBe(42);
      }
    });

    test('none creates an Option with no value', () => {
      const option = none<number>();
      expect(option.some).toBe(false);
      expect(isNone(option)).toBe(true);
      expect(isSome(option)).toBe(false);
    });

    test('some with different value types', () => {
      // String
      const stringOption = some('hello');
      expect(stringOption.some).toBe(true);
      if (isSome(stringOption)) {
        expect(stringOption.value).toBe('hello');
      }

      // Boolean
      const boolOption = some(true);
      expect(boolOption.some).toBe(true);
      if (isSome(boolOption)) {
        expect(boolOption.value).toBe(true);
      }

      // Object
      const obj = { name: 'test', value: 123 };
      const objOption = some(obj);
      expect(objOption.some).toBe(true);
      if (isSome(objOption)) {
        expect(objOption.value).toBe(obj);
      }

      // Array
      const arr = [1, 2, 3];
      const arrOption = some(arr);
      expect(arrOption.some).toBe(true);
      if (isSome(arrOption)) {
        expect(arrOption.value).toBe(arr);
      }

      // Undefined
      const undefinedOption = some(undefined);
      expect(undefinedOption.some).toBe(true);
      if (isSome(undefinedOption)) {
        expect(undefinedOption.value).toBeUndefined();
      }
    });
  });

  describe('isSome and isNone type guards', () => {
    test('isSome returns true for Some variant', () => {
      const option = some(42);
      expect(isSome(option)).toBe(true);
    });

    test('isSome returns false for None variant', () => {
      const option = none<number>();
      expect(isSome(option)).toBe(false);
    });

    test('isNone returns true for None variant', () => {
      const option = none<string>();
      expect(isNone(option)).toBe(true);
    });

    test('isNone returns false for Some variant', () => {
      const option = some('hello');
      expect(isNone(option)).toBe(false);
    });

    test('type narrowing works with isSome', () => {
      const option: Option<number> = some(42);

      if (isSome(option)) {
        expect(option.value).toBe(42);
      } else {
        expect(true).toBe(false);
      }
    });

    test('type narrowing works with isNone', () => {
      const option: Option<number> = none();

      if (isNone(option)) {
        expect(true).toBe(true);
      } else {
        expect(true).toBe(false);
      }
    });
  });

  describe('map function', () => {
    test('maps Some variant', () => {
      const option = some(42);
      const mapped = map(option, (x) => x * 2);

      expect(isSome(mapped)).toBe(true);
      if (isSome(mapped)) {
        expect(mapped.value).toBe(84);
      }
    });

    test('preserves None variant', () => {
      const option = none<number>();
      const mapped = map(option, (x) => x * 2);

      expect(isNone(mapped)).toBe(true);
    });

    test('supports type transformation', () => {
      const option = some(42);
      const mapped = map(option, (x) => x.toString());

      expect(isSome(mapped)).toBe(true);
      if (isSome(mapped)) {
        expect(mapped.value).toBe('42');
        expect(typeof mapped.value).toBe('string');
      }
    });
  });

  describe('flatMap function', () => {
    test('flatMaps Some to Some', () => {
      const option = some(42);
      const flatMapped = flatMap(option, (x) => some(x * 2));

      expect(isSome(flatMapped)).toBe(true);
      if (isSome(flatMapped)) {
        expect(flatMapped.value).toBe(84);
      }
    });

    test('flatMaps Some to None', () => {
      const option = some(42);
      const flatMapped = flatMap(option, () => none<number>());

      expect(isNone(flatMapped)).toBe(true);
    });

    test('preserves None variant', () => {
      const option = none<number>();
      const flatMapped = flatMap(option, (x) => some(x * 2));

      expect(isNone(flatMapped)).toBe(true);
    });

    test('supports type transformation', () => {
      const option = some(42);
      const flatMapped = flatMap(option, (x) => some(x.toString()));

      expect(isSome(flatMapped)).toBe(true);
      if (isSome(flatMapped)) {
        expect(flatMapped.value).toBe('42');
        expect(typeof flatMapped.value).toBe('string');
      }
    });
  });

  describe('filter function', () => {
    test('keeps Some that passes predicate', () => {
      const option = some(42);
      const filtered = filter(option, (x) => x > 40);

      expect(isSome(filtered)).toBe(true);
      if (isSome(filtered)) {
        expect(filtered.value).toBe(42);
      }
    });

    test('converts Some to None if it fails predicate', () => {
      const option = some(42);
      const filtered = filter(option, (x) => x > 100);

      expect(isNone(filtered)).toBe(true);
    });

    test('preserves None variant', () => {
      const option = none<number>();
      const filtered = filter(option, (x) => x > 40);

      expect(isNone(filtered)).toBe(true);
    });
  });

  describe('unwrap function', () => {
    test('unwraps Some variant', () => {
      const option = some(42);
      expect(unwrap(option)).toBe(42);
    });

    test('throws when unwrapping None', () => {
      const option = none<number>();
      expect(() => unwrap(option)).toThrow('Cannot unwrap a none Option');
    });

    test('throws with custom message when unwrapping None', () => {
      const option = none<number>();
      const customMsg = 'Custom error message';
      expect(() => unwrap(option, customMsg)).toThrow(customMsg);
    });
  });

  describe('unwrapOr function', () => {
    test('returns value from Some variant', () => {
      const option = some(42);
      expect(unwrapOr(option, 0)).toBe(42);
    });

    test('returns default value for None variant', () => {
      const option = none<number>();
      expect(unwrapOr(option, 0)).toBe(0);
    });
  });

  describe('unwrapOrElse function', () => {
    test('returns value from Some variant', () => {
      const option = some(42);
      let defaultFnCalled = false;

      const result = unwrapOrElse(option, () => {
        defaultFnCalled = true;
        return 0;
      });

      expect(result).toBe(42);
      expect(defaultFnCalled).toBe(false);
    });

    test('calls generator function for None variant', () => {
      const option = none<number>();
      let defaultFnCalled = false;

      const result = unwrapOrElse(option, () => {
        defaultFnCalled = true;
        return 99;
      });

      expect(result).toBe(99);
      expect(defaultFnCalled).toBe(true);
    });
  });

  describe('combine function', () => {
    test('combines array of Some options', () => {
      const options = [some(1), some(2), some(3)];
      const result = combine(options);

      expect(isSome(result)).toBe(true);
      if (isSome(result)) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });

    test('returns None if any option is None', () => {
      const options = [some(1), none<number>(), some(3)];
      const result = combine(options);

      expect(isNone(result)).toBe(true);
    });

    test('works with empty array', () => {
      const options: Option<number>[] = [];
      const result = combine(options);

      expect(isSome(result)).toBe(true);
      if (isSome(result)) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('match function', () => {
    test('matches Some variant', () => {
      const option = some(42);
      const result = match(option, {
        some: (value) => `Got ${value}`,
        none: () => 'Got nothing',
      });

      expect(result).toBe('Got 42');
    });

    test('matches None variant', () => {
      const option = none<number>();
      const result = match(option, {
        some: (value) => `Got ${value}`,
        none: () => 'Got nothing',
      });

      expect(result).toBe('Got nothing');
    });

    test('supports different return types', () => {
      const optionStr = some('hello');
      const result = match(optionStr, {
        some: (value) => value.length,
        none: () => 0,
      });

      expect(result).toBe(5);
    });
  });

  describe('tap function', () => {
    test('executes function for Some without changing the Option', () => {
      const option = some(42);
      let sideEffect = 0;

      const result = tap(option, (value) => {
        sideEffect = value;
      });

      expect(sideEffect).toBe(42); // Side effect happened
      expect(isSome(result)).toBe(true);
      if (isSome(result)) {
        expect(result.value).toBe(42); // Original value preserved
      }
      expect(result).toBe(option); // Same object reference
    });

    test('does nothing for None', () => {
      const option = none<number>();
      let sideEffect = 0;

      const result = tap(option, (value) => {
        sideEffect = value;
      });

      expect(sideEffect).toBe(0); // Side effect didn't happen
      expect(isNone(result)).toBe(true);
      expect(result).toBe(option); // Same object reference
    });
  });

  describe('fromNullable function', () => {
    test('creates Some for non-null/undefined values', () => {
      const numberOption = fromNullable(42);
      expect(isSome(numberOption)).toBe(true);
      if (isSome(numberOption)) {
        expect(numberOption.value).toBe(42);
      }

      const stringOption = fromNullable('hello');
      expect(isSome(stringOption)).toBe(true);
      if (isSome(stringOption)) {
        expect(stringOption.value).toBe('hello');
      }

      // Edge cases that should still be Some
      const zeroOption = fromNullable(0);
      expect(isSome(zeroOption)).toBe(true);

      const emptyStringOption = fromNullable('');
      expect(isSome(emptyStringOption)).toBe(true);

      const falseOption = fromNullable(false);
      expect(isSome(falseOption)).toBe(true);
    });

    test('creates None for undefined values', () => {
      // Test with explicit undefined
      const undefinedOption = fromNullable(undefined);
      expect(isNone(undefinedOption)).toBe(true);

      // Test with implicit undefined (missing parameter)
      let value;
      const implicitOption = fromNullable(value);
      expect(isNone(implicitOption)).toBe(true);
    });
  });

  describe('mapToResult function', () => {
    test('converts Some to Ok', () => {
      const option = some(42);
      const result = mapToResult(option, 'Error message');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    test('converts None to Err', () => {
      const option = none<number>();
      const errorMsg = 'Error message';
      const result = mapToResult(option, errorMsg);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe(errorMsg);
      }
    });
  });

  describe('Option composition', () => {
    test('can compose multiple operations', () => {
      const startOption = some(42);

      // Let's compose multiple operations
      const result = flatMap(
        map(startOption, (x) => x * 2),
        (x) => filter(some(x.toString()), (str) => str.length > 1),
      );

      expect(isSome(result)).toBe(true);
      if (isSome(result)) {
        expect(result.value).toBe('84');
      }
    });

    test('handles compositions that result in None', () => {
      const startOption = some(5);

      // This composition should result in None
      const result = flatMap(
        map(startOption, (x) => x * 2),
        (x) => filter(some(x.toString()), (str) => str.length > 2),
      );

      expect(isNone(result)).toBe(true);
    });
  });
});
