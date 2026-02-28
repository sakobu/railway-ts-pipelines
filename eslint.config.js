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
      'unicorn/prevent-abbreviations': 'off',
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
