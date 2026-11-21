import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { planReferencesConfig, SHARED_SYNTAX_RULES } from './eslint-rules.js';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-restricted-syntax': ['error', ...SHARED_SYNTAX_RULES] },
  },
  planReferencesConfig(['**/*.{ts,js}']),
]);
