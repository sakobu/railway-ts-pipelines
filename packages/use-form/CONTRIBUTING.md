# Contributing

## Setup

```bash
git clone https://github.com/sakobu/railway-ts-use-form.git
cd railway-ts-use-form
bun install
```

**Prerequisites:** Bun, TypeScript knowledge, React basics.

## Commands

| Command                | What it does              |
| ---------------------- | ------------------------- |
| `bun test`             | Run tests                 |
| `bun test --watch`     | Watch mode                |
| `bun test --coverage`  | With coverage             |
| `bun run build`        | Build library             |
| `bun run typecheck`    | Type check                |
| `bun run lint`         | Lint                      |
| `bun run lint:fix`     | Auto-fix lint issues      |
| `bun run format`       | Format code               |
| `bun run format:check` | Check formatting          |
| `bun run example`      | Run examples (hot reload) |
| `bun run check`        | typecheck + lint + test   |

## Project Structure

```
src/
├── useForm.ts              # Main hook
├── formReducer.ts          # State management reducer
├── fieldPropsFactory.ts    # Native HTML prop generators
├── arrayHelpersFactory.ts  # Array field helpers
├── standardSchema.ts       # Standard Schema v1 adapter
├── useDebounce.ts          # Debounce hook
├── useFormAutoSubmission.ts # Auto-submission hook
├── types.ts                # TypeScript types
├── utils.ts                # Internal utilities
└── index.ts                # Public exports

tests/                      # Mirrors src/
examples/                   # Working examples
  ├── sync/                 # Basic sync validation
  ├── async/                # Async validation
  ├── field-validators/     # Per-field async validators
  └── standard-schema/      # Zod and Valibot examples
docs/                       # Documentation
```

## Code Rules

- No `any` types -- use `unknown` for untrusted input
- Prefer `const` over `let`
- Pure functions where possible
- All public APIs need JSDoc with `@example` blocks
- Use `this: void` for referential transparency in composition functions

## Testing

Tests use Bun's test runner with `@testing-library/react` for component tests. Test both success and error paths.

```typescript
import { describe, test, expect } from 'bun:test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('useForm', () => {
  test('validates required fields', async () => {
    render(<TestForm />);
    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });
});
```

## Pull Requests

1. Open an issue first for new features
2. One feature/fix per PR
3. Add tests for all new code
4. Update docs if behavior changes
5. Run `bun run check` before submitting
6. Clear PR description with issue references

## Commit Format

Use conventional commits:

```
type(scope): brief description
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

**Examples:**

```
feat(form): add fieldValidators option for per-field async validation
fix(reducer): correct server error auto-clear for nested paths
docs(recipes): add Standard Schema examples
test(form): add tests for submit validation mode
```

## Good Contributions

- Bug fixes with test cases
- New field binding helpers
- Performance improvements with benchmarks
- Documentation improvements
- Example forms

## Think Twice

- New core abstractions (open issue first)
- Breaking changes to the hook API
- Adding peer dependencies
- Anything requiring `any` types

## Questions

- Bug reports: [Open issue](https://github.com/sakobu/railway-ts-use-form/issues)
- Feature ideas: [Open issue](https://github.com/sakobu/railway-ts-use-form/issues) (discuss first)

## License

By contributing, you agree your contributions will be licensed under MIT.
