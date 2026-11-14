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
            {
              name: '@ordo/shared',
              importNames: ['formatMoney'],
              message: 'Utiliser fmt.money / fmt.moneyCents (lib/format).',
            },
          ],
        },
      ],
      // Dates, numbers and amounts: one format per role, in lib/format.
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.object.name='Intl'][callee.property.name=/^(DateTimeFormat|NumberFormat)$/][arguments.length>0]",
          message: 'Utiliser lib/format (fmt.day, fmt.time, fmt.money…) : un format par rôle.',
        },
        {
          selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]",
          message: 'Utiliser lib/format (fmt.day, fmt.time, fmt.number…) : un format par rôle.',
        },
        // Toasts: errors stay, the others close on their own, one style.
        {
          selector: "CallExpression[callee.object.name='notifications'][callee.property.name=/^(show|update)$/]",
          message: 'Utiliser lib/notify (notifySuccess, notifyInfo, notifyWarning, notifyError, notifyWithUndo).',
        },
      ],
    },
  },
  {
    files: ['src/lib/format.ts', 'src/lib/notify.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/components/BatchMultiSelect.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
])
