# Contributing to @railway-ts/pipelines

Setup, commands, changesets, pull requests and commit format are in the [repo-wide CONTRIBUTING.md](../../CONTRIBUTING.md). This file covers what is specific to `@railway-ts/pipelines`.

**Prerequisites:** functional programming basics.

## Project Structure

```
src/
├── option/           # Option<T>
├── result/           # Result<T, E>
├── schema/           # Validators
├── composition/      # pipe, flow, curry
└── index.ts          # Root exports

tests/                # Mirrors src/
examples/             # Working examples
docs/                 # Documentation
```

## Code Rules

### No Exceptions

- `any` types forbidden - use `unknown` for untrusted input
- Pure functions only - no side effects except in examples
- Data-last parameters for composition
- Explicit returns (except arrow functions)

### TypeScript

- Use `readonly` for object properties
- Prefer `const` over `let`
- Type guards with predicates: `(x): x is Type`
- All public APIs need JSDoc with examples

### Composition Functions

Must use `this: void` for referential transparency:

```typescript
export function myFunction<A, B>(this: void, input: A, transform: (this: void, a: A) => B): B {
  return transform(input);
}
```

### JSDoc Format

```typescript
/**
 * Brief description of what the function does.
 *
 * @example
 * const result = map(some(5), (x) => x * 2);
 * // some(10)
 *
 * @param option - Description
 * @param fn - Description
 * @returns Description
 */
export function map<T, U>(option: Option<T>, fn: (value: T) => U): Option<U> {
  return option.some ? some(fn(option.value)) : none();
}
```

## Testing

Tests mirror `src/` structure. Test both success and error paths.

```typescript
import { describe, test, expect } from 'bun:test';

describe('Option.map', () => {
  test('transforms Some values', () => {
    const result = map(some(5), (x) => x * 2);
    expect(result).toEqual(some(10));
  });

  test('preserves None', () => {
    const result = map(none<number>(), (x) => x * 2);
    expect(result).toEqual(none());
  });

  test('does not call function on None', () => {
    let called = false;
    map(none<number>(), () => {
      called = true;
      return 0;
    });
    expect(called).toBe(false);
  });
});
```

## Adding Validators

When adding schema validators:

1. Add to appropriate file in `src/schema/`
2. Export from `src/schema/index.ts`
3. Add JSDoc with examples
4. Add tests in `tests/schema/`
5. Add example in `examples/schema/`

```typescript
export function myValidator(config: Config): Validator<Input, Output> {
  return (value, path = []) => {
    if (!isValid(value)) {
      return err([{ path, message: 'error message' }]);
    }
    return ok(transform(value));
  };
}
```

## Build System

Uses [tsdown](https://tsdown.dev) (`tsdown.config.ts`) with four entry points:

- `src/option/index.ts` → `dist/option/index.mjs`
- `src/result/index.ts` → `dist/result/index.mjs`
- `src/composition/index.ts` → `dist/composition/index.mjs`
- `src/schema/index.ts` → `dist/schema/index.mjs`

The package is ESM-only: each entry is an `.mjs` file with types in `.d.mts`, and CommonJS consumers load it through Node's `require(esm)`. Code shared between entries (Option and Result) goes into one shared chunk. Declarations come from Oxc's isolated-declarations emitter, so exported functions need explicit return types; the build fails if one is missing.

The build also runs publint and arethetypeswrong (`esm-only` profile) and fails on any problem. `bun run test:package` builds, then checks the result the way consumers see it: `tests/package` type-checks ESM and CommonJS consumer files against `dist/` with `skipLibCheck` off (`module: nodenext`), and runs runtime checks in Node, including that `require()` returns the same module as `import`.

## Good Contributions

- Bug fixes with test cases
- New validators (email, url, date ranges)
- Performance improvements with benchmarks
- Documentation improvements
- Example pipelines

## Think Twice

- New core abstractions (open issue first)
- Breaking changes (probably not pre-1.0)
- API bloat
- Anything requiring `any` types
