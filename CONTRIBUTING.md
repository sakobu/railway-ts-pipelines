# Contributing to @railway-ts/pipelines

Thank you for your interest in contributing! This guide will help you get started with development.

---

## Prerequisites

- [`bun`](https://bun.sh) - JavaScript runtime and package manager
- TypeScript knowledge
- Familiarity with functional programming concepts

---

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sakobu/railway-ts-pipelines.git
   cd railway-ts-pipelines
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run type checking**
   ```bash
   bun run typecheck
   ```

---

## Development Commands

### Type Checking
```bash
bun run typecheck          # Type check without emitting files
```

### Linting
```bash
bun run lint               # Lint the codebase
bun run lint:fix           # Auto-fix linting issues
```

### Formatting
```bash
bun run format             # Format code with Prettier
bun run format:check       # Check formatting without changes
```

### Testing
```bash
bun test                           # Run all tests
bun test --watch                   # Watch mode
bun test --coverage                # With coverage
bun test --bail                    # Stop on first failure
bun test --test-name-pattern <pattern>  # Run tests matching pattern
bun test --only                    # Run only tests marked with .only
```

### Building
```bash
bun run build              # Build library
bun run dev                # Build in watch mode
bun run build:watch        # Alias for dev
```

### Pre-publish Checks
```bash
bun run check              # Run typecheck + lint + test
bun run prepublishOnly     # Full check + build (runs before publish)
```

---

## Project Structure

```
src/
├── option/           # Option type and utilities
│   ├── option.ts     # Core Option implementation
│   └── index.ts      # Public exports
├── result/           # Result type and utilities
│   ├── result.ts     # Core Result implementation
│   └── index.ts      # Public exports
├── composition/      # Functional composition utilities
│   ├── pipe.ts       # pipe() implementation
│   ├── flow.ts       # flow() implementation
│   ├── curry.ts      # curry/uncurry implementations
│   ├── tupled.ts     # tupled/untupled implementations
│   └── index.ts      # Public exports
├── schema/           # Validation and parsing
│   ├── core.ts       # Core validator types and utilities
│   ├── string.ts     # String validators
│   ├── number.ts     # Number validators
│   ├── parsers.ts    # Type transformation validators
│   ├── array.ts      # Array validators
│   ├── union.ts      # Union and discriminated union validators
│   └── index.ts      # Public exports
└── index.ts          # Root exports (with renamed functions)

tests/                # Mirrors src/ structure
├── option/
├── result/
├── schema/
├── composition/
└── integration/      # Integration tests

examples/             # Real-world examples
├── option/
├── result/
├── schema/
├── composition/
├── complete-pipelines/
└── interop/

docs/                 # Additional documentation
└── ADVANCED.md       # Advanced implementation details
```

---

## Code Style Guidelines

### General Principles

1. **Pure Functions** - All functions should be pure (no side effects)
2. **Explicit Types** - Avoid `any`, use explicit type annotations
3. **Small Functions** - Keep functions focused and composable
4. **Comprehensive JSDoc** - Document all public APIs with examples
5. **Test Coverage** - All features must have test coverage

### TypeScript Style

- Use `readonly` for all object properties
- Prefer `const` over `let`
- Use type guards with type predicates (`x is Type`)
- Leverage TypeScript's strict mode features

### Function Signatures

All composition functions must use `this: void`:

```typescript
export function myFunction<A, B>(
  this: void,
  input: A,
  transform: (this: void, a: A) => B,
): B {
  return transform(input);
}
```

This ensures referential transparency and composability.

### JSDoc Comments

Include comprehensive JSDoc for all public functions:

```typescript
/**
 * Maps a function over the value inside an Option.
 *
 * If the Option is `some(value)`, applies the function and returns `some(result)`.
 * If the Option is `none`, returns `none` without calling the function.
 *
 * @template T - The type of the value in the input Option
 * @template U - The type of the value in the output Option
 * @param option - The Option to map over
 * @param fn - The function to apply to the value
 * @returns A new Option containing the transformed value
 *
 * @example
 * ```typescript
 * const value = some(5);
 * const doubled = map(value, (x) => x * 2);
 * // doubled is some(10)
 *
 * const empty = none<number>();
 * const result = map(empty, (x) => x * 2);
 * // result is none
 * ```
 */
export function map<T, U>(
  option: Option<T>,
  fn: (value: T) => U,
): Option<U> {
  return option.some ? some(fn(option.value)) : none();
}
```

---

## Testing Guidelines

### Test Organization

- Tests mirror the `src/` structure
- Use descriptive test names
- Group related tests with `describe()`
- Test both happy paths and error cases

### Example Test Structure

```typescript
import { describe, test, expect } from 'bun:test';
import { some, none, map } from '@/option';

describe('Option.map', () => {
  test('transforms value when Option is some', () => {
    const result = map(some(5), (x) => x * 2);
    expect(result).toEqual(some(10));
  });

  test('returns none when Option is none', () => {
    const result = map(none<number>(), (x) => x * 2);
    expect(result).toEqual(none());
  });

  test('function is not called when Option is none', () => {
    let called = false;
    map(none<number>(), () => {
      called = true;
      return 0;
    });
    expect(called).toBe(false);
  });
});
```

---

## Build Configuration

The library uses **tsup** for bundling with multiple entry points:

### Entry Points

- Main: `src/index.ts` → `dist/index.{mjs,cjs}`
- Option: `src/option/index.ts` → `dist/option/index.{mjs,cjs}`
- Result: `src/result/index.ts` → `dist/result/index.{mjs,cjs}`
- Composition: `src/composition/index.ts` → `dist/composition/index.{mjs,cjs}`
- Schema: `src/schema/index.ts` → `dist/schema/index.{mjs,cjs}`

### Output Formats

Each entry point generates:
- **ESM** (`.mjs`) for modern bundlers and Node.js
- **CJS** (`.cjs`) for legacy compatibility
- **TypeScript declarations** (`.d.ts`) with source maps

### Tree-Shaking

The library is configured for optimal tree-shaking:
- `sideEffects: false` in `package.json`
- Subpath imports for granular imports
- Pure functions with no side effects

---

## Commit Guidelines

### Commit Message Format

Use conventional commits format:

```
type(scope): brief description

Longer description if needed

Fixes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Tooling/build changes

**Examples:**
```
feat(result): add mapErr function for transforming error values
fix(schema): correct type inference for nested optional fields
docs(readme): update installation instructions
test(option): add tests for combine() with mixed Some/None
```

---

## Pull Request Process

1. **Fork the repository** and create your branch from `main`

2. **Make your changes** following the code style guidelines

3. **Add tests** for any new functionality

4. **Run the full check**:
   ```bash
   bun run check
   ```

5. **Update documentation** if you're changing public APIs

6. **Submit a pull request** with:
   - Clear description of the changes
   - Reference to any related issues
   - Screenshots/examples if applicable

7. **Respond to review feedback** promptly

---

## Design Philosophy

When contributing, keep these principles in mind:

1. **Errors and Absence are Values** - Never use exceptions for control flow
2. **Parse, Don't Validate** - Transform data into guaranteed-valid types
3. **Explicit Over Implicit** - Make success/failure visible in types
4. **Composition First** - Design for function composition
5. **No `any` Types** - Maintain 100% type safety
6. **Referential Transparency** - Functions should be pure and predictable

---

## Questions or Issues?

- **Bug reports**: Open an issue with a minimal reproduction
- **Feature requests**: Open an issue describing the use case
- **Questions**: Start a discussion or open an issue

We appreciate all contributions, whether it's code, documentation, bug reports, or feature ideas!

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
