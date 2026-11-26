import { dirname } from 'path';
import { fileURLToPath } from 'url';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import next from '@next/eslint-plugin-next';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { importX } from 'eslint-plugin-import-x';
import { configs as tsEslintConfigs } from 'typescript-eslint';
import globals from 'globals';
import eslint from '@eslint/js';
import noGateWithReasonBoolean from './eslint-rules/no-gate-with-reason-boolean.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseRules = {
  'no-console': 'off',
  'no-debugger': 'error',
  'no-empty': 'error',
  'no-empty-function': 'error',
  'no-constant-condition': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
};

const baseLanguageOptions = {
  globals: { ...globals.node, ...globals.es2022 },
};

const baseConfig = [
  eslint.configs.recommended,
  importX.flatConfigs.recommended,
  prettierRecommended,
];
/* -------------------------------------------------------------------------- */
/* Presets                                                                    */
/* -------------------------------------------------------------------------- */
const tsUntypedPresets = [
  importX.flatConfigs.typescript,
  ...tsEslintConfigs.strict,
  ...tsEslintConfigs.stylistic,
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Global ignores: a config object containing ONLY `ignores` applies repo-wide.
  {
    ignores: [
      '**/*.md',
      '.next/**/*',
      'next-env.d.ts',
      'generated/**/*',
      'tmp/**/*',
      'dist/**/*',
    ],
  },
  ...baseConfig,
  ...tsUntypedPresets,
  { languageOptions: baseLanguageOptions, rules: baseRules },
  {
    // Untyped checks everywhere
    files: ['**/*.{js,jsx,ts,tsx}', '**/*.stories.tsx', '**/*.test.{ts,tsx}'],
    languageOptions: {
      // ...baseLanguageOptions,
      parser: typescriptParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        projectService: true,
      },
    },
    plugins: {
      prettier: prettierPlugin,
      '@next/next': next,
      'custom-rules': {
        rules: {
          'no-gate-with-reason-boolean': noGateWithReasonBoolean,
        },
      },
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      ...typescriptEslint.configs['recommended-requiring-type-checking'].rules,
      ...prettier.rules,
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      'custom-rules/no-gate-with-reason-boolean': 'error',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
    },
  },
];
