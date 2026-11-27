# Contributing to @railway-ts/use-form

Setup, commands, changesets, pull requests and commit format are in the [repo-wide CONTRIBUTING.md](../../CONTRIBUTING.md). This file covers what is specific to `@railway-ts/use-form`.

**Prerequisites:** React basics.

## Project Structure

```
src/
├── useForm.ts              # Main hook
├── formReducer.ts          # State management reducer
├── formStore.ts            # The form state, held outside React
├── formChecks.ts           # The schema check and field checks in the form state
├── checkEvents.ts          # One check pass per public call
├── withDeps.ts             # Field validators that list the fields they read
├── fieldPropsFactory.ts    # Native HTML prop generators
├── arrayHelpersFactory.ts  # Array field helpers
├── standardSchema.ts       # Standard Schema v1 adapter
├── useDebounce.ts          # Debounce hook
├── autoSave.ts             # The auto-save decision
├── submitScheduler.ts      # What an overlapping submit does
├── stabilityCheck.ts       # Whether initialValues changes on its own
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

## Examples

The interactive example app imports the built pipelines, so build first. From the repo root:

```bash
bun run build
cd packages/use-form
bun run example   # http://localhost:3000, hot reload
```
