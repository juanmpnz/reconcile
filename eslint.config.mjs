import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/lib/http.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='Identifier'][callee.name='fetch']",
          message:
            'Use the shared lib/http transport; Better Auth calls must use its SDK.',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name=/^(window|globalThis|self)$/][callee.property.name='fetch']",
          message: 'Use the shared lib/http transport instead of global fetch.',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name=/^(window|globalThis|self)$/][callee.property.value='fetch']",
          message: 'Use the shared lib/http transport instead of global fetch.',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/design-system/**', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXOpeningElement[name.type='JSXIdentifier'][name.name=/^(button|input|textarea|select|label|table|thead|tbody|tfoot|tr|th|td|caption|dialog|details|summary|progress|meter)$/]",
          message:
            'Use the internal design-system component for this control or table structure.',
        },
        {
          selector:
            "CallExpression[callee.type='Identifier'][callee.name='fetch']",
          message:
            'Use the shared lib/http transport; Better Auth calls must use its SDK.',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name=/^(window|globalThis|self)$/][callee.property.name='fetch']",
          message: 'Use the shared lib/http transport instead of global fetch.',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name=/^(window|globalThis|self)$/][callee.property.value='fetch']",
          message: 'Use the shared lib/http transport instead of global fetch.',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/{features,app}/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)components/ui(/|$)',
              message:
                'Import the shared design-system directly; components/ui is compatibility only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
      },
    },
  },
);
