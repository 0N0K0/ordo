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
    rules: {
      'no-restricted-syntax': [
        'error',
        ...SHARED_SYNTAX_RULES,
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message: 'Une fonction partagée refuse par UserError (message pour l’utilisateur, donné au client par l’API), jamais par une Error simple.',
        },
      ],
    },
  },
  // Tests build instants and dates by hand on purpose (around a change of time, in another zone).
  { files: ['test/**/*.ts'], rules: { 'no-restricted-syntax': 'off' } },
  planReferencesConfig(['**/*.{ts,js}']),
]);
