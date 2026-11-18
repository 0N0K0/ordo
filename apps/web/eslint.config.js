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
  {
    name: '@ordo/shared',
    importNames: ['collator', 'normalize'],
    message: 'Importer collator et normalize de lib/text : un seul chemin.',
  },
  {
    name: '@mantine/dates',
    importNames: ['TimeInput'],
    message: 'Utiliser TimePicker : 24 h et libellés par défaut (app/theme).',
  },
  {
    name: '@phosphor-icons/react',
    importNames: ['DotsThreeIcon', 'DotsThreeVerticalIcon', 'DotsThreeOutlineIcon', 'DotsThreeOutlineVerticalIcon', 'DotsThreeCircleIcon', 'DotsThreeCircleVerticalIcon'],
    message: 'Un menu « … » : ActionsMenu sans target (trois points verticaux, décision T ; variant="default" à côté de boutons).',
  },
];

// The same, Menu allowed: the genuinely special menus.
const RESTRICTED_PATHS_BUT_MENU = RESTRICTED_PATHS.filter((path) => !path.importNames.includes('Menu'));

// ActionsMenu itself: wraps Menu and draws the « … » button.
const RESTRICTED_PATHS_ACTIONS_MENU = RESTRICTED_PATHS_BUT_MENU.filter((path) => path.name !== '@phosphor-icons/react');

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
          selector: "NewExpression[callee.object.name='Intl'][callee.property.name=/^(DateTimeFormat|NumberFormat|RelativeTimeFormat)$/][arguments.length>0]",
          message: 'Utiliser lib/format (fmt.day, fmt.time, fmt.money, fmt.fromNow…) : un format par rôle.',
        },
        {
          selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]",
          message: 'Utiliser lib/format (fmt.day, fmt.time, fmt.number…) : un format par rôle.',
        },
        // Rows set back: the states of DataTable (decision U), not an opacity of their own.
        {
          selector: "JSXAttribute[name.name='rowProps'] Property[key.name='opacity']",
          message: 'Utiliser isArchived / isDone de DataTable : une opacité « atténué » (--onoko-muted-opacity) partout.',
        },
        // The .ics of every calendar: one button.
        {
          selector: "CallExpression[callee.name='calendarIcsUrl'] > Literal[raw='null']",
          message: 'Utiliser CalendarsIcsButton (features/calendar/components) : un seul libellé, « Tout exporter (.ics) ».',
        },
        // Captions in capitals: one look (weight 600).
        {
          selector: "JSXOpeningElement[name.name='Text']:has(JSXAttribute[name.name='tt'][value.value='uppercase'])",
          message: 'Utiliser Caption (components/page/Caption) : petites capitales atténuées, graisse 600, partout.',
        },
        // Names of months, weekdays and positions: one list each, in @ordo/shared (decision V).
        {
          selector: "Literal[value=/^(janvier|premier|deuxième|1er)$/]",
          message: 'Utiliser MONTH_LABELS / monthOptions, WEEKDAY_LABELS / weekdayOptions, POSITION_LABELS / positionOptions ou ordinal (@ordo/shared) : « 1er / 2e / dernier » partout.',
        },
        // Toasts: errors stay, the others close on their own, one style.
        {
          selector: "CallExpression[callee.object.name='notifications'][callee.property.name=/^(show|update)$/]",
          message: 'Utiliser lib/notify (notifySuccess, notifyInfo, notifyWarning, notifyError, notifyWithUndo).',
        },
        {
          selector:
            "Property[key.name='onSuccess'] > ArrowFunctionExpression[body.type='CallExpression'][body.callee.name='notifySuccess'], Property[key.name='onSuccess'] > ArrowFunctionExpression > BlockStatement > ExpressionStatement:first-child > CallExpression[callee.name='notifySuccess']",
          message: 'Utiliser toastCallbacks(message) (lib/notify) ou formCallbacks(form, message, onDone) (lib/form).',
        },
        {
          selector: "ObjectExpression[properties.length=1] > Property[key.name='onError'][value.name='onMutationError']",
          message: 'Utiliser ON_ERROR (lib/notify).',
        },
        // Archived elements: one filter, one switch.
        {
          selector:
            "CallExpression[callee.property.name='filter'] > ArrowFunctionExpression > UnaryExpression.body[operator='!'] > MemberExpression.argument[property.name='archived'], CallExpression[callee.property.name='filter'] > ArrowFunctionExpression > LogicalExpression.body[operator='||'] > UnaryExpression.left[operator='!'] > MemberExpression.argument[property.name='archived']",
          message: 'Utiliser unarchived(items, keep) (lib/archive) : les archivés retirés, la valeur en cours gardée.',
        },
        {
          selector: "JSXOpeningElement[name.name='ShowArchivedSwitch'] > JSXAttribute[name.name='count']",
          message: 'Utiliser useArchivedToggle(items) (lib/archive) : <ShowArchivedSwitch {...toggle} />.',
        },
        {
          selector: "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=4]:matches([callee.object.name=/(date|day|Date|Day|today)$/], [callee.object.property.name=/(date|day|Date|Day)$/])",
          message: 'Utiliser yearOfDay(day) (@ordo/shared).',
        },
        // Shared constants: one value.
        {
          selector: "Literal[value='(sans objet)']",
          message: 'Utiliser NO_SUBJECT (@ordo/shared).',
        },
        {
          selector: "Literal[value=/^#868e96$/i]",
          message: 'Utiliser DEFAULT_LABEL_COLOR (@ordo/shared).',
        },
        {
          selector: "Literal[value='La fin doit suivre le début.']",
          message: 'Utiliser END_AFTER_START / endsAfter (@ordo/shared).',
        },
        // Periods (decision Q): the end follows the start, one message, the impossible days greyed out.
        {
          selector:
            "JSXOpeningElement[name.name=/^(DatePickerInput|MonthPickerInput|DateTimePicker)$/] > JSXAttribute[name.name=/^(minDate|maxDate)$/] MemberExpression[property.name=/^(startDate|endDate|since|until|from|to|windowFrom|windowTo|serviceStart|serviceEnd|month|repeatUntil|deadline|start|end)$/]:not([object.name='routine']):not([object.property.name='routine'])",
          message: 'Utiliser dateRangeProps(binding) / formRange(form, début, fin) (components/inputs/date-range) : la fin suit le début, END_AFTER_START, les jours impossibles grisés.',
        },
        {
          selector: "Literal[value=/^(Avant la date de début|La fin ne peut pas être avant le début|L’heure maximale doit suivre l’heure de début)/]",
          message: 'Utiliser END_AFTER_START (@ordo/shared), via rangeProps / dateRangeProps (components/inputs/date-range).',
        },
        {
          selector: "IfStatement[test.callee.property.name='has'][consequent.expression.callee.property.name='delete'][alternate.expression.callee.property.name='add']",
          message: 'Utiliser toggledIn(set, value) (lib/sets).',
        },
        // « Archiver » is never a button: always in the « … » menu (decision R).
        {
          selector:
            "JSXText[value=/^\\s*(Archiver|Restaurer)\\s*$/], JSXOpeningElement[name.name=/^(IconAction|Tooltip|Button|ActionButton|ActionIcon)$/] JSXAttribute Literal[value=/^(Archiver|Restaurer)$/]",
          message: 'Utiliser archiveEntry(élément, mutation, id) (lib/archive) dans le menu « … » (ActionsMenu, RowActions, DetailHeader menu) : « Archiver » n’est jamais un bouton.',
        },
        // Destructive confirmations: confirmDestructive adds the sentence.
        {
          selector: 'Literal[value=/irréversible/], TemplateElement[value.raw=/irréversible/], JSXText[value=/irréversible/]',
          message: 'confirmDestructive (ou DestructiveRisks) ajoute « Cette action est irréversible. ».',
        },
        // Addresses of the app: one helper each.
        {
          selector: 'TemplateElement[value.raw=/^\\/(projects|clients)\\/$/]',
          message: 'Utiliser projectPath(id, tab) / clientPath(id) (app/pages).',
        },
        {
          selector: 'TemplateElement[value.raw=/^\\/calendar\\?date=/]',
          message: 'Utiliser calendarPath(date) (app/pages).',
        },
        {
          selector: 'Literal[value=/^\\/mail\\?/], TemplateElement[value.raw=/^\\/mail\\?/]',
          message: 'Utiliser mailPath(account, folder, uid) (app/pages), ou settingsPath(\'/mail\') (app/layout/page-settings).',
        },
        {
          selector: 'Literal[value=/[?&]settings=1/], TemplateElement[value.raw=/[?&]settings=1/]',
          message: 'Utiliser settingsPath(path, section) (app/layout/page-settings).',
        },
        // Days: a DateTime cut gives the UTC day; the Date scalar is already a day.
        {
          selector: "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=0]:matches([arguments.1.value=7], [arguments.1.value=10])",
          message: 'Pas de .slice(0, 10) / .slice(0, 7) : localDay(instant) (lib/dates) pour un instant, le scalaire Date tel quel pour un jour, monthColumn pour un mois.',
        },
        {
          selector:
            "CallExpression[callee.property.name='substring'][arguments.length=2][arguments.0.value=0]:matches([arguments.1.value=7], [arguments.1.value=10]), MemberExpression[computed=true][property.value=0] > CallExpression.object[callee.property.name='split'][arguments.0.value='T']",
          message: 'Pas de .substring(0, 10) / .split(\'T\')[0] : localDay(instant) (lib/dates) pour un instant, le scalaire Date tel quel pour un jour.',
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
        // Tab of a page: unknown tabs fall back (usePageTab).
        {
          selector: "CallExpression[callee.property.name='get'][arguments.0.value='tab']",
          message: 'Utiliser usePageTab(tabs, fallback) (components/tabs/use-page-tab) : un onglet inconnu ne donne pas de page vide.',
        },
        // Same name: case and accents aside, as the search.
        {
          selector: "BinaryExpression[operator=/^[!=]==$/][left.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/][right.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/]",
          message: 'Utiliser sameName(a, b) (lib/text) : casse et accents ignorés, comme la recherche.',
        },
        // People and schedules: one name per kind of workspace.
        {
          selector: "ConditionalExpression:matches([consequent.value=/^Proches?$/], [alternate.value=/^Relations?$/])",
          message: 'Utiliser relationNoun(perso, many) (components/people/people-options) : « Relations » en pro, « Proches » en perso.',
        },
        {
          selector: "ConditionalExpression[consequent.value='Plages'][alternate.value=/^(Plages|Horaires) de travail$/]",
          message: 'Utiliser schedulesTitle(perso) (features/calendar/lib/schedule-text).',
        },
        // Shared buttons and messages.
        {
          // A cross closing a panel or clearing a selection is not a removal.
          selector:
            "JSXElement[openingElement.name.name=/^(ActionIcon|IconAction)$/]:has(JSXOpeningElement[name.name=/^(TrashIcon|XIcon)$/]):not(:has(JSXAttribute[name.name=/^(aria-label|label)$/][value.value=/^(Fermer|Désélectionner)/]))",
          message: 'Utiliser RemoveButton (components/actions/RemoveButton) pour retirer ou supprimer.',
        },
        {
          selector: "JSXElement[openingElement.name.name='Tooltip'] > JSXElement[openingElement.name.name='ActionIcon']",
          message: 'Utiliser IconAction (components/actions/IconAction) : l’action en infobulle, l’action et l’élément en libellé caché.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='Button']:has(JSXAttribute[name.name='variant'][value.value='subtle']):has(JSXAttribute[name.name='leftSection'] JSXOpeningElement[name.name='PlusIcon'])",
          message: 'Utiliser AddItemButton (components/actions/AddItemButton) : « + » discret et libellé précis.',
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
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS_ACTIONS_MENU, patterns: [NO_FEATURES] }] },
  },
  {
    // Menus of their own: the tree of the saved places in an address field; the library, to be rewritten.
    files: ['src/features/geo/components/AddressInput.tsx', 'src/features/library/**'],
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS_BUT_MENU }] },
  },
  {
    // BatchMultiSelect wraps MultiSelect, ColorField wraps ColorInput; fmt.moneyCents is the shared formatMoney.
    files: ['src/components/inputs/BatchMultiSelect.tsx', 'src/components/inputs/ColorField.tsx', 'src/lib/format.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // To be rewritten entirely: not brought in line.
    files: ['src/features/library/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
