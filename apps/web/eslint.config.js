import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Imports banned everywhere: Mantine pieces wrapped by a shared brick.
const RESTRICTED_PATHS = [
  {
    name: '@mantine/core',
    importNames: ['MultiSelect'],
    message: 'Utiliser BatchMultiSelect (components/inputs/BatchMultiSelect) : plusieurs choix en une fois.',
  },
  {
    name: '@mantine/core',
    importNames: ['ColorInput'],
    message: 'Utiliser ColorField (components/inputs/ColorField) : les mêmes nuanciers partout.',
  },
  {
    name: '@mantine/core',
    importNames: ['Menu'],
    message: 'Utiliser ActionsMenu (components/actions/ActionsMenu) : les mêmes menus partout (entrées, sections, coches, cible au choix).',
  },
  {
    name: '@ordo/shared',
    importNames: ['formatMoney'],
    message: 'Utiliser fmt.money / fmt.moneyCents (lib/format).',
  },
];

// The same, Menu allowed: ActionsMenu itself and the genuinely special menus.
const RESTRICTED_PATHS_BUT_MENU = RESTRICTED_PATHS.filter((path) => !path.importNames.includes('Menu'));

// The shared bricks (components/, lib/) never depend on a feature.
const NO_FEATURES = {
  group: ['**/features/**'],
  message: 'Une brique commune (components/, lib/) ne dépend pas d\'une feature : déplacer le code dans la feature, ou la brique dans components/ ou lib/.',
};

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
      'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS }],
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
        {
          selector: "Property[key.name='onSuccess'] > ArrowFunctionExpression[body.type='CallExpression'][body.callee.name='notifySuccess']",
          message: 'Utiliser toastCallbacks(message) (lib/notify) ou formCallbacks(form, message, onDone) (lib/form).',
        },
        // Days: a DateTime cut gives the UTC day; the Date scalar is already a day.
        {
          selector: "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=0]:matches([arguments.1.value=7], [arguments.1.value=10])",
          message: 'Pas de .slice(0, 10) / .slice(0, 7) : localDay(instant) (lib/dates) pour un instant, le scalaire Date tel quel pour un jour, monthColumn pour un mois.',
        },
        {
          selector: "NewExpression[callee.name='Date'] TemplateElement[value.raw=/^T00:00/]",
          message: 'Utiliser parseDay(day) (@ordo/shared), ou fmt.* directement sur la chaîne du jour.',
        },
        // Plurals: one helper.
        {
          selector: 'Literal[value=/\\(s\\)/], TemplateElement[value.raw=/\\(s\\)/]',
          message: 'Pas de « (s) » : plural(count, mot) ou countOf(count, mot) (lib/text).',
        },
        {
          selector: "ConditionalExpression[test.operator=/^(>|!==|!=)$/][test.right.value=1][consequent.value='s']",
          message: 'Utiliser plural(count, mot) ou countOf(count, mot) (lib/text).',
        },
        // Shared buttons and messages.
        {
          // A cross closing a panel or clearing a selection is not a removal.
          selector:
            "JSXElement[openingElement.name.name='ActionIcon']:has(JSXOpeningElement[name.name=/^(TrashIcon|XIcon)$/]):not(:has(JSXAttribute[name.name='aria-label'][value.value=/^(Fermer|Désélectionner)/]))",
          message: 'Utiliser RemoveButton (components/actions/RemoveButton) pour retirer ou supprimer.',
        },
        {
          selector: "JSXOpeningElement[name.name='Alert'] > JSXAttribute[name.name='color'][value.value='red']",
          message: 'Utiliser ErrorAlert (components/feedback/ErrorAlert).',
        },
        {
          selector: "JSXOpeningElement[name.name='Alert'] > JSXAttribute[name.name='color'][value.value=/^(green|teal|blue|yellow|orange)$/]",
          message: 'Utiliser NoticeAlert (components/feedback/NoticeAlert) avec kind success / info / warning.',
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS, patterns: [NO_FEATURES] }] },
  },
  {
    // App-wide features the bricks read (the user, the active workspace and its week, a file link): known exceptions.
    files: ['src/lib/query-client.ts', 'src/lib/week.ts', 'src/components/people/people-options.ts', 'src/components/inputs/WeekDatesProvider.tsx', 'src/components/markdown/MarkdownView.tsx'],
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS }] },
  },
  {
    // ActionsMenu wraps Menu.
    files: ['src/components/actions/ActionsMenu.tsx'],
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS_BUT_MENU, patterns: [NO_FEATURES] }] },
  },
  {
    // Menus of their own: the tree of the saved places in an address field; the library, to be rewritten.
    files: ['src/features/geo/components/AddressInput.tsx', 'src/features/library/**'],
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS_BUT_MENU }] },
  },
  {
    files: ['src/lib/format.ts', 'src/lib/notify.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // BatchMultiSelect wraps MultiSelect, ColorField wraps ColorInput; fmt.moneyCents is the shared formatMoney.
    files: ['src/components/inputs/BatchMultiSelect.tsx', 'src/components/inputs/ColorField.tsx', 'src/lib/format.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The shared bricks wrapping a banned pattern: the dates helpers, the month column, the shared buttons and alerts.
    files: [
      'src/lib/dates.ts',
      'src/components/data-table/table/month-column.ts',
      'src/components/actions/RemoveButton.tsx',
      'src/components/feedback/ErrorAlert.tsx',
      'src/components/feedback/NoticeAlert.tsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // To be rewritten entirely: not brought in line.
    files: ['src/features/library/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
