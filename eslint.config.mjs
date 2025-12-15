import playwright from 'eslint-plugin-playwright'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'

export default [
  {
    ignores: [
      'migrations/**/*',
      'next-env.d.ts',
      '.storybook/**/*',
      'node_modules/**/*',
      '.next/**/*',
      'out/**/*',
      'tailwind.config.ts',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      '@typescript-eslint': typescript,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/order': 'off',
      'sort-imports': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e.ts'],
    ...playwright.configs['flat/recommended'],
  },
]
