import { describe, test, expect } from 'bun:test';

import { isSome, isNone } from '@/option';
import {
  type Result,
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  bimap,
  filter,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  combine,
  combineAll,
  match,
  tap,
  tapErr,
  mapToOption,
  fromTry,
  fromTryWithError,
  fromPromise,
  fromPromiseWithError,
  toPromise,
} from '@/result';

describe('Result', () => {
  describe('bimap function', () => {
    test('maps Ok and ignores Err mapper', () => {
      const okMapper = (n: number) => n.toString();
      const errMapper = (e: string) => {
        // If called, this would fail the test
        throw new Error(`should not be called: ${e}`);
      };

      const result = ok<number, string>(42);
      const mapped = bimap(result, okMapper, errMapper);

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe('42');
        expect(typeof mapped.value).toBe('string');
      }
    });

    test('maps Err and ignores Ok mapper', () => {
      const okMapper = (n: number) => {
        // If called, this would fail the test
        throw new Error(`should not be called: ${n}`);
      };
      const errMapper = (e: string) => new Error(e);

      const result = err('boom');
      const mapped = bimap(result, okMapper, errMapper);

      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBeInstanceOf(Error);
        expect(mapped.error.message).toBe('boom');
      }
    });
  });
  describe('ok and err constructors', () => {
    test('ok creates a Result with a value', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);

      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    test('err creates a Result with an error', () => {
      const error = 'Something went wrong';
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(isErr(result)).toBe(true);
      expect(isOk(result)).toBe(false);

      if (isErr(result)) {
        expect(result.error).toBe(error);
      }
    });

    test('ok with different value types', () => {
      // String
      const stringResult = ok('hello');
      expect(isOk(stringResult)).toBe(true);
      if (isOk(stringResult)) {
        expect(stringResult.value).toBe('hello');
      }

      // Boolean
      const boolResult = ok(true);
      expect(isOk(boolResult)).toBe(true);
      if (isOk(boolResult)) {
        expect(boolResult.value).toBe(true);
      }

      // Object
      const obj = { name: 'test', value: 123 };
      const objResult = ok(obj);
      expect(isOk(objResult)).toBe(true);
      if (isOk(objResult)) {
        expect(objResult.value).toBe(obj);
      }

      // Array
      const arr = [1, 2, 3];
      const arrResult = ok(arr);
      expect(isOk(arrResult)).toBe(true);
      if (isOk(arrResult)) {
        expect(arrResult.value).toBe(arr);
      }

      // Undefined
      const undefinedResult = ok(undefined);
      expect(isOk(undefinedResult)).toBe(true);
      if (isOk(undefinedResult)) {
        expect(undefinedResult.value).toBeUndefined();
      }
    });

    test('err with different error types', () => {
      // String
      const stringError = err('error message');
      expect(isErr(stringError)).toBe(true);
      if (isErr(stringError)) {
        expect(stringError.error).toBe('error message');
      }

      // Object
      const errorObj = { code: 404, message: 'Not found' };
      const objError = err(errorObj);
      expect(isErr(objError)).toBe(true);
      if (isErr(objError)) {
        expect(objError.error).toBe(errorObj);
      }

      // Error instance
      const actualError = new Error('Something bad happened');
      const errorResult = err(actualError);
      expect(isErr(errorResult)).toBe(true);
      if (isErr(errorResult)) {
        expect(errorResult.error).toBe(actualError);
      }
    });
  });

  describe('isOk and isErr type guards', () => {
    test('isOk returns true for Ok variant', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
    });

    test('isOk returns false for Err variant', () => {
      const result = err('error');
      expect(isOk(result)).toBe(false);
    });

    test('isErr returns true for Err variant', () => {
      const result = err('error');
      expect(isErr(result)).toBe(true);
    });

    test('isErr returns false for Ok variant', () => {
      const result = ok(42);
      expect(isErr(result)).toBe(false);
    });

    test('type narrowing works with isOk', () => {
      const result: Result<number, string> = ok(42);

      if (isOk(result)) {
        // This should compile - TypeScript knows result.value exists here
        expect(result.value).toBe(42);
      } else {
        // This branch should never execute in this test
        expect(true).toBe(false);
      }
    });

    test('type narrowing works with isErr', () => {
      const result: Result<number, string> = err('error');

      if (isErr(result)) {
        // This should compile - TypeScript knows result.error exists here
        expect(result.error).toBe('error');
      } else {
        // This branch should never execute in this test
        expect(true).toBe(false);
      }
    });
  });

  describe('map function', () => {
    test('maps Ok variant', () => {
      const result = ok(42);
      const mapped = map(result, (x) => x * 2);

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(84);
      }
    });

    test('preserves Err variant', () => {
      const error = 'something went wrong';
      const result = err<string>(error);
      const mapped = map(result, (x: number) => x * 2);

      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });

    test('supports type transformation', () => {
      const result = ok(42);
      const mapped = map(result, (x) => x.toString());

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe('42');
        // TypeScript should know mapped.value is a string
        expect(typeof mapped.value).toBe('string');
      }
    });
  });

  describe('mapErr function', () => {
    test('preserves Ok variant', () => {
      const result = ok<number, string>(42);
      const mapped = mapErr(result, (e) => new Error(e));

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(42);
      }
    });

    test('maps Err variant', () => {
      const result = err('error');
      const mapped = mapErr(result, (e) => ({ message: e, code: 500 }));

      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toEqual({ message: 'error', code: 500 });
      }
    });

    test('supports error type transformation', () => {
      const result = err('error');
      const mapped = mapErr(result, (e) => new Error(e));

      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBeInstanceOf(Error);
        expect(mapped.error.message).toBe('error');
      }
    });
  });

  describe('flatMap function', () => {
    test('flatMaps Ok to Ok', () => {
      const result = ok(42);
      const flatMapped = flatMap(result, (x) => ok(x * 2));

      expect(isOk(flatMapped)).toBe(true);
      if (isOk(flatMapped)) {
        expect(flatMapped.value).toBe(84);
      }
    });

    test('flatMaps Ok to Err', () => {
      const result = ok(42);
      const error = 'invalid operation';
      const flatMapped = flatMap(result, () => err(error));

      expect(isErr(flatMapped)).toBe(true);
      if (isErr(flatMapped)) {
        expect(flatMapped.error).toBe(error);
      }
    });

    test('preserves Err variant', () => {
      const error = 'original error';
      const result = err<string>(error);
      const flatMapped = flatMap(result, (x: number) => ok(x * 2));

      expect(isErr(flatMapped)).toBe(true);
      if (isErr(flatMapped)) {
        expect(flatMapped.error).toBe(error);
      }
    });

    test('supports type transformation', () => {
      const result = ok(42);
      const flatMapped = flatMap(result, (x) => ok(x.toString()));

      expect(isOk(flatMapped)).toBe(true);
      if (isOk(flatMapped)) {
        expect(flatMapped.value).toBe('42');
        // TypeScript should know flatMapped.value is a string
        expect(typeof flatMapped.value).toBe('string');
      }
    });
  });

  describe('filter function', () => {
    test('keeps Ok that passes predicate', () => {
      const result = ok(42);
      const filtered = filter(result, (x) => x > 40, 'Value too small');

      expect(isOk(filtered)).toBe(true);
      if (isOk(filtered)) {
        expect(filtered.value).toBe(42);
      }
    });

    test('converts Ok to Err if it fails predicate', () => {
      const result = ok(42);
      const errorMsg = 'Value too large';
      const filtered = filter(result, (x) => x < 40, errorMsg);

      expect(isErr(filtered)).toBe(true);
      if (isErr(filtered)) {
        expect(filtered.error).toBe(errorMsg);
      }
    });

    test('preserves Err variant', () => {
      const error = 'original error';
      const result = err<string>(error);
      const filtered = filter<number, string>(result, (x) => x > 40, 'Value too small');

      expect(isErr(filtered)).toBe(true);
      if (isErr(filtered)) {
        expect(filtered.error).toBe('Value too small');
      }
    });
  });

  describe('unwrap function', () => {
    test('unwraps Ok variant', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    test('throws when unwrapping Err', () => {
      const result = err('error');
      expect(() => unwrap(result)).toThrow();
    });

    test('throws with custom message when unwrapping Err', () => {
      const result = err('error');
      const customMsg = 'Custom error message';
      expect(() => unwrap(result, customMsg)).toThrow(customMsg);
    });
  });

  describe('unwrapOr function', () => {
    test('returns value from Ok variant', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    test('returns default value for Err variant', () => {
      const result = err('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('unwrapOrElse function', () => {
    test('returns value from Ok variant', () => {
      const result = ok(42);
      let defaultFnCalled = false;

      const value = unwrapOrElse(result, () => {
        defaultFnCalled = true;
        return 0;
      });

      expect(value).toBe(42);
      expect(defaultFnCalled).toBe(false); // Function should not be called
    });

    test('calls generator function for Err variant', () => {
      const result = err('error');
      let defaultFnCalled = false;

      const value = unwrapOrElse(result, () => {
        defaultFnCalled = true;
        return 99;
      });

      expect(value).toBe(99);
      expect(defaultFnCalled).toBe(true); // Function should be called
    });
  });

  describe('combine function', () => {
    test('combines array of Ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const result = combine(results);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });

    test('returns first Err if any result is Err', () => {
      const error = 'something went wrong';
      const results = [ok(1), err(error), ok(3), err('another error')];
      const result = combine(results);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe(error); // Should be the first error
      }
    });

    test('works with empty array', () => {
      const results: Result<number, string>[] = [];
      const result = combine(results);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('combineAll function', () => {
    test('combines array of Ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const result = combineAll(results);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });

    test('collects all errors if any result is Err', () => {
      const error1 = 'first error';
      const error2 = 'second error';
      const results = [ok(1), err(error1), ok(3), err(error2)];
      const result = combineAll(results);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual([error1, error2]); // Should contain all errors
      }
    });

    test('works with empty array', () => {
      const results: Result<number, string>[] = [];
      const result = combineAll(results);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    test('preserves order of values for mixed results', () => {
      const results = [ok(1), err('error'), ok(3)];
      const result = combineAll(results);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual(['error']);
      }
    });
  });

  describe('match function', () => {
    test('matches Ok variant', () => {
      const result = ok(42);
      const matched = match(result, {
        ok: (value) => `Got ${value}`,
        err: (error) => `Got error: ${error}`,
      });

      expect(matched).toBe('Got 42');
    });

    test('matches Err variant', () => {
      const result = err('something went wrong');
      const matched = match(result, {
        ok: (value) => `Got ${value}`,
        err: (error) => `Got error: ${error}`,
      });

      expect(matched).toBe('Got error: something went wrong');
    });

    test('supports different return types', () => {
      const result = ok('hello');
      const matched = match(result, {
        ok: (value) => value.length,
        err: () => 0,
      });

      expect(matched).toBe(5);
    });
  });

  describe('tap function', () => {
    test('executes function for Ok without changing the Result', () => {
      const result = ok(42);
      let sideEffect = 0;

      const tapped = tap(result, (value) => {
        sideEffect = value;
      });

      expect(sideEffect).toBe(42); // Side effect happened
      expect(isOk(tapped)).toBe(true);
      if (isOk(tapped)) {
        expect(tapped.value).toBe(42); // Original value preserved
      }
      expect(tapped).toBe(result); // Same object reference
    });

    test('does nothing for Err', () => {
      const result = err('error');
      let sideEffect = 0;

      const tapped = tap(result, (value: number) => {
        sideEffect = value;
      });

      expect(sideEffect).toBe(0); // Side effect didn't happen
      expect(isErr(tapped)).toBe(true);
      expect(tapped).toBe(result); // Same object reference
    });
  });

  describe('tapErr function', () => {
    test('executes function for Err without changing the Result', () => {
      const error = 'something went wrong';
      const result = err(error);
      let sideEffect = '';

      // Using appropriate type parameters for the OK variant
      const tapped = tapErr(result, (err: unknown) => {
        sideEffect = err as string;
      });

      expect(sideEffect).toBe(error); // Side effect happened
      expect(isErr(tapped)).toBe(true);
      if (isErr(tapped)) {
        expect(tapped.error).toBe(error); // Original error preserved
      }
      expect(tapped).toBe(result); // Same object reference
    });

    test('does nothing for Ok', () => {
      const result = ok(42);
      let sideEffect = '';

      // Using appropriate type parameters for the OK variant
      const tapped = tapErr(result, (err: unknown) => {
        sideEffect = err as string;
      });

      expect(sideEffect).toBe(''); // Side effect didn't happen
      expect(isOk(tapped)).toBe(true);
      expect(tapped).toBe(result); // Same object reference
    });
  });

  describe('mapToOption function', () => {
    test('converts Ok to Some', () => {
      const result = ok(42);
      const option = mapToOption(result);

      expect(isSome(option)).toBe(true);
      if (isSome(option)) {
        expect(option.value).toBe(42);
      }
    });

    test('converts Err to None', () => {
      const result = err('error');
      const option = mapToOption(result);

      expect(isNone(option)).toBe(true);
    });
  });

  describe('fromTry function', () => {
    test('returns Ok for successful function execution', () => {
      const result = fromTry(() => 42);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    test('returns Err for function that throws', () => {
      const errorMsg = 'Something went wrong';
      const result = fromTry(() => {
        throw new Error(errorMsg);
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe(errorMsg);
      }
    });

    test('works with JSON.parse example', () => {
      const validJson = '{"name":"John"}';
      const invalidJson = 'invalid json';

      const valid = fromTry(() => JSON.parse(validJson));
      expect(isOk(valid)).toBe(true);
      if (isOk(valid)) {
        expect(valid.value).toEqual({ name: 'John' });
      }

      const invalid = fromTry(() => JSON.parse(invalidJson));
      expect(isErr(invalid)).toBe(true);
      if (isErr(invalid)) {
        expect(typeof invalid.error).toBe('string');
      }
    });
  });

  describe('fromTryWithError function', () => {
    test('returns Ok for successful function execution', () => {
      const result = fromTryWithError(() => 42);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    test('returns Err with full Error object for function that throws', () => {
      const errorMsg = 'Something went wrong';
      const result = fromTryWithError(() => {
        throw new Error(errorMsg);
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe(errorMsg);
        expect(result.error.stack).toBeDefined();
      }
    });

    test('preserves custom error properties', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message);
        }
      }

      const result = fromTryWithError(() => {
        throw new CustomError('Custom error', 404);
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(CustomError);
        expect((result.error as CustomError).code).toBe(404);
      }
    });
  });

  describe('fromPromise function', () => {
    test('returns Ok for resolved promise', async () => {
      const promise = Promise.resolve(42);
      const result = await fromPromise(promise);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    test('returns Err for rejected promise', async () => {
      const error = new Error('Promise rejected');
      const promise = Promise.reject(error);
      const result = await fromPromise(promise);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('Promise rejected');
      }
    });

    test('returns string error for non-Error rejection', async () => {
      const promise = Promise.reject('string error');
      const result = await fromPromise(promise);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('string error');
      }
    });
  });

  describe('fromPromiseWithError function', () => {
    test('returns Ok for resolved promise', async () => {
      const promise = Promise.resolve(42);
      const result = await fromPromiseWithError(promise);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    test('returns Err with full Error object for rejected promise', async () => {
      const error = new Error('Promise rejected');
      const promise = Promise.reject(error);
      const result = await fromPromiseWithError(promise);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe(error);
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test('transforms error with custom error function', async () => {
      const error = new Error('Original error');
      const promise = Promise.reject(error);
      const result = await fromPromiseWithError(promise, (e) => {
        return { originalError: e, message: 'Transformed error' };
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual({
          originalError: error,
          message: 'Transformed error',
        });
      }
    });
  });

  describe('toPromise function', () => {
    test('resolves with value for Ok', async () => {
      const result = ok(42);
      expect(toPromise(result)).resolves.toBe(42);
    });

    test('rejects with error for Err', async () => {
      const error = new Error('Something went wrong');
      const result = err(error);
      expect(toPromise(result)).rejects.toBe(error);
    });
  });

  describe('Result composition', () => {
    test('can compose multiple operations', () => {
      const startResult = ok(42);

      // Let's compose multiple operations
      const result = flatMap(
        map(startResult, (x) => x * 2),
        (x) => filter(ok(x.toString()), (str) => str.length > 1, 'String too short'),
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('84');
      }
    });

    test('handles compositions that result in Err', () => {
      const startResult = ok(5);

      // This composition should result in Err
      const result = flatMap(
        map(startResult, (x) => x * 2),
        (x) => filter(ok(x.toString()), (str) => str.length > 2, 'String too short'),
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('String too short');
      }
    });

    test('propagates errors in composition', () => {
      const startResult = err<string>('Initial error');

      // Error should propagate through the chain
      const result = flatMap(
        map(startResult, (x: string) => x.toUpperCase()),
        (x) => ok(x.length),
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('Initial error');
      }
    });
  });
});
