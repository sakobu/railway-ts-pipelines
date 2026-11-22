import pluginJs from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import security from 'eslint-plugin-security';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Ignore dist folder
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.browser,
    },
  },

  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  unicorn.configs.recommended,

  {
    plugins: {
      security: security,
    },
    rules: {
      ...security.configs.recommended.rules,
    },
  },

  {
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },

  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'arrow-body-style': 'off',
      'prefer-arrow-callback': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      // Flags idiomatic schema composition, e.g. object({ a: optional(chain(string(), min(1))) })
      'unicorn/max-nested-calls': 'off',
      // Flags public API (`is`, `_getAbortEarly`) and standard names like `predicate`
      'unicorn/consistent-boolean-name': 'off',
      // Folds guard clauses (`if (bad) return err(...); return ok(...)`) into ternaries
      'unicorn/prefer-ternary': 'off',
      // Combinators return T | Promise<T>; `await` would force the sync path async
      'unicorn/prefer-await': 'off',
      // Not equivalent: Number('') === 0, Number('12px') is NaN, unlike parseInt/parseFloat
      'unicorn/prefer-number-coercion': 'off',
      // Would change what the public integer() validator and parseBigInt accept
      'unicorn/prefer-number-is-safe-integer': 'off',
      // One-line JSDoc (`/** @internal */`, `/** @type {...} */`) is standard
      'unicorn/single-line-block-comment-style': 'off',
      // `x || fallback` treats '' as missing; a default parameter does not
      'unicorn/prefer-default-parameters': 'off',
    },
  },

  // Special rules for test files
  {
    files: ['**/*.test.ts', '**/tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
    rules: {
      // Disable rules that are too restrictive for tests
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/consistent-destructuring': 'off',
      'unicorn/prefer-node-protocol': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',

      // Disable import rules that are frequently commented out in tests
      'import/no-unresolved': 'off',

      // Allow more relaxed functional patterns in tests
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',

      // Allow `expect(isOk(x)).toBe(true); if (isOk(x)) { ... }` narrowing idiom
      'unicorn/prefer-early-return': 'off',
      'unicorn/prefer-continue': 'off',

      // Test data and fixtures are deliberate (3.14, 'http://...', '   ', Date mocks)
      'unicorn/prefer-math-constants': 'off',
      'unicorn/prefer-https': 'off',
      'unicorn/prefer-string-repeat': 'off',
      'unicorn/no-global-object-property-assignment': 'off',
      'unicorn/no-unsafe-string-replacement': 'off',
      'unicorn/no-unnecessary-parameters': 'off',
      'unicorn/prefer-smaller-scope': 'off',

      // Allow for better test readability
      'prefer-const': 'warn',
      'import/order': 'warn',
    },
  },

  // Special rules for example files
  {
    files: ['**/examples/**/*.{ts,tsx}'],
    rules: {
      // Disable rules that are too restrictive for examples
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/consistent-destructuring': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/prefer-number-properties': 'off',
      'unicorn/no-zero-fractions': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'security/detect-object-injection': 'off',

      // Disable import rules for easier example code
      'import/no-unresolved': 'off',

      // Allow more relaxed patterns in examples
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-spread': 'off',
      'unicorn/prefer-early-return': 'off',
      'unicorn/prefer-continue': 'off',
      'unicorn/prefer-math-constants': 'off',
      'unicorn/prefer-https': 'off',
      'unicorn/prefer-string-repeat': 'off',
      'unicorn/no-unnecessary-parameters': 'off',

      // Make examples more readable
      'prefer-const': 'warn',
      'import/order': 'warn',
      'no-console': 'off',
    },
  },

  // Global: ignore underscore-prefixed unused args (standard convention)
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
