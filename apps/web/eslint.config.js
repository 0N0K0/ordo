import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/graphql']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Multi-selects check several options in one go: BatchMultiSelect, not Mantine's directly.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mantine/core',
              importNames: ['MultiSelect'],
              message: 'Utiliser BatchMultiSelect (components/BatchMultiSelect) : plusieurs choix en une fois.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/BatchMultiSelect.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
])
