// Guards of the shared bricks for the code that is not the web app (packages/shared, apps/api): each pattern below
// has a brick in @ordo/shared or in the API; the message names it. The web has its own list (apps/web/eslint.config.js).

/** Patterns of @ordo/shared, for the shared code and the API. */
export const SHARED_SYNTAX_RULES = [
  // Dates, numbers and amounts: one format per role.
  {
    selector: "NewExpression[callee.object.name='Intl'][callee.property.name=/^(DateTimeFormat|NumberFormat|RelativeTimeFormat)$/][arguments.length>0]",
    message: 'Utiliser les formats partagés (@ordo/shared : formatMoney, formatNumber, printedDay, dateStyle) : un format par rôle.',
  },
  {
    selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
    message: 'Utiliser les formats partagés (@ordo/shared : formatMoney, formatNumber, dateStyle) : un format par rôle.',
  },
  // Same name: case and accents aside, as the search.
  {
    selector: 'BinaryExpression[operator=/^[!=]==$/][left.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/][right.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/]',
    message: 'Utiliser sameName(a, b) (@ordo/shared) : casse et accents ignorés, comme la recherche.',
  },
  {
    selector:
      "BinaryExpression[operator=/^[!=]==$/][left.type='CallExpression'][right.type='CallExpression']:matches([left.callee.name=/^(normalize|fold\\w*)$/], [left.callee.object.callee.name='normalize'])",
    message: 'Utiliser sameName(a, b) (@ordo/shared) : pas de repli de noms recopié.',
  },
  {
    selector: "CallExpression[callee.property.name='trim'][callee.object.callee.name='normalize']",
    message: 'Utiliser sameName(a, b) (@ordo/shared) : pas de repli de noms recopié.',
  },
  // Shared constants: one value.
  {
    selector: 'Literal[value=/^#868e96$/i]',
    message: 'Utiliser DEFAULT_LABEL_COLOR (@ordo/shared).',
  },
  {
    selector: "Literal[value='La fin doit suivre le début.']",
    message: 'Utiliser END_AFTER_START / endAfter (@ordo/shared).',
  },
  {
    selector: "Literal[value=86400000], BinaryExpression[operator='*'][right.value=1000]:has(Literal[value=24])",
    message: 'Utiliser DAY_MS (@ordo/shared).',
  },
  // Plurals: one helper.
  {
    selector: 'Literal[value=/\\(s\\)/], TemplateElement[value.raw=/\\(s\\)/]',
    message: 'Pas de « (s) » : plural(count, mot) ou countOf(count, mot) (@ordo/shared).',
  },
  {
    selector: "ConditionalExpression[test.operator=/^(>|!==|!=)$/][test.right.value=1]:matches([consequent.value='s'], [consequent.value=/s$/][alternate.value=/[^s]$/])",
    message: 'Utiliser plural(count, mot) ou countOf(count, mot) (@ordo/shared).',
  },
  // Days, months and years of a date: one helper each.
  {
    selector: "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=10][callee.object.callee.property.name='toISOString']",
    message: 'Utiliser formatDay(date) (@ordo/shared) : le jour d’une date à minuit UTC.',
  },
  {
    selector: "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=0][arguments.1.value=10]:not([callee.object.callee.property.name='toISOString'])",
    message: 'Utiliser dayPart(value) (@ordo/shared) : le jour d’une date ISO telle qu’écrite.',
  },
  {
    selector: "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=0][arguments.1.value=7]",
    message: 'Utiliser monthOfDay(day) ou monthOfDate(date) (@ordo/shared).',
  },
  {
    selector:
      "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=4]:matches([callee.object.name=/(date|day|Date|Day|today|anchor|month|Month)$/], [callee.object.property.name=/(date|day|Date|Day|month|Month)$/])",
    message: 'Utiliser yearOfDay(day) (@ordo/shared).',
  },
  {
    selector: "CallExpression[callee.property.name='slice'][arguments.0.value=5][arguments.1.value=7]",
    message: 'Utiliser monthOfYear(day) (@ordo/shared).',
  },
  {
    selector: "CallExpression[callee.name='monthOfDay'] > CallExpression.arguments[callee.name='formatDay']",
    message: 'Utiliser monthOfDate(date) (@ordo/shared).',
  },
  {
    selector: "NewExpression[callee.name='Date'] TemplateElement[value.raw=/^T00:00/]",
    message: 'Utiliser parseDay(day) (@ordo/shared).',
  },
  {
    selector: "ConditionalExpression[alternate.value=null]:matches([consequent.callee.name='parseDay'], [alternate.type='Literal'][consequent.callee.name='parseDay'])",
    message: 'Utiliser parseOptionalDay(day) (@ordo/shared).',
  },
  {
    selector: "ConditionalExpression[alternate.value=null][consequent.callee.name='formatDay']",
    message: 'Utiliser formatOptionalDay(date) (@ordo/shared).',
  },
  // Texts cut to a maximum: one helper.
  {
    selector:
      "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=0][arguments.1.type=/^(Literal|Identifier)$/]:matches([callee.object.name=/^(label|name|title|text|description|subject)$/], [callee.object.property.name=/^(label|name|title|text|description|subject)$/])",
    message: 'Utiliser clipText(text, max) (@ordo/shared) : coupé proprement, sans espace au bout.',
  },
  // Collections.
  {
    selector:
      "CallExpression[callee.property.name='reduce'][arguments.length=2][arguments.1.value=0] > ArrowFunctionExpression.arguments:first-child[params.length=2] > BinaryExpression.body[operator='+']",
    message: 'Utiliser sumOf(items, valueOf) (@ordo/shared).',
  },
  {
    selector:
      "ArrayExpression[elements.length=3][elements.1.type!='SpreadElement'][elements.2.argument.arguments.0.type!='BinaryExpression'][elements.0.argument.callee.property.name='slice'][elements.0.argument.arguments.0.value=0][elements.2.argument.callee.property.name='slice'][elements.2.argument.arguments.length=1]",
    message: 'Utiliser movedTo(others, moved, index) (@ordo/shared).',
  },
  // Schemas: one source.
  {
    selector: "ObjectExpression[properties.length=2]:has(> Property[key.name='label'][value.name='labelTextSchema']):has(> Property[key.name='color'][value.name='colorSchema'])",
    message: 'Utiliser labelFormSchema (@ordo/shared) : un libellé et une couleur.',
  },
];
