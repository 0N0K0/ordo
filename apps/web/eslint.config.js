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
    name: '@ordo/shared',
    importNames: ['dayIn', 'localInstant'],
    message: 'Utiliser localDay / localInstant de lib/dates (le jour de l’utilisateur) : un seul chemin.',
  },
  {
    name: '@mantine/dates',
    importNames: ['TimeInput'],
    message: 'Utiliser TimePicker : 24 h et libellés par défaut (app/theme).',
  },
  {
    name: '@phosphor-icons/react',
    importNames: ['DotsThreeIcon', 'DotsThreeVerticalIcon', 'DotsThreeOutlineIcon', 'DotsThreeOutlineVerticalIcon', 'DotsThreeCircleIcon', 'DotsThreeCircleVerticalIcon'],
    message: 'Un menu « … » : ActionsMenu sans target (trois points verticaux, décision T ; variant="light" à côté de boutons, décision CN).',
  },
  {
    name: '@ordo/shared',
    importNames: ['FILTER_OPERATORS'],
    message: 'Utiliser operatorsFor (components/filters/filter-meta) : les opérateurs propres d’un champ, sans « est vide » sur un champ obligatoire.',
  },
];

// The same, Menu allowed: the genuinely special menus.
const RESTRICTED_PATHS_BUT_MENU = RESTRICTED_PATHS.filter((path) => !path.importNames.includes('Menu'));

// ActionsMenu itself: wraps Menu and draws the « … » button.
const RESTRICTED_PATHS_ACTIONS_MENU = RESTRICTED_PATHS_BUT_MENU.filter((path) => path.name !== '@phosphor-icons/react');

// A count in a template followed by the text after it: `${count} tâches`, `${n} ${plural(n, 'tâche')}` (the expressions
// and the texts of a template are two lists: expression i is followed by text i + 1).
const COUNT_EXPRESSION = (path) =>
  `:matches([${path}.type='Identifier'][${path}.name=/^(count|n|total|size|length)$|(Count|Total)$/], [${path}.type='MemberExpression'][${path}.property.name=/^(length|size|count|total)$|(Count|Total)$/])`;
const COUNT_THEN = (text) =>
  [0, 1, 2, 3, 4]
    .map((index) => `TemplateLiteral${COUNT_EXPRESSION(`expressions.${index}`)}[quasis.${index + 1}.value.raw=${text}]`)
    .join(', ');
// A plural noun right after a count (« 3 tâches »), invariable words aside (temps, fois, mois…).
const PLURAL_NOUN = "/^ (?!(temps|fois|mois|pas|plus|dans|sans|sous|vers|après|depuis)(?![a-zàâçéèêëîïôûùüœ]))[a-zàâçéèêëîïôûùüœ’-]*[a-zàâçéèêëîïôûùüœ]s(?![a-zàâçéèêëîïôûùüœ])/";

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
        // Heavy libraries stay out of the start of the app: their components are loaded when first shown.
        {
          selector: "ImportDeclaration[importKind!='type'][source.value=/\\/(RichEditor|PlaceMap)$/]",
          message: 'Utiliser LazyRichEditor / LazyPlaceMap : l’éditeur et la carte sont chargés à la demande.',
        },
        {
          selector: "CallExpression[callee.name='lazy']",
          message: 'Utiliser lazyNamed (lib/lazy) : une seule façon de charger un composant à la demande.',
        },
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
            "CallExpression[callee.property.name=/^(filter|find|some|every|findIndex)$/] > ArrowFunctionExpression > UnaryExpression.body[operator='!'] > MemberExpression.argument[object.type='Identifier'][property.name='archived'], CallExpression[callee.property.name=/^(filter|find|some|every|findIndex)$/] > ArrowFunctionExpression > LogicalExpression.body UnaryExpression[operator='!'] > MemberExpression.argument[object.type='Identifier'][property.name='archived'], CallExpression[callee.property.name=/^(filter|find|some|every|findIndex)$/] > ArrowFunctionExpression > BlockStatement.body ReturnStatement UnaryExpression[operator='!'] > MemberExpression.argument[object.type='Identifier'][property.name='archived']",
          message: 'Utiliser unarchived(items, keep) (lib/archive), puis filter / find / some : les archivés retirés, la valeur en cours gardée.',
        },
        {
          selector: "JSXOpeningElement[name.name='ShowArchivedSwitch'] > JSXAttribute[name.name='count']",
          message: 'Utiliser useArchivedToggle(items) (lib/archive) : <ShowArchivedSwitch {...toggle} />.',
        },
        {
          selector:
            "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=4]:matches([callee.object.name=/(date|day|Date|Day|today)$/], [callee.object.property.name=/(date|day|Date|Day)$/])",
          message: 'Utiliser yearOfDay(day) (lib/dates).',
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
          message: "Utiliser mailPath(account, folder, uid) (app/pages), ou settingsPath('/mail') (app/pages).",
        },
        {
          selector: 'Literal[value=/[?&]settings=1/], TemplateElement[value.raw=/[?&]settings=1/]',
          message: 'Utiliser settingsPath(path, section) (app/pages).',
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
          selector:
            "ConditionalExpression[test.operator=/^(>|!==|!=)$/][test.right.value=1][consequent.value='s'], ConditionalExpression[test.operator=/^(===|==|<=)$/][test.right.value=1][alternate.value='s'], ConditionalExpression[test.operator='<'][test.right.value=2][alternate.value='s'], ConditionalExpression[test.operator=/^(===|==|<=)$/][test.right.value=1][consequent.value=/./][alternate.value=/s$/]:matches([test.left.name=/(count|length|total|size)$/i], [test.left.property.name=/^(length|size)$/])",
          message: 'Utiliser plural(count, mot) ou countOf(count, mot) (lib/text).',
        },
        {
          // A plural helper of its own.
          selector:
            "FunctionDeclaration[id.name=/^(plural|plurali[sz]e)\\w*$/i], VariableDeclarator[id.name=/^(plural|plurali[sz]e)\\w*$/i]:matches([init.type='ArrowFunctionExpression'], [init.type='FunctionExpression'])",
          message: 'Utiliser plural(count, singulier, pluriel), countOf ou countWith (lib/text) : pas d’aide de pluriel locale.',
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
        // « Archiver » / « Restaurer » entry written by hand.
        {
          selector: "Property[key.name='label'] > Literal[value=/^(Archiver|Restaurer)$/], Property[key.name='label'] > ConditionalExpression > Literal[value=/^(Archiver|Restaurer)$/]",
          message: 'Utiliser archiveEntry(element, setArchived, id) (lib/archive) : libellé, icône, annulation et menu.',
        },
        // The message of an error toast: notifyFailure (lib/notify) has the fallback of an error without one.
        {
          selector: "CallExpression[callee.name='notifyError'][arguments.0.property.name='message']",
          message: 'Utiliser notifyFailure(error) ou onMutationError (lib/notify) : un message de repli pour une erreur sans message.',
        },
        // A tooltip around an action button: hidden when the button is disabled.
        {
          selector:
            "JSXElement[openingElement.name.name='Tooltip'] > JSXElement[openingElement.name.name=/^(ActionButton|IconAction)$/], JSXElement[openingElement.name.name='Tooltip'] JSXOpeningElement[name.name=/^(Button|ActionButton|IconAction|ActionIcon|UnstyledButton)$/]:has(> JSXAttribute[name.name='disabled']), JSXElement[openingElement.name.name='Tooltip'] > JSXExpressionContainer > Identifier[name=/[bB]utton$/]",
          message: 'Utiliser la prop hint d’ActionButton ou d’IconAction (components/actions) : l’infobulle s’affiche aussi quand le bouton est désactivé.',
        },
        // Relations in a personal workspace: « Proche », with its agreement.
        {
          selector: 'Literal[value=/^(Nouvelle relation|Relation (modifiée|ajoutée|supprimée)\\.?|Supprimer la relation|Modifier la relation|Aucune relation\\.)$/]',
          message: 'Utiliser relationWords(perso) (components/people/people-options) : « relation » en pro, « proche » en perso.',
        },
        // People and schedules: one name per kind of workspace.
        {
          selector: 'Literal[value=/^(Proches?|Relations?)$/], JSXText[value=/^\\s*(Proches?|Relations?)\\s*$/]',
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
          // Decision 11: an icon alone keeps its tooltip.
          selector: "JSXOpeningElement[name.name='ActionIcon']",
          message: 'Utiliser IconAction (components/actions/IconAction) : un bouton icône seul garde son infobulle (décision 11) ; FoldButton pour plier, RemoveButton pour retirer.',
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
          message: 'Utiliser fmt.daysLate (lib/format), LateBadge (components/feedback) sur l’accueil (décision AI).',
        },
        // Round 6 (point 8): patterns written otherwise, and the bricks of points 5 to 7.
        {
          selector: "JSXElement[openingElement.name.name='Tooltip'] > JSXElement[openingElement.name.name='Indicator']",
          message: 'Utiliser IconAction indicator={n} (components/actions/IconAction) : l’action en infobulle, le compte en pastille.',
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
          message: 'Utiliser LateBadge (components/feedback) ou fmt.daysLate (lib/format) : un seul retard, orange (décision AI).',
        },
        {
          selector:
            'ConditionalExpression[consequent.openingElement.name.name=/^Caret(Up|Down|Right|Left)Icon$/][alternate.openingElement.name.name=/^Caret(Up|Down|Right|Left)Icon$/], ConditionalExpression[consequent.name=/^Caret(Up|Down|Right|Left)Icon$/][alternate.name=/^Caret(Up|Down|Right|Left)Icon$/]',
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
          // The same, written as JSX attributes: a borderless field whose click is kept from the row.
          selector:
            "JSXOpeningElement:has(> JSXAttribute[name.name='onClick'][value.expression.name='stopClick']):matches(:has(> JSXAttribute[name.name='variant'][value.value='unstyled']), :has(> JSXSpreadAttribute[argument.name=/^(cellField|cellCombobox)$/]))",
          message: 'Utiliser {...stoppedCellField} / {...stoppedCellCombobox} (components/data-table/cells/cell-field).',
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
          selector:
            "ObjectExpression:has(> Property[key.name='id'][value.value='root']) > Property[key.name='children'] > ArrayExpression[elements.length=1] > ObjectExpression:has(> Property[key.name='type'][value.value='condition'])",
          message: 'Utiliser conditionFilter(champ, opérateur, valeur) ou withinFilter(champ, période) (components/data-table/views/use-data-view).',
        },
        {
          selector: "TemplateLiteral:has(> MemberExpression[property.name=/^(routineId|sprintId)$/]):has(> TemplateElement[value.raw='|'])",
          message: 'Utiliser routineLinkKey(lien) / routineLinkOf(clé) (features/calendar/lib/event-input) ou sprintTaskKey(sprint, tâche) (features/dashboards/api).',
        },
        {
          selector: "ConditionalExpression[test.property.name='perishable'][consequent.operator='??'][consequent.left.property.name='storageId']:not([alternate.raw='null'])",
          message: 'Utiliser conservationKey(ligne) / conservationOf(clé) (features/shopping/lib/conservation).',
        },
        {
          selector: "ArrowFunctionExpression[params.0.type='ArrayPattern'] > ObjectExpression > Property[key.name='value'] > CallExpression[callee.name='personKey']",
          message: 'Utiliser personKeyOptions(type, noms) (components/people/people-keys).',
        },
        {
          selector:
            "ObjectExpression[properties.length=3]:has(> Property[key.name='parentId'][value.property.name='parentId']):has(> Property[key.name='color'][value.type='LogicalExpression'][value.right.raw='null'])",
          message: 'Utiliser treeItemInput(valeurs) (components/settings/settings-api).',
        },
        {
          selector: "JSXElement[openingElement.name.name='FileLink'] JSXOpeningElement[name.name='PaperclipIcon']",
          message: 'Utiliser FileBadge (components/items/FileBadge) : un seul badge de fichier.',
        },
        {
          selector: "CallExpression[callee.name='confirmDestructive'] Property[key.name='onConfirm'] CallExpression[callee.name='notifySuccess']",
          message: 'Utiliser run: () => promesse et done: « Message. » de confirmDestructive.',
        },
        {
          selector: "JSXAttribute[name.name='style'] Property[key.name=/^(transform|rotate)$/] Literal[value=/(rotate|deg)/]",
          message: 'Utiliser FoldButton ou FoldChevron (components/actions) : un seul chevron de pliage (décision AE).',
        },
        {
          selector:
            "TryStatement > BlockStatement.finalizer CallExpression[callee.name=/^set\\w*(Loading|Pending|Exporting|Busy|Saving)$/][arguments.0.value=false], CallExpression[callee.property.name='finally'] CallExpression[callee.name=/^set\\w*(Loading|Pending|Exporting|Busy|Saving)$/][arguments.0.value=false]",
          message: 'Utiliser useAsyncAction(action, { success, onDone, onError }) (lib/use-async-action).',
        },
        {
          selector:
            "CallExpression[callee.name='dateStyle']:has(Property[key.name='month'][value.value='long']):has(Property[key.name='year']):has(Property[key.name='day']):not(:has(Property[key.name='weekday']))",
          message: 'Utiliser longDayText (@ordo/shared) ou fmt.dayInWords (lib/format).',
        },
        {
          selector: "SpreadElement[argument.name='VAT_RATES']",
          message: 'Utiliser vatRateOptions(taux) (features/accounting/lib/labels).',
        },
        {
          selector:
            "TemplateLiteral:has(> CallExpression[callee.object.name='Math'][callee.property.name='round']):has(> TemplateElement[value.raw=/^\\s?%/]), JSXExpressionContainer[expression.callee.object.name='Math'][expression.callee.property.name='round'] + JSXText[value=/^\\s?%/], BinaryExpression[operator='+'][left.callee.object.name='Math'][left.callee.property.name='round'][right.value=/^\\s?%/]",
          message: 'Utiliser fmt.percent(valeur, 0) (lib/format).',
        },
        {
          selector:
            "BinaryExpression[operator='/'][right.value=100]:matches([left.name=/(cents|amounts?|remainder)$/i], [left.property.name=/(cents|amount|remainder)$/i], [left.object.name=/amounts$/], [left.arguments.0.name=/(cents|remainder)$/i])",
          message: 'Utiliser fromCents(centimes) (@ordo/shared).',
        },
        {
          selector: "BinaryExpression[operator='/'][right.value=100][left.callee.object.name='Math'][left.callee.property.name='round']",
          message: 'Utiliser round2(valeur) (@ordo/shared) : arrondi à 2 décimales, ou fromCents(centimes) pour des centimes.',
        },
        {
          selector: "TemplateLiteral[expressions.length>1]:has(> CallExpression[callee.name='taskRef']), BinaryExpression[operator='+']:has(> CallExpression[callee.name='taskRef'])",
          message: 'Utiliser taskNumbered(task) (features/tasks/hooks/use-task-context) : « #12 Libellé ».',
        },
        {
          selector: "CallExpression[callee.property.name='trim'][callee.object.callee.name='taskRef']",
          message: 'Utiliser taskNumber(task) (features/tasks/hooks/use-task-context) : « #12 ».',
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
          message:
            'Utiliser settledKey / allocationKey / allocationOfKey, les clés des documents réglés (fonctions de features/treasury/components/EntryForm.tsx ; le documentKey de features/treasury/lib/entry-env est une autre clé).',
        },
        {
          selector: "JSXOpeningElement[name.name='Alert'] > JSXAttribute[name.name='color'][value.value='red']",
          message: 'Utiliser ErrorAlert (components/feedback/ErrorAlert).',
        },
        {
          selector: "JSXOpeningElement[name.name='Alert'] > JSXAttribute[name.name='color'][value.value=/^(green|teal|blue|yellow|orange)$/]",
          message: 'Utiliser NoticeAlert (components/feedback/NoticeAlert) avec kind success / info / warning.',
        },
        // Files and documents: the messages and names of @ordo/shared.
        {
          selector: 'Literal[value=/Mo maximum/], TemplateElement[value.raw=/Mo maximum/]',
          message: 'Utiliser fileTooLarge(nom) ou ICON_ERRORS (@ordo/shared) : le même message que l’API.',
        },
        {
          selector: 'TemplateLiteral > TemplateElement[tail=true][value.raw=/\\.(pdf|zip|csv|ics)$/]',
          message: 'Utiliser fileName(titre, extension) (lib/download) : nom nettoyé, comme les autres exports.',
        },
        {
          selector:
            "LogicalExpression:has(> BinaryExpression[right.value='INVOICE']):has(> BinaryExpression[right.value='DEPOSIT_INVOICE']), ArrayExpression[elements.length=2][elements.0.value='INVOICE'][elements.1.value='DEPOSIT_INVOICE'], ArrayExpression[elements.length=4][elements.0.value='QUOTE'][elements.1.value='INVOICE']",
          message: 'Utiliser isInvoice(type), INVOICE_TYPES ou ACCOUNTING_DOCUMENT_TYPES (@ordo/shared).',
        },
        {
          // « Not a quote nor a credit note »: an invoice.
          selector: "LogicalExpression:has(> BinaryExpression[right.value='QUOTE']):has(> BinaryExpression[right.value='CREDIT_NOTE'])",
          message: 'Utiliser isInvoice(type) (@ordo/shared) : une facture ou une facture d’acompte.',
        },
        // Mail: the bricks of features/mail and @ordo/shared.
        {
          selector:
            "ArrowFunctionExpression[body.type='MemberExpression'][body.property.name='email'][params.0.name='account'], ArrowFunctionExpression[body.callee.property.name='toLowerCase'][body.callee.object.property.name='email'][params.0.name='account']",
          message: 'Utiliser useOwnAddresses() (features/mail/hooks/use-own-addresses).',
        },
        {
          selector: "TSUnionType:has(TSLiteralType > Literal[value='correspondent'])",
          message: 'Utiliser MailSortBy / MailSearchSortBy (@ordo/shared).',
        },
        // The subject of the menus: « Actions de « X » » (decision BF).
        {
          selector:
            "JSXOpeningElement[name.name=/^(ActionsMenu|RowActions|InlineActions|SortableTabs)$/] > JSXAttribute[name.name='name'] :matches(Literal[value=/^(la|le|les|ce|ces|cet|cette|mon|du|des) /], Literal[value=/^l’/], TemplateElement[value.raw=/^(la|le|les|ce|ces|mon|du|des) /], TemplateElement[value.raw=/^l’/])",
          message: 'Un nom dans name (cité : « Actions de « X » »), une description dans about (« la barre latérale ») : ActionsSubject (components/actions/actions-subject).',
        },
        // The workspace of a layer: « Label · Espace » (decision BG).
        {
          selector:
            "TemplateLiteral:has(> TemplateElement[value.raw=/( · | \\(|espace « )$/]) > MemberExpression:matches([property.name='workspaceLabel'], [property.name='label'][object.property.name='workspace'])",
          message: 'Utiliser inWorkspace(libellé, espace) (features/calendar/lib/layer-label) : « Libellé · Espace » partout.',
        },
        // Direction of a movement: « Entrées / Sorties » (decision BH).
        {
          selector: 'Literal[value=/^(Recettes|Dépenses|Entrées|Sorties)$|\\((recettes|dépenses)\\)/], TemplateElement[value.raw=/^(recettes|dépenses)$/]',
          message: 'Utiliser DIRECTION_PLURALS (features/treasury/lib/direction) : « Entrées / Sorties » partout.',
        },
        // The arrow of a menu button (decision: MenuCaret); the menu target sets aria-haspopup itself.
        {
          selector: "JSXAttribute[name.name='rightSection'] JSXOpeningElement[name.name='CaretDownIcon'], JSXAttribute[name.name='aria-haspopup'][value.value='menu']",
          message: 'Utiliser <MenuCaret /> (components/actions/MenuCaret) ; Menu.Target pose aria-haspopup et aria-expanded.',
        },
        // An icon button names its element by `item` (« Modifier « X » », decision W), not in a hand-written aria-label.
        {
          selector: "JSXOpeningElement[name.name='IconAction'] > JSXAttribute[name.name='aria-label'] > JSXExpressionContainer > TemplateLiteral",
          message: 'Utiliser item (et hint pour un texte long) d’IconAction : l’action en infobulle, l’action et l’élément en libellé caché.',
        },
        {
          // IconAction the wrong way round: a long text in label, the action in aria-label.
          selector:
            "JSXOpeningElement[name.name='IconAction']:has(> JSXAttribute[name.name='aria-label']) > JSXAttribute[name.name='label']:matches([value.value=/\\(/], :has(Literal[value=/\\(/]), :has(TemplateElement[value.raw=/\\(/]), :has(Identifier[name='hint']))",
          message:
            'IconAction (components/actions/IconAction) : l’action courte dans label, le texte long dans hint ; aria-label seulement pour un libellé caché qui n’est pas un nom (« Fermer le mail »).',
        },
        // A field named after its element: the common form.
        {
          selector: 'TemplateElement[value.raw=/^Libellé de /]',
          message: 'Utiliser itemCellLabel(« Libellé », élément, count) (components/data-table/cells/cell-field) ou bulkCellLabels (data-table/selection/bulk-edit) : « Libellé de « X » ».',
        },
        // A client picked in a list: one select.
        {
          selector:
            "JSXOpeningElement[name.name='Select']:matches(:has(> JSXAttribute[name.name='label'][value.value=/^Clients?$/]), :has(JSXAttribute[name.name='data'] :matches(Identifier[name=/^(clients|clients?(Options|Data))$/], MemberExpression[property.name='clients'])))",
          message: 'Utiliser ClientSelect (features/projects/components/ClientSelect) : les clients sans les archivés, la valeur en cours gardée.',
        },
        // Outside links: one target and one rel.
        {
          selector: "JSXAttribute[name.name='rel'], Property[key.name='rel'], JSXAttribute[name.name='target'][value.value='_blank']",
          message: 'Utiliser {...EXTERNAL_LINK} (components/actions/link-props) : nouvel onglet, noopener noreferrer.',
        },
        // Addresses of the app: app/pages.
        {
          selector:
            "Literal[value=/^\\/(login|forgot-password|reset-password|confirm-email|accounting\\?|settings\\?tab=)/], TemplateElement[value.raw=/^\\/(login|forgot-password|reset-password|confirm-email|accounting\\?|settings\\?tab=)/], JSXAttribute[name.name=/^(to|href)$/][value.value='/'], JSXAttribute[name.name=/^(to|href)$/] > JSXExpressionContainer > Literal[value='/'], CallExpression[callee.name='navigate'] > Literal.arguments[value='/'], ConditionalExpression > Literal[value='/'], ArrayExpression > Literal[value='/'], LogicalExpression > Literal[value='/'], AssignmentExpression > Literal.right[value='/'], ReturnStatement > Literal[value='/'], Property[key.name=/^(to|href|pathname|redirect\\w*)$/] > Literal[value='/']",
          message: 'Utiliser PAGES, AUTH_PATHS, OVERDUE_INVOICES_PATH, GITHUB_SETTINGS_PATH ou les aides d’adresse (app/pages).',
        },
        // Badges in capitals (decision AG): no tt="none".
        {
          selector: "JSXAttribute[name.name='tt'][value.value='none']",
          message: 'Pas de tt="none" : les badges et titres gardent leurs capitales (décision AG).',
        },
        // Hidden labels of the cells: « Unité de « X » », or « (appliqué aux N cellules sélectionnées) » (decision BD).
        {
          selector: 'JSXOpeningElement[name.name=/^(Editable\\w+|\\w+Cell)$/] > JSXAttribute[name.name=/^(aria-)?label$/] > JSXExpressionContainer > TemplateLiteral',
          message: 'Utiliser bulkCellLabels(view, nom) (data-table/selection/bulk-edit) ou itemCellLabel (cell-field) : la forme commune, sélection comprise.',
        },
        // What a time was spent on: one name (agenda, header timer, timer card).
        {
          selector: "LogicalExpression[operator='??'][right.value=/./] > MemberExpression.left[property.name='routineLabel'], LogicalExpression[operator='??'] > MemberExpression.right[property.name='routineLabel']",
          message: 'Utiliser entrySubject(entry, context) (features/time/lib/entry-subject) : le projet, ou la routine.',
        },
        // A typed cell: Escape gives the draft up before the blur saves it.
        {
          selector: "JSXAttribute[name.name='onKeyDown'] CallExpression[callee.name='setDraft']",
          message: 'Utiliser useCellDraft (components/data-table/cells/cell-field) : Entrée enregistre, Échap annule sans enregistrer.',
        },
        // Round 8, lot 2: the bricks of the small duplicates.
        {
          selector: "Literal[value=/^\\(?[Bb]rouillon\\)?$/], Literal[value='ce brouillon'], JSXText[value=/^\\s*Brouillon\\s*$/]",
          message: 'Utiliser DRAFT_NAME, documentName(number, label ?) ou documentTitle(document) (@ordo/shared), DraftBadge (accounting) : « Brouillon » (décision CD).',
        },
        {
          selector: "TemplateLiteral:has(> MemberExpression[object.name='DOCUMENT_TYPE_LABELS']):has(> MemberExpression[property.name='number']), TemplateLiteral:has(> MemberExpression[object.name='DOCUMENT_TYPE_LABELS']):has(> LogicalExpression[left.property.name='number'])",
          message: 'Utiliser documentTitle(document) (@ordo/shared) : « Facture F-2026-001 », « Facture Brouillon », sans espace en fin.',
        },
        {
          selector: "TemplateLiteral:has(> MemberExpression[property.name='email']):has(> TemplateElement[value.raw=/<$/]), Property[key.name='label'] > MemberExpression.value[property.name='email'], TemplateLiteral:has(> MemberExpression[property.name='email']):has(> TemplateElement[value.raw=/\\($/])",
          message: 'Utiliser accountLabel(account) (features/mail/lib/mail-format) : « Nom <adresse> » (décision CE).',
        },
        {
          selector: "ConditionalExpression:matches([test.property.name=/^(overdue|late)$/], [test.object.name=/^(late|overdue)$/]) > Literal.consequent[value=/^(red|orange)$/]",
          message: 'Utiliser LATE_COLOR (components/feedback/feedback-colors) : un retard en orange (décisions AI, CF).',
        },
        {
          selector: "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='color'][value.value='red']",
          message: 'Utiliser ActionButton danger (components/actions) : rouge plein, texte rouge en tertiaire (décision CN).',
        },
        {
          selector: "JSXOpeningElement[name.name=/^(UnstyledButton|Button)$/]:has(> JSXAttribute[name.name='aria-expanded']):not(:has(> JSXAttribute[name.name='aria-haspopup']))",
          message: 'Utiliser FoldHeading (components/actions/FoldHeading) : toute la ligne cliquable, chevron, titre, compte (décision CH).',
        },
        {
          selector: "JSXAttribute[name.name='leftSection'] > JSXExpressionContainer > ConditionalExpression[test.name='current'] > JSXElement.consequent[openingElement.name.name='ItemAvatar']",
          message: 'Utiliser itemSelectProps(items, value) ou chosenAvatar(items, value) (components/items/item-look).',
        },
        {
          selector: "Literal[value=' (fermée)'], TemplateElement[value.raw=/\\(fermée\\)/]",
          message: 'Utiliser closedMark(task) (tasks/hooks/use-task-context) ou timeTaskOptions(context, tasks) (time/lib/time-tasks).',
        },
        {
          selector: "ObjectExpression:has(> Property[key.name='mutationFn']) > Property[key.name=/^on(Success|Settled)$/]:has(CallExpression[callee.property.name='invalidateQueries']):not(:has(IfStatement))",
          message: 'Utiliser useInvalidatingMutation(request, { invalidate }) (lib/mutation).',
        },
        {
          selector: "JSXAttribute[name.name='onChange'] ConditionalExpression[test.operator='==='][test.left.operator='typeof'][test.right.value='number'][alternate.value=null], JSXAttribute[name.name='onChange'] ConditionalExpression[test.operator='==='][test.right.value=''][consequent.value=null][alternate.callee.name='Number'], VariableDeclarator[id.name='optionalNumber']",
          message: 'Utiliser optionalNumberProps(form, champ) ou optionalNumber(value) (components/inputs/number-format).',
        },
        {
          selector: "Property > Literal.value[value=/^(Professionnel|Particulier)$/], ConditionalExpression > Literal[value=/^(Professionnel|Particulier)$/]",
          message: 'Utiliser CLIENT_KIND_LABELS (features/accounting/lib/labels).',
        },
        {
          selector: "Literal[value=/^(Consommé|Ajouté|Perdu)$/]",
          message: 'Utiliser STOCK_MOVEMENT_LABELS (@ordo/shared) : les mêmes noms de mouvements partout.',
        },
        {
          selector: "CallExpression[callee.property.name='mutate'] > ObjectExpression > Property[key.name='onError'] > ArrowFunctionExpression > CallExpression[callee.name='showFormError']",
          message: 'Utiliser formCallbacks(form, message ou null) (lib/form).',
        },
        {
          selector: "Property[key.name='beneficiaryRelationIds'] > CallExpression[callee.name='applyDiff']",
          message: 'Utiliser beneficiariesDiff(target, before, after) (features/beneficiaries/lib/beneficiaries-diff).',
        },
        {
          selector: "CallExpression[callee.name='alarmTaskLabel']",
          message: 'Utiliser alarmTarget(alarm, taskOf, projectOf) (features/alarms/lib/alarm-labels) : le même lien partout.',
        },
        {
          selector: "JSXAttribute[name.name=/^(c|color)$/] ConditionalExpression[test.operator='<'][test.right.value=0][consequent.value='red'] > Literal.alternate[value=/^(teal|green)$/]",
          message: 'Utiliser SignedAmount (components/money/SignedAmount) : entrée en vert avec « + », sortie en rouge.',
        },
        {
          selector: "Literal[value='Dans 30 jours'], TemplateElement[value.raw=/^Dans 30 jours/]",
          message: 'Utiliser IN_30_DAYS (features/home/lib/home-data).',
        },
        {
          selector: "MemberExpression[object.name='Number'][property.name='MAX_SAFE_INTEGER']",
          message: 'Utiliser LAST_RANK (components/data-table/table/table-engine) : ce qui n’a pas de rang, en dernier.',
        },
        {
          selector: "TemplateLiteral[quasis.length=3][quasis.0.value.raw=''][quasis.1.value.raw=/^[|:]$/][expressions.1.property.name=/([dD]ate|typeId)$/], TemplateLiteral[quasis.length=3][quasis.0.value.raw=''][quasis.1.value.raw=/^[|:]$/][expressions.1.left.property.name='typeId']",
          message: 'Utiliser occurrenceKey(id, date) / readOccurrenceKey(key) ou foreignSlotKind(workspaceId, typeId) (@ordo/shared) : un seul format de clé.',
        },
        {
          selector: "VariableDeclarator[id.elements.0.name=/^(title|label|name)Draft$/]",
          message: 'Utiliser openLabelForm(titre, { … }) (components/dialogs/open-label-form) : renommer dans le panneau latéral (décision CK).',
        },
        {
          selector: "TemplateLiteral[quasis.0.value.raw=/^(Redimensionner la colonne|Total de|Sélectionner|la répartition de) $/]",
          message: 'Nommer l’élément entre guillemets dans un libellé caché : « Total de « X » ».',
        },
        {
          selector: "Literal[value=/^\\/?(projects|clients)\\/:id$/]",
          message: 'Utiliser PROJECT_ROUTE / CLIENT_ROUTE (app/pages).',
        },
        {
          selector: "JSXOpeningElement[name.name='Overlay'] > JSXAttribute[name.name=/^(color|backgroundOpacity)$/]",
          message: 'Voile tiré des tokens : --onoko-overlay-color (styles/tokens.css), pas de couleur ni d’opacité en dur (décision CL).',
        },
        {
          selector: "JSXElement[openingElement.name.name='Text']:has(> JSXExpressionContainer CallExpression[callee.name='commentTotal']), ObjectExpression:has(> Property[key.name='label'][value.value='Commentaires']) > Property[key.name='id'] > Literal.value[value='comments']",
          message: 'Utiliser commentColumn(counts, idOf, descriptionOf) et CommentCount (features/comments) : la colonne commentaires avec son icône (décision CJ).',
        },
        {
          selector: "CallExpression[callee.property.name='padStart'][arguments.0.value=2][arguments.1.value='0']",
          message: 'Utiliser twoDigits(value) (@ordo/shared).',
        },
        // Round 8, lot 3: the holes of the rules above.
        {
          // « 3 tâches » written by hand; a phrase of its own for one (« Tous les jours ») is left alone.
          selector: `:matches(${COUNT_THEN(PLURAL_NOUN)}):not(ConditionalExpression:matches([test.right.value=1], [test.right.value=2]) > TemplateLiteral), JSXExpressionContainer${COUNT_EXPRESSION('expression')} + JSXText[value=${PLURAL_NOUN.replace('/^ ', '/^\\s+')}]`,
          message: 'Utiliser countOf(count, mot) (lib/text) : « 1 tâche », « 3 tâches ».',
        },
        {
          selector: `${COUNT_THEN("' '")}:has(> CallExpression[callee.name='plural']), JSXExpressionContainer${COUNT_EXPRESSION('expression')}:not(JSXText[value=/(\\/|sur)\\s*$/] + JSXExpressionContainer) + JSXText[value=/^\\s+$/] + JSXExpressionContainer[expression.callee.name='plural']`,
          // « 3 / 5 faits », « 2 sur 5 achetés »: the agreement follows the other count.
          message: 'Utiliser countOf(count, mot) (lib/text) au lieu de « ${count} ${plural(count, mot)} ».',
        },
        {
          // Decisions AB, BE, CN: the look of a button comes from its priority, the target of a menu or a popover included (`after`); an icon and a label make an ActionButton.
          selector:
            "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='variant'], JSXOpeningElement[name.name='Button']:not(:has(> JSXAttribute[name.name='variant'])) > JSXAttribute[name.name='leftSection']",
          message:
            'Utiliser ActionButton (components/actions/ActionButton) : primary (plein) pour ajouter, valider ou envoyer, secondary (clair) pour le reste, tertiary (discret, xs, danger en rouge) ; after pour un compte ou un caret (décision CN) ; AddItemButton pour ajouter une ligne.',
        },
        {
          // Decision CN: a toggle is not a button.
          selector: "JSXAttribute[name.name='aria-pressed'], JSXOpeningElement[name.name='Switch']:has(> JSXAttribute[name.name='aria-label']):not(:has(> JSXAttribute[name.name='label']))",
          message: 'Utiliser StateSwitch (components/inputs/StateSwitch) : une bascule est un interrupteur (Switch), un choix de mode un SegmentedControl (décision CN).',
        },
        {
          // Decision AE.
          selector: 'Literal[value=/^(Réduire|Développer)\\b/], TemplateElement[value.raw=/^(Réduire|Développer)\\b/], JSXText[value=/^\\s*(Réduire|Développer)\\b/]',
          message: 'Utiliser foldAction(expanded) / foldLabel(expanded, about) (components/actions/fold-label), ou about de FoldButton / FoldHeading : « Développer / Réduire » (décision AE).',
        },
        {
          selector: "JSXElement[openingElement.name.name=/^(Button|UnstyledButton|ActionButton|Anchor)$/] JSXOpeningElement[name.name='FoldChevron'], JSXOpeningElement[name.name=/^(Button|UnstyledButton|ActionButton|Anchor)$/] JSXOpeningElement[name.name='FoldChevron']",
          message: 'Utiliser FoldHeading (une ligne qui plie) ou FoldButton (un bouton icône) (components/actions) : un seul bouton de pliage (décisions AE, CH).',
        },
        {
          // Decision BF: the name of a menu given as an object, or quoted twice.
          selector:
            "JSXAttribute[name.name='menu'] > JSXExpressionContainer > ObjectExpression > Property[key.name='name'] :matches(Literal[value=/^(la|le|les|ce|ces|cet|cette|mon|du|des) /], Literal[value=/^l’/], TemplateElement[value.raw=/^(la|le|les|ce|ces|mon|du|des) /], TemplateElement[value.raw=/^l’/]), JSXOpeningElement[name.name=/^(ActionsMenu|RowActions|InlineActions|DetailHeader|SortableTabs)$/] > JSXAttribute[name.name='name'] :matches(Literal[value=/«/], TemplateElement[value.raw=/«/]), JSXAttribute[name.name='menu'] > JSXExpressionContainer > ObjectExpression > Property[key.name='name'] :matches(Literal[value=/«/], TemplateElement[value.raw=/«/])",
          message: 'Un nom sans guillemets dans name (ActionsMenu les ajoute : « Actions de « X » »), une description dans about : ActionsSubject (components/actions/actions-subject).',
        },
        {
          // The archived taken out by a helper of its own instead of `.filter`.
          selector:
            "CallExpression:not([callee.property.name=/^(filter|find|some|every|findIndex|findLast)$/]) > ArrowFunctionExpression.arguments[params.length=1] > UnaryExpression.body[operator='!'] > MemberExpression.argument[object.type='Identifier'][property.name='archived']",
          message: 'Utiliser unarchived(items, keep) (lib/archive), puis filter / find / some : les archivés retirés, la valeur en cours gardée.',
        },
        {
          // A count alone, whatever the line breaks around it; a badge with an icon (alarms, reminders) apart.
          selector: `JSXElement[openingElement.name.name='Badge']:not(:has(> JSXText[value=/\\S/])):not(:has(JSXAttribute[name.name='leftSection'])) > JSXExpressionContainer${COUNT_EXPRESSION('expression')}`,
          message: 'Utiliser CountBadge (components/feedback/CountBadge) : un compte seul, la même pastille partout (décision CI).',
        },
        {
          // Decision W: an element named in a hidden label is quoted (IconAction quotes its `item` itself).
          selector: [0, 1, 2, 3]
            .map(
              (index) =>
                `JSXOpeningElement:not([name.name='IconAction']) > JSXAttribute[name.name='aria-label'] > JSXExpressionContainer > TemplateLiteral[quasis.${index}.value.raw=/([^«]|^) $/][expressions.${index}.type='MemberExpression'][expressions.${index}.property.name=/^(label|name|title|subject|number)$/]`,
            )
            .join(', '),
          message: 'Nommer l’élément entre guillemets dans un libellé caché : « Supprimer « X » » (décision W), ou item d’IconAction.',
        },
        {
          selector: 'TemplateElement[value.raw=/\\/:id$/], TemplateElement[value.raw=/^\\/:id/]',
          message: 'Utiliser PROJECT_ROUTE / CLIENT_ROUTE ou routeOf(path, « :id ») (app/pages).',
        },
        {
          selector: "TemplateLiteral:has(> TemplateElement[value.raw='|'])",
          message: 'Utiliser joinedKey(a, b, …) (@ordo/shared), occurrenceKey(id, date), routineLinkKey ou sprintTaskKey : un seul format de clé.',
        },
        {
          selector:
            "CallExpression[callee.object.name='Object'][callee.property.name='fromEntries'] > CallExpression.arguments[callee.property.name='map'][callee.object.name='columns'], CallExpression[callee.object.name='Object'][callee.property.name='fromEntries'] > CallExpression.arguments[callee.property.name='map'] > MemberExpression.callee > CallExpression.object[callee.property.name='filter']:matches([callee.object.name='columns'], [callee.object.property.name='columns'])",
          message: 'Utiliser readOnlyCells(columns, row) (components/data-table/table/data-table) : le texte de chaque colonne, la cellule d’une colonne commune.',
        },
        {
          selector: "BinaryExpression[operator='<'][left.property.name='deadline'], BinaryExpression[operator='<'][left.name='deadline']",
          message: 'Utiliser isTaskOverdue(task, today) (features/tasks/lib/task-overdue) : une seule règle de retard (décision DD).',
        },
        {
          selector: "Literal[value=/^Réglée?$/]",
          message: 'Utiliser DocumentBalanceBadge (features/accounting/components) : « Reste … » ou « Réglé », le même partout.',
        },
        {
          selector: "BinaryExpression[right.value='UNAUTHENTICATED']",
          message: 'Une session expirée est silencieuse dans notifyFailure (lib/notify) : ne pas la tester à part.',
        },
        {
          selector: "CallExpression[callee.property.name='startsWith'][arguments.0.value=/^(la|le|l’) ?$/]",
          message: 'Ne pas deviner le genre d’un nom par son article : le dire (prop feminine de SettingsList).',
        },
        {
          selector: "CallExpression[callee.property.name='setValues'] CallExpression[callee.name='rowPeopleOf']",
          message: 'Utiliser PeopleField (features/shopping/components) : les bénéficiaires d’un formulaire, leur erreur sous le champ.',
        },
        // Round 9, lot 2 bricks.
        {
          selector: "ConditionalExpression[test.type='BinaryExpression'][test.operator=/^[<>]=?$/][test.right.value=0]:matches([consequent.value='IN'][alternate.value='OUT'], [consequent.value='OUT'][alternate.value='IN'])",
          message: 'Utiliser directionOf(amount) (@ordo/shared) : entrée au-dessus de 0, sortie sinon (0 compris), comme l’API.',
        },
        {
          selector: "TemplateLiteral > ConditionalExpression.expressions[consequent.value='+'][alternate.value='']",
          message: 'Utiliser signedText(value, format ?) (components/money/signed-text) ou SignedAmount.',
        },
        {
          selector: "ConditionalExpression[test.callee.property.name='includes'][consequent.callee.property.name='filter'][alternate.type='ArrayExpression']",
          message: 'Utiliser toggledInList(list, value) (lib/sets).',
        },
        {
          selector: "CallExpression[callee.property.name='split'][arguments.0.value=':'], CallExpression[callee.property.name='startsWith'][arguments.0.value=/^[a-z]+:$/]",
          message: 'Utiliser parseTaggedKey(key) / taggedIds(keys, tag) (lib/tagged-key) : « <kind>:<id> ».',
        },
        {
          // `client:${id}`, `${link.kind}:${link.id}`: a key of a list mixing kinds (a link, `mailto:`, apart; keys of 3 parts or more are not tagged keys).
          selector:
            "TemplateLiteral[quasis.length=2][quasis.0.value.raw=/^[a-z][a-z-]*:$/][quasis.1.value.raw='']:not([quasis.0.value.raw=/^(mailto|tel|https?):$/]), TemplateLiteral[quasis.length=3][quasis.0.value.raw=''][quasis.1.value.raw=':'][quasis.2.value.raw=''][expressions.0.property.name=/^(kind|tag|source)$/]",
          message: 'Utiliser taggedKey(tag, id) (lib/tagged-key) : « <kind>:<id> », lu par parseTaggedKey ; personKey pour les personnes.',
        },
        {
          selector: "TemplateLiteral[quasis.1.value.raw=':'][expressions.0.property.name='projectId'][expressions.1.property.name='number']",
          message: 'Utiliser taskNumberKey(projectId, number) ou referenceTargets(tasks) (components/markdown/remark-references).',
        },
        {
          selector: "ConditionalExpression:matches([test.name='feminine'], [test.property.name='feminine'])[consequent.value='e'][alternate.value='']",
          message: 'Utiliser agreed(word, feminine, count) (@ordo/shared) : le mot accordé.',
        },
        {
          selector: "CallExpression[callee.name='useLocalStorage'] Property[key.name='key']:matches([value.value=/collapsed|folded|openGroups/], [value.quasis.0.value.raw=/collapsed|folded|openGroups/])",
          message: 'Utiliser useFoldedIds(key) (components/tree/use-folded-ids) : les plis mémorisés dans ce navigateur.',
        },
        {
          selector: "Literal[value='Toute la journée'], TemplateElement[value.raw=/, (toute la journée|journée entière)$/]",
          message: 'Utiliser eventMomentText(moment) (features/calendar/lib/event-moment) ; l’interrupteur dit « Journée entière » (décision DE).',
        },
        {
          selector: "JSXOpeningElement[name.name='Indicator']:has(JSXAttribute[name.name='color'][value.value='orange'])",
          message: 'Utiliser UnsavedIndicator (components/data-table/views/UnsavedIndicator) : la pastille des modifications non enregistrées.',
        },
        {
          selector: "TemplateElement[value.raw=' de plus']",
          message: 'Utiliser StackedToggle (components/data-table/cells/StackedValues) : « X de plus » puis « Réduire ».',
        },
        {
          selector: "JSXAttribute[name.name='after'] JSXElement[openingElement.name.name='MenuCaret']",
          message: 'ActionButton met la flèche tout seul quand il ouvre un menu ou un panneau (décision DI).',
        },
        {
          selector: "ConditionalExpression[test.type=/^(Identifier|MemberExpression)$/][consequent.callee.name='String'][alternate.value='']",
          message: 'Utiliser fmt.count(value) (lib/format) : un compte, vide pour aucun (décision DH).',
        },
        {
          selector: "CallExpression[callee.name='plural'] > Literal[value='renumérotée']",
          message: 'Utiliser syncSummaryText(summary) (features/github/lib/sync-summary).',
        },
        {
          selector: "ObjectExpression > Property[value.callee.name='nextRing']",
          message: 'Utiliser nextRings(alarms, now) (features/alarms/lib/alarm-labels) : les prochaines sonneries, la plus proche d’abord.',
        },
        {
          selector: "JSXElement[openingElement.name.name='Badge'] > JSXExpressionContainer > Identifier[name='bought']",
          message: 'Utiliser ShoppingProgressBadge (features/shopping/components).',
        },
        {
          selector: "JSXElement[openingElement.name.name='DragOverlay'] JSXElement[openingElement.name.name='Paper']",
          message: 'Utiliser DragLabel (components/dnd/DragLabel) : ce qui suit le pointeur.',
        },
        {
          selector: "JSXOpeningElement[name.name=/^[a-z]/] > JSXAttribute[name.name='draggable'][value.type='JSXExpressionContainer']:not([value.expression.value=false])",
          message: 'Utiliser components/dnd (useDraggable, useDroppable, SortableArea) : pas de glisser-déposer natif (décision DM).',
        },
        {
          selector: "ArrowFunctionExpression > ObjectExpression:has(> Property[key.name='value'][value.property.name='id']):has(> Property[key.name='label'][value.property.name='label']):has(> Property[key.name='archived'])",
          message: 'Utiliser itemChoices(items) (components/items/item-look) : avec couleur et image, les archivés signalés.',
        },
        {
          selector: "ConditionalExpression[test.callee.property.name='has'] > ObjectExpression.consequent > Property[key.name='archived'][value.value=true]",
          message: 'Utiliser withArchived(options, items | archivés) (components/data-table/table/data-table).',
        },
        {
          selector: "JSXOpeningElement[name.name='IconAction']:has(> JSXAttribute[name.name='aria-expanded']) > JSXAttribute[name.name='variant'] ConditionalExpression",
          message: 'Utiliser IconAction expanded={ouvert} : clair et aria-expanded quand ce qu’il ouvre est ouvert.',
        },
        {
          selector: "VariableDeclarator[id.name=/^ME(_KEY)?$/][init.type='Literal']",
          message: 'Utiliser ME_KEY (components/people/people-keys) : la valeur de « Moi ».',
        },
        // Round 9, lot 3: holes of the rules.
        {
          selector: "JSXElement[openingElement.name.name=/^(Anchor|UnstyledButton|Button)$/] ~ JSXElement[openingElement.name.name='Collapse']",
          message: 'Utiliser FoldHeading (components/actions/FoldHeading) au-dessus d’un Collapse : toute la ligne cliquable, chevron, aria-expanded (décision CH).',
        },
        {
          selector: "JSXOpeningElement[name.name='Anchor'] > JSXAttribute[name.name='component'][value.value='button']",
          message: 'Utiliser ActionButton priority="tertiary" (components/actions) : un bouton texte discret (décision BE).',
        },
        {
          // One word each way (« créée » / « créé »): two different words are not one agreed.
          selector: "ConditionalExpression[consequent.value=/^[a-zàâçéèêëîïôûùüœ]+ées?$/][alternate.value=/^[a-zàâçéèêëîïôûùüœ]+és?$/]",
          message: 'Utiliser agreed(word, feminine, count) (@ordo/shared) : le participe accordé.',
        },
        {
          selector: "JSXOpeningElement[name.name=/^(Select|CreatableSelect|EditableSelect)$/]:not(:has(> JSXAttribute[name.name='leftSection'])) > JSXSpreadAttribute > CallExpression.argument[callee.name='listSelectProps']",
          message: 'Utiliser itemSelectProps(items, value, label ?, keep ?) (components/items/item-look) : une sélection simple montre l’avatar du choix.',
        },
        {
          selector: "CallExpression > ArrowFunctionExpression.callee:has(JSXOpeningElement[name.name='ItemAvatar'])",
          message: 'Utiliser chosenAvatar(items, value) ou itemSelectProps (components/items/item-look).',
        },
        {
          selector: "JSXAttribute[name.name='decimalSeparator'], Property[key.name='decimalSeparator']",
          message: 'Utiliser {...FRENCH_NUMBER_FORMAT} (components/inputs/number-format) : virgule et espace des milliers.',
        },
        {
          selector: "CallExpression[callee.name='confirmDestructive'] Property[key.name='onConfirm'] CallExpression[callee.name='formCallbacks'][arguments.0.type='Literal'][arguments.0.value=null]",
          message: 'Utiliser run: () => mutation.mutateAsync(…) et done: « X supprimé. » de confirmDestructive (components/dialogs/confirm-destructive).',
        },
        {
          // Decision W, a bare name: « Totaux de « X » ».
          selector: [0, 1, 2, 3]
            .map(
              (index) =>
                `JSXOpeningElement:not([name.name='IconAction']) > JSXAttribute[name.name='aria-label'] > JSXExpressionContainer > TemplateLiteral[quasis.${index}.value.raw=/([^«,]|^) $/][expressions.${index}.type='Identifier'][expressions.${index}.name=/^(label|title|itemLabel)$/]`,
            )
            .join(', '),
          message: 'Nommer l’élément entre guillemets dans un libellé caché : « Supprimer « X » » (décision W), ou item d’IconAction.',
        },
        {
          selector:
            "ConditionalExpression:matches([consequent.elements.length=2][consequent.elements.0.type='SpreadElement'][alternate.callee.property.name='filter'], [alternate.elements.length=2][alternate.elements.0.type='SpreadElement'][consequent.callee.property.name='filter'])",
          message: 'Utiliser toggledInList(list, value, on ?) (lib/sets) : la valeur ajoutée ou retirée.',
        },
        {
          selector:
            "LogicalExpression:matches([left.name=/^(late|overdue|isLate|isOverdue)$/], [left.property.name=/^(late|overdue)$/], [left.callee.name=/^is\\w*(Overdue|Late)$/]) JSXAttribute[name.name=/^(color|c)$/][value.value='red'], ConditionalExpression[test.callee.name=/^is\\w*(Overdue|Late)$/] > Literal[value='red']",
          message: 'Utiliser LATE_COLOR (components/feedback/feedback-colors) : un retard en orange (décisions AI, CF, DC).',
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
    // operatorsFor reads the operators of each kind.
    files: ['src/components/filters/filter-meta.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS.filter((path) => !path.importNames.includes('FILTER_OPERATORS')), patterns: [NO_FEATURES] }] },
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
