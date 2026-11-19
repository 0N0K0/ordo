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
  {
    selector: "ConditionalExpression[test.type='BinaryExpression'][test.operator=/^[<>]=?$/][test.right.value=0]:matches([consequent.value='IN'][alternate.value='OUT'], [consequent.value='OUT'][alternate.value='IN'])",
    message: 'Utiliser directionOf(amount) (@ordo/shared) : entrée au-dessus de 0, sortie sinon (0 compris).',
  },
  {
    selector: "CallExpression[callee.name='Number'] > CallExpression.arguments[callee.property.name='slice'][arguments.0.value=8]",
    message: 'Utiliser dayOfMonthOf(day) (@ordo/shared).',
  },
  // Same name: case and accents aside, as the search.
  {
    selector: 'BinaryExpression[operator=/^[!=]==$/][left.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/][right.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/]',
    message: 'Utiliser sameName(a, b) (@ordo/shared) : casse et accents ignorés, comme la recherche.',
  },
  {
    // One side folded, the other given as is (or folded beforehand): the same comparison, written once.
    selector:
      "BinaryExpression[operator=/^[!=]==$/][left.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/][right.type!='Literal']:not([right.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/]), BinaryExpression[operator=/^[!=]==$/][right.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/][left.type!='Literal']:not([left.callee.property.name=/^(toLocaleLowerCase|toLowerCase)$/])",
    message: 'Utiliser sameName(a, b) (@ordo/shared) : casse et accents ignorés des deux côtés, comme la recherche.',
  },
  {
    selector:
      "BinaryExpression[operator=/^[!=]==$/][left.type='CallExpression'][right.type='CallExpression']:matches([left.callee.name=/^(normalize|fold\\w*)$/], [left.callee.object.callee.name='normalize'])",
    message: 'Utiliser sameName(a, b) (@ordo/shared) : pas de repli de noms recopié.',
  },
  {
    // normalize(name.trim()): the key of a name (inner spaces too, decision CB).
    selector: "CallExpression[callee.name='normalize'] > CallExpression.arguments[callee.property.name='trim']",
    message: 'Utiliser nameKey(name) / sameName(a, b) (@ordo/shared) : espaces, casse et accents ignorés, une seule règle.',
  },
  {
    selector: "CallExpression[callee.property.name='trim'][callee.object.callee.name='normalize']",
    message: 'Utiliser sameName(a, b) (@ordo/shared) : pas de repli de noms recopié.',
  },
  {
    selector: "CallExpression[callee.property.name='padStart'][arguments.0.value=2][arguments.1.value='0']",
    message: 'Utiliser twoDigits(value) (@ordo/shared).',
  },
  // Documents and keys (round 8).
  {
    selector: "Literal[value=/^\\(?[Bb]rouillon\\)?$/], TemplateElement[value.raw=/\\(brouillon\\)/]",
    message: 'Utiliser DRAFT_NAME, documentName(number) ou documentTitle(document) (@ordo/shared) : « Brouillon » (décision CD).',
  },
  {
    selector: "TemplateLiteral:has(> MemberExpression[object.name='DOCUMENT_TYPE_LABELS']):has(> MemberExpression[property.name='number'])",
    message: 'Utiliser documentTitle(document) (@ordo/shared).',
  },
  {
    selector: "TemplateLiteral[quasis.length=3][quasis.0.value.raw=''][quasis.1.value.raw=/^[|:]$/][expressions.1.property.name=/([dD]ate|typeId)$/], TemplateLiteral[quasis.length=3][quasis.0.value.raw=''][quasis.1.value.raw=/^[|:]$/][expressions.1.left.property.name='typeId']",
    message: 'Utiliser occurrenceKey(id, date) ou foreignSlotKind(workspaceId, typeId) (@ordo/shared) : un seul format de clé.',
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
  // A person's name: one schema, one maximum (decision BB).
  {
    selector: "CallExpression[callee.name='requiredText'][arguments.1.name='PERSON_NAME_REQUIRED']",
    message: 'Utiliser personNameSchema (@ordo/shared) : 100 caractères au plus pour tout nom de personne.',
  },
  // Files: the same messages and fallback name in the web and the API.
  {
    selector: 'Literal[value=/Mo maximum/], TemplateElement[value.raw=/Mo maximum/]',
    message: 'Utiliser fileTooLarge(nom) ou ICON_ERRORS (@ordo/shared) : le même message dans le web et l’API.',
  },
  {
    selector:
      "BinaryExpression[operator='*'][right.value=1024][left.operator='*'][left.right.value=1024][left.left.value=10], BinaryExpression[operator='*'][left.value=10][right.operator='*'][right.left.value=1024][right.right.value=1024]",
    message: 'Utiliser MAX_ATTACHMENT_BYTES (@ordo/shared) : 10 Mo au plus pour une pièce jointe, dans le web et l’API.',
  },
  {
    selector: 'Literal[value=/^(piece-jointe|fichier|sans-nom)$/], TemplateElement[value.raw=/^piece-jointe/]',
    message: 'Utiliser UNNAMED_FILE (@ordo/shared) : un seul nom de repli pour un fichier.',
  },
  // Documents, mail, handles, days: one constant or helper each.
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
  {
    selector: "TemplateLiteral:has(> TemplateElement[value.raw='|'])",
    message: 'Utiliser joinedKey(a, b, …) ou occurrenceKey(id, date) (@ordo/shared) : un seul format de clé.',
  },
  {
    selector: "TSUnionType:has(TSLiteralType > Literal[value='correspondent'])",
    message: 'Utiliser MailSortBy / MailSearchSortBy (@ordo/shared).',
  },
  {
    selector: 'Literal[value=39]',
    message: 'Utiliser HANDLE_MAX (@ordo/shared).',
  },
  {
    selector: "Literal[value='sv-SE']",
    message: 'Utiliser dayIn(instant, fuseau) (@ordo/shared) : le jour d’un instant dans un fuseau.',
  },
  {
    selector: "CallExpression[callee.property.name='toLocaleLowerCase'][arguments.0.value='fr']",
    message: 'Utiliser normalize (@ordo/shared) : casse et accents ignorés, comme sameName.',
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
    // A text cut without telling: refused by its schema instead.
    selector:
      'CallExpression[callee.property.name=/^(slice|substring|substr)$/][callee.object.callee.property.name=/^trim(End|Start)?$/], CallExpression[callee.property.name=/^trim(End)?$/][callee.object.callee.property.name=/^(slice|substring|substr)$/][callee.object.arguments.0.value=0]',
    message: 'Refuser un texte trop long par son schéma zod (parseInput dans l’API) au lieu de le couper sans prévenir, ou clipText(text, max) (@ordo/shared) pour un nom venu d’ailleurs.',
  },
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
    // for (let current = …; current; current = current.parentId ? byId.get(current.parentId) : undefined)
    selector: "ForStatement > AssignmentExpression.update:has(MemberExpression[property.name='parentId']), WhileStatement AssignmentExpression:has(> MemberExpression.right[property.name='parentId'])",
    message: 'Utiliser lineageOf(byId, id) / ancestorsOf(byId, id) / pathOf (@ordo/shared) : les parents, cycles arrêtés.',
  },
  {
    selector: "CallExpression[callee.property.name='join'][arguments.0.value=' › ']",
    message: 'Utiliser pathOf(byId, id, label) ou LEVEL (@ordo/shared) : un seul chemin « Maison › Cuisine ».',
  },
  {
    selector: "ObjectExpression[properties.length=2]:has(> Property[key.name='label'][value.name='labelTextSchema']):has(> Property[key.name='color'][value.name='colorSchema'])",
    message: 'Utiliser labelFormSchema (@ordo/shared) : un libellé et une couleur.',
  },
];
