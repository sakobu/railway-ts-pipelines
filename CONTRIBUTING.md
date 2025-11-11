# Contributing

## Setup

```bash
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install
```

**Prerequisites:** Bun, TypeScript knowledge, functional programming basics.

## Commands

```bash
bun test                    # Run tests
bun test --watch            # Watch mode
bun test --coverage         # With coverage
bun run typecheck           # Type check
bun run lint                # Lint
bun run lint:fix            # Auto-fix
bun run format              # Format code
bun run format:check        # Check formatting
bun run build               # Build library
bun run check               # typecheck + lint + test
```

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

## Pull Requests

1. Open issue first for new features
2. One feature/fix per PR
3. Add tests for all new code
4. Update docs if behavior changes
5. Run `bun run check` before submitting
6. Clear PR description with issue references

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

Uses tsup with multiple entry points:

- `src/index.ts` → `dist/index.{mjs,cjs}`
- `src/option/index.ts` → `dist/option/index.{mjs,cjs}`
- `src/result/index.ts` → `dist/result/index.{mjs,cjs}`
- `src/composition/index.ts` → `dist/composition/index.{mjs,cjs}`
- `src/schema/index.ts` → `dist/schema/index.{mjs,cjs}`

Each generates:

- ESM (`.mjs`)
- CJS (`.cjs`)
- TypeScript declarations (`.d.ts`)

## Commit Format

Use conventional commits:

```
type(scope): brief description

Longer description if needed

Fixes #123
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

**Examples:**

```
feat(result): add mapErr function
fix(schema): correct type inference for nested optional fields
docs(readme): update installation instructions
test(option): add tests for combine() with mixed Some/None
```

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

## Questions

- Bug reports: [Open issue](https://github.com/sakobu/railway-ts-pipelines/issues)
- Feature ideas: [Open issue](https://github.com/sakobu/railway-ts-pipelines/issues) (discuss first)
- Questions: [GitHub Discussions](https://github.com/sakobu/railway-ts-pipelines/discussions)

## License

By contributing, you agree your contributions will be licensed under MIT.
