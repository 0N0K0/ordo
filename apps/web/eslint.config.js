import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

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
    name: '@ordo/shared',
    importNames: ['monthOfDay', 'yearOfDay'],
    message: 'Importer monthOfDay et yearOfDay de lib/dates : un seul chemin.',
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
  message: "Une brique commune (components/, lib/) ne dépend pas d'une feature : déplacer le code dans la feature, ou la brique dans components/ ou lib/.",
};

export default defineConfig([
  globalIgnores(['dist', 'src/graphql']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
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
          selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
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
          selector: 'Literal[value=/^(janvier|premier|deuxième|1er)$/]',
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
          selector:
            "CallExpression[callee.name='deleteItemsAction'] Property[key.name='name'] > ArrowFunctionExpression[params.length=1][params.0.type='Identifier'] > MemberExpression.body[object.type='Identifier'][property.name='label']",
          message: 'Utiliser name: rowLabel (components/data-table/selection/selection-actions).',
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
          selector:
            "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=4]:matches([callee.object.name=/(date|day|Date|Day|today)$/], [callee.object.property.name=/(date|day|Date|Day)$/])",
          message: 'Utiliser yearOfDay(day) (@ordo/shared).',
        },
        // Shared constants: one value.
        {
          selector: "Literal[value='(sans objet)']",
          message: 'Utiliser NO_SUBJECT (@ordo/shared).',
        },
        {
          selector: 'Literal[value=/^#868e96$/i]',
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
          selector: 'Literal[value=/^(Avant la date de début|La fin ne peut pas être avant le début|L’heure maximale doit suivre l’heure de début)/]',
          message: 'Utiliser END_AFTER_START (@ordo/shared), via rangeProps / dateRangeProps (components/inputs/date-range).',
        },
        {
          selector: "IfStatement[test.callee.property.name='has'][consequent.expression.callee.property.name='delete'][alternate.expression.callee.property.name='add']",
          message: 'Utiliser toggledIn(set, value) (lib/sets).',
        },
        // « Archiver » is never a button: always in the « … » menu (decision R).
        {
          selector:
            'JSXText[value=/^\\s*(Archiver|Restaurer)\\s*$/], JSXOpeningElement[name.name=/^(IconAction|Tooltip|Button|ActionButton|ActionIcon)$/] JSXAttribute Literal[value=/^(Archiver|Restaurer)$/]',
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
          message: "Utiliser mailPath(account, folder, uid) (app/pages), ou settingsPath('/mail') (app/layout/page-settings).",
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
          message: "Pas de .substring(0, 10) / .split('T')[0] : localDay(instant) (lib/dates) pour un instant, le scalaire Date tel quel pour un jour.",
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
        // A count and its verb or determiner agree: « 1 élément sera retiré », « sa sous-tâche ».
        {
          selector: "TemplateLiteral:has(> CallExpression[callee.name='countOf']) > TemplateElement[value.raw=/^ (seront|sont|ont) /]",
          message: 'Accorder le verbe : plural(count, « sera retiré », « seront retirés ») (lib/text).',
        },
        {
          selector: "JSXExpressionContainer:has(> CallExpression[callee.name='countOf']) + JSXText[value=/^\\s*(seront|sont|ont) /]",
          message: 'Accorder le verbe : plural(count, « sera retiré », « seront retirés ») (lib/text).',
        },
        {
          selector: "TemplateLiteral:has(> CallExpression[callee.name='countOf']) > TemplateElement[value.raw=/(^|\\s)(ses|des|leurs) $/]",
          message: 'Utiliser countWith(count, mot, [« sa », « ses »]) (lib/text) : « sa sous-tâche », « ses 3 sous-tâches ».',
        },
        // Numbers typed: one format.
        {
          selector: "JSXAttribute[name.name='thousandSeparator'][value.value=' ']",
          message: 'Utiliser {...FRENCH_NUMBER_FORMAT} (components/inputs/number-format) : « 1 000,5 » partout.',
        },
        // A click on the map: one rule (its address, else its coordinates; a failure in a toast).
        {
          selector: "CallExpression[callee.name='reverseAddress']",
          message: 'Utiliser pickedAddress(point) (features/geo/api) : l’adresse, sinon les coordonnées, une erreur en notification.',
        },
        // Tab of a page: unknown tabs fall back (usePageTab).
        {
          selector: "CallExpression[callee.property.name='get'][arguments.0.value='tab']",
          message: 'Utiliser usePageTab(tabs, fallback) (components/tabs/use-page-tab) : un onglet inconnu ne donne pas de page vide.',
        },
        // Same name: case and accents aside, as the search.
        {
          selector: 'BinaryExpression[operator=/^[!=]==$/][left.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/][right.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/]',
          message: 'Utiliser sameName(a, b) (lib/text) : casse et accents ignorés, comme la recherche.',
        },
        // People and schedules: one name per kind of workspace.
        {
          selector: 'ConditionalExpression:matches([consequent.value=/^Proches?$/], [alternate.value=/^Relations?$/])',
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
            'JSXElement[openingElement.name.name=/^(ActionIcon|IconAction)$/]:has(JSXOpeningElement[name.name=/^(TrashIcon|XIcon)$/]):not(:has(JSXAttribute[name.name=/^(aria-label|label)$/][value.value=/^(Fermer|Désélectionner)/]))',
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
          // Decision 11: an icon alone keeps its tooltip.
          selector: "JSXOpeningElement[name.name='ActionIcon']",
          message: 'Utiliser IconAction (components/actions/IconAction) : un bouton icône seul garde son infobulle (décision 11) ; FoldButton pour plier, RemoveButton pour retirer.',
        },
        {
          // Decision AB.
          selector: "JSXOpeningElement[name.name='Button']:has(JSXAttribute[name.name='variant'][value.value='default']):has(JSXAttribute[name.name='leftSection'])",
          message: 'Utiliser ActionButton priority="secondary" (components/actions/ActionButton) : icône et libellé, sans couleur (décision AB).',
        },
        {
          // Decision AG.
          selector: "JSXOpeningElement[name.name='Badge'] > JSXAttribute[name.name='tt']",
          message: 'Badges en capitales (décision AG) : pas de tt sur un Badge.',
        },
        {
          // Decision AE.
          selector: 'Literal[value=/\\b(Déplier|Replier)\\b/], TemplateElement[value.raw=/\\b(Déplier|Replier)\\b/]',
          message: 'Utiliser FoldButton (components/actions/FoldButton) : « Développer / Réduire » partout (décision AE).',
        },
        {
          // Decision AI.
          selector: 'Literal[value=/j de retard/], TemplateElement[value.raw=/j de retard/]',
          message: 'Utiliser fmt.daysLate (lib/format), LateBadge sur l’accueil (décision AI).',
        },
        // Round 6 (point 8): patterns written otherwise, and the bricks of points 5 to 7.
        {
          selector: "JSXElement[openingElement.name.name='Tooltip'] > JSXElement[openingElement.name.name='Indicator']",
          message: 'Utiliser IconAction indicator={n} (components/actions/IconAction) : l’action en infobulle, le compte en pastille.',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(find|some|every|findIndex)$/] > ArrowFunctionExpression > UnaryExpression.body[operator='!'] > MemberExpression.argument[property.name='archived'], CallExpression[callee.property.name=/^(find|some|every|findIndex)$/] > ArrowFunctionExpression > LogicalExpression.body > UnaryExpression[operator='!'] > MemberExpression.argument[property.name='archived']",
          message: 'Utiliser unarchived(items, keep) (lib/archive) puis find / some : les archivés retirés, la valeur en cours gardée.',
        },
        {
          selector:
            "CallExpression[callee.property.name='filter'] > ArrowFunctionExpression > LogicalExpression.body[operator='&&'] > UnaryExpression.left[operator='!'] > MemberExpression.argument[property.name='archived']",
          message: 'Utiliser unarchived(items, keep) (lib/archive) puis filter : les archivés retirés, la valeur en cours gardée.',
        },
        {
          selector:
            "NewExpression[callee.name='Set'] > CallExpression[callee.property.name='map'][callee.object.callee.property.name='filter'][callee.object.arguments.0.body.property.name='archived'][arguments.0.body.property.name='id']",
          message: 'Utiliser archivedIds(items) (lib/archive).',
        },
        {
          selector: 'TemplateElement[value.raw=/\\(archivée?\\)/]',
          message: 'Utiliser archivedLabel(item, feminine) (lib/archive).',
        },
        {
          selector: "JSXOpeningElement[name.name='Text'] > JSXAttribute[name.name='tt'] ConditionalExpression Literal[value='uppercase']",
          message: 'Utiliser Caption (components/page/Caption) : petites capitales atténuées, graisse 600, partout.',
        },
        {
          selector:
            "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=4]:matches([callee.object.name=/(start|end|from|to|since|until|month|Month)$/], [callee.object.property.name=/(start|end|from|to|since|until|month|Month|today)$/])",
          message: 'Utiliser yearOfDay(day) (lib/dates) : l’année d’un jour ou d’un mois.',
        },
        {
          selector: "CallExpression[callee.property.name='slice'][arguments.0.value=5][arguments.1.value=7]",
          message: 'Utiliser monthOfYear(day) (@ordo/shared) : le mois (1 à 12) d’un jour.',
        },
        {
          selector:
            'TemplateElement[value.raw=/^\\/(accounting|sheets|shopping)\\//], Literal[value=/^\\/(accounting|sheets|shopping)\\/./], TemplateElement[value.raw=/^\\/(time|routines|shopping)\\?/], Literal[value=/^\\/(time|routines|shopping)\\?/]',
          message: 'Utiliser documentPath, sheetPath, shoppingListPath, SHOPPING_LISTS_PATH, timePath, routineHistoryPath (app/pages).',
        },
        {
          selector:
            "Literal[value=/^\\/(tasks|routines|calendar|time|alarms|shopping|sheets|stock|accounting|treasury|mail|documents|dashboards|settings|account)$/]:not(Property[key.name='path'] > Literal)",
          message: 'Utiliser PAGES.x.path (app/pages) : une adresse par page.',
        },
        {
          selector:
            'ConditionalExpression[test.operator=/^(>|!==|!=)$/][test.right.value=1][consequent.value=/./][alternate.value=/./]:matches([test.left.name=/(count|length|total|size)$/i], [test.left.property.name=/^(length|size)$/])',
          message: 'Utiliser plural(count, singulier, pluriel) ou countOf(count, mot) (lib/text).',
        },
        {
          selector:
            "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=0]:not([arguments.1.type='Identifier']):matches([callee.object.name=/^(label|name|title|subject)$/], [callee.object.property.name=/^(label|name|title|subject)$/])",
          message: 'Utiliser clipText(text, max) (@ordo/shared) : coupé au maximum du schéma, avec « … ».',
        },
        {
          selector: "CallExpression[callee.property.name='add'][callee.object.callee.name='descendantIds'], ArrayExpression > SpreadElement > CallExpression.argument[callee.name='descendantIds']",
          message: 'Utiliser subtreeOf(items, id) (@ordo/shared) : l’élément et tous ses descendants.',
        },
        {
          selector: "JSXElement[openingElement.name.name='Badge']:has(JSXText[value=/retard/])",
          message: 'Utiliser LateBadge (features/home) ou fmt.daysLate (lib/format) : un seul retard, orange (décision AI).',
        },
        {
          selector: 'ConditionalExpression[consequent.openingElement.name.name=/^Caret(Down|Right)Icon$/][alternate.openingElement.name.name=/^Caret(Down|Right)Icon$/]',
          message: 'Utiliser FoldButton (components/actions/FoldButton) : un chevron qui tourne, « Développer / Réduire » (décision AE).',
        },
        {
          selector: 'Literal[value=/^(Plages|Horaires) de travail$/], JSXText[value=/^\\s*(Plages|Horaires) de travail\\s*$/]',
          message: 'Utiliser schedulesTitle(perso) (features/calendar/lib/schedule-text) : « Plages » en perso.',
        },
        {
          selector:
            "CallExpression[callee.property.name='reduce'][arguments.length=2][arguments.1.value=0] > ArrowFunctionExpression:first-child > BinaryExpression.body[operator='+'][left.type='Identifier']",
          message: 'Utiliser sumOf(items, (item) => valeur) (@ordo/shared).',
        },
        {
          selector: "CallExpression[callee.object.name='fmt'][callee.property.name='number'][arguments.1.value=3]",
          message: 'Utiliser fmt.quantity({ quantity, unit }) (lib/format) : une quantité, 3 décimales au plus.',
        },
        {
          selector: "JSXElement[openingElement.name.name='Center']:has(JSXAttribute[name.name='h'][value.value=/^100d?vh$/]):has(JSXOpeningElement[name.name='Loader'])",
          message: 'Utiliser FullPageLoader (components/feedback/FullPageLoader) pour un chargement plein écran, PageMessage pour une page d’erreur.',
        },
        {
          selector:
            "CallExpression[callee.property.name='get'][arguments.0.type='Literal'] > MemberExpression.callee > MemberExpression.object[property.value=0][object.callee.name='useSearchParams']",
          message: 'Utiliser useSearchParam(clé) (lib/search-params).',
        },
        {
          selector: 'Literal[value=/mails? déplacés?/i], TemplateElement[value.raw=/mails? déplacés?/i]',
          message: 'Utiliser movedMailsMessage(count, dossier) (features/mail/lib/mail-format).',
        },
        {
          selector: "ObjectExpression:has(> SpreadElement[argument.name=/^(cellField|cellCombobox|sharedField|sharedCombobox)$/]):has(> Property[key.name='onClick'][value.name='stopClick'])",
          message: 'Utiliser stoppedCellField / stoppedCellCombobox (components/data-table/cells/cell-field).',
        },
        {
          selector: "CallExpression[callee.object.name='modals'][callee.property.name=/^(open|openConfirmModal)$/]",
          message: 'Utiliser openModal (components/panels/open-modal), ou confirmDestructive (components/dialogs/confirm-destructive).',
        },
        {
          selector: "JSXAttribute[name.name='renderOption'] ReturnStatement > JSXElement[openingElement.name.name='PersonOption']",
          message: 'Utiliser personOptionRenderer(byId) (components/people/person-option).',
        },
        {
          selector: "TemplateLiteral:has(> TemplateElement[value.raw=/(^| )#$/]) > MemberExpression[property.name='number']",
          message: 'Utiliser taskName(task) / taskRef(task) (features/tasks/hooks/use-task-context) ou taskShortRef(task, projet, lieu) (components/markdown/remark-references).',
        },
        {
          selector:
            "ArrayExpression[elements.length=3][elements.0.type='SpreadElement'][elements.0.argument.callee.property.name='slice'][elements.0.argument.arguments.0.value=0][elements.2.type='SpreadElement'][elements.2.argument.callee.property.name='slice'][elements.2.argument.arguments.length=1]",
          message: 'Utiliser movedTo(others, moved, index) (@ordo/shared), ou moveToIndex(list, id, index) (lib/mutation).',
        },
        {
          selector: "Literal[value='max(36rem, calc(100dvh - 16rem))']",
          message: 'Utiliser PAGE_PREVIEW_HEIGHT (features/files/components/FilePreview).',
        },
        {
          selector: 'TemplateLiteral > TemplateElement[value.raw=/^(doc|imp):$/]',
          message: 'Utiliser documentKey / allocationKey / allocationOfKey (features/treasury/components/EntryForm).',
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
    files: ['src/lib/query-client.ts', 'src/lib/week.ts', 'src/components/people/people-options.ts', 'src/components/markdown/MarkdownView.tsx'],
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
    // To be rewritten entirely: not brought in line.
    files: ['src/features/library/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
