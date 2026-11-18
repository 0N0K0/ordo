import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { SHARED_SYNTAX_RULES } from '../../packages/shared/eslint-rules.js';

// Patterns of the bricks of the API (services/core, graphql, routes/http).
const API_SYNTAX_RULES = [
  {
    // An uploaded file stored without the checks (empty, 10 MB): with the client, a transaction or a nested write.
    selector:
      "CallExpression[callee.object.property.name='attachment'][callee.property.name=/^(create|createMany|upsert)$/], Property[key.name=/^attachments?$/] > ObjectExpression > Property[key.name=/^(create|createMany)$/]",
    message: 'Utiliser storeAttachment(file, owner) (services/core/attachments) : fichier vide refusé, 10 Mo au plus.',
  },
  {
    // « Ce projet est archivé. », « Cette tâche est archivée. »: one message everywhere (decision BC).
    selector: 'Literal[value=/est archivée?/], TemplateElement[value.raw=/est archivée?/]',
    message: 'Utiliser assertNotArchived(kind, id, { keep, field }) ou ARCHIVED_MESSAGE (services/core/archive) : un seul message, sous le champ.',
  },
  {
    // const x = await prisma.y.findUnique(…); if (!x) throw notFound(…) (or the error of a field).
    selector:
      "VariableDeclaration:has(AwaitExpression > CallExpression[callee.property.name=/^find(Unique|First)$/]) + IfStatement[test.operator='!'][test.argument.type='Identifier']:matches([consequent.argument.callee.name=/^(notFound|fieldError)$/], [consequent.body.0.argument.callee.name=/^(notFound|fieldError)$/])",
    message: 'Utiliser orNotFound(prisma.x.findUnique(…), « Élément », champ ?) (graphql/errors) : « Élément introuvable. », sous le champ quand il y en a un.',
  },
  {
    selector: "CallExpression[callee.name='clientError'][arguments.0.value='NOT_FOUND']",
    message: 'Utiliser notFound(« Élément ») ou orNotFound(requête, « Élément ») (graphql/errors) : « Élément introuvable. ».',
  },
  {
    // A manual order written by hand (decision BA: position, then label).
    selector: "Property[key.name='position'][value.value='asc']",
    message: 'Utiliser BY_POSITION (position puis libellé), BY_POSITION_NAME (personnes) ou BY_POSITION_ONLY (services/core/ordering).',
  },
  {
    selector: "CallExpression[callee.property.name='toNumber'][arguments.length=0]",
    message: 'Utiliser fromDecimal(value) (services/core/decimal).',
  },
  {
    // (prisma as Record<string, unknown>)[model], (tx as any)[model]: the delegate of a model by its name.
    selector: 'MemberExpression[computed=true] > TSAsExpression.object[expression.name=/^(prisma|tx|client|db|transaction)$/]',
    message: 'Utiliser modelDelegate<D>(model, client) (services/core/delegate) : le seul forçage de type du délégué d’un modèle.',
  },
  {
    selector: "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword'] > TSTypeReference.typeAnnotation[typeName.name='Record']",
    message: 'Utiliser modelDelegate<D>(model, client) (services/core/delegate).',
  },
  {
    selector: "Literal[value='private, max-age=31536000, immutable']",
    message: 'Utiliser IMMUTABLE_CACHE (routes/http).',
  },
  {
    selector: "UnaryExpression[operator='!'] > CallExpression.argument[callee.name='queryFlag'][arguments.0.property.name='download']",
    message: 'Utiliser shownInPlace(req, viewable) (routes/http).',
  },
  {
    selector: "Literal[value='Archived: hidden by default, read only.']",
    message: 'Utiliser ARCHIVED_DESCRIPTION (graphql/label-inputs).',
  },
  {
    selector: "Property[key.name=/^(location|travelBefore)$/] > LogicalExpression.value[operator='??'][left.object.name='input'][left.property.name=/^(location|travelBefore)$/]",
    message: 'Utiliser locatedInput(input) / locatedChanges(input) (graphql/located-fields).',
  },
  {
    selector: 'Literal[value=/^(Minutes to get|Travel time (to|back from) the event)/]',
    message: 'Utiliser TRAVEL_DESCRIPTIONS / travelInputFields (graphql/located-fields).',
  },
  // Files (services/core/attachments, pdf-report).
  {
    selector: "Literal[value='WEBP'], Literal[value='GIF89a']",
    message: 'Utiliser imageKind(buffer) / sniffImage(buffer) (services/core/attachments).',
  },
  {
    selector: "ConditionalExpression[test.right.value='LINK']:has(CallExpression[callee.name='attachmentUrl'])",
    message: 'Utiliser resourceUrl(resource) (services/core/attachments).',
  },
  {
    selector: "TSTypeReference[typeName.name='InstanceType'] TSTypeQuery[exprName.name='PDFDocument'], TSQualifiedName[left.name='PDFKit'][right.name='PDFDocument']",
    message: 'Utiliser PdfDoc (services/core/pdf-report).',
  },
  {
    selector: "VariableDeclarator[id.name='MARGIN'][init.name='REPORT_MARGIN'], VariableDeclarator[id.name='COLORS'][init.name='PDF_TEXT']",
    message: 'Utiliser REPORT_MARGIN / PDF_TEXT (services/core/pdf-report) directement.',
  },
  // Mail (services/mail/imap).
  {
    selector:
      "BinaryExpression[operator=/^[!=]==$/]:matches([right.value='INBOX'], [left.value='INBOX'], [right.name='INBOX'][left.callee.property.name=/^to(Upper|Lower)Case$/], [left.name='INBOX'][right.callee.property.name=/^to(Upper|Lower)Case$/]), BinaryExpression[operator=/^[!=]==$/][right.value='inbox'][left.callee.property.name='toLowerCase']",
    message: 'Utiliser isInbox(path) (services/mail/imap).',
  },
  {
    selector: "Literal[value='Réception']",
    message: 'Utiliser folderLabel(folder) (services/mail/imap).',
  },
  {
    selector: "Literal[value='\\\\Noselect']",
    message: 'Utiliser isSelectable(folder) / selectableFolders(folders) (services/mail/imap).',
  },
  // Validation (graphql/errors) and stored JSON.
  {
    selector:
      "CallExpression[callee.name='parseInput'][arguments.0.callee.object.name='z'][arguments.0.callee.property.name='object'][arguments.0.arguments.0.properties.length=1][arguments.1.type='ObjectExpression'][arguments.1.properties.length=1][arguments.1.properties.0.computed=false]",
    message: 'Utiliser parseField(champ, schéma, valeur) (graphql/errors).',
  },
  {
    selector: "TSAsExpression TSTypeReference[typeName.name='CalendarLink']",
    message: 'Utiliser readEventLinks(links) (services/calendar/calendar-events).',
  },
  {
    selector: "TSAsExpression[expression.type='TSAsExpression'][expression.expression.type='ArrayExpression']",
    message: 'Utiliser modelDelegate<D>(model, client) (services/core/delegate) sur des noms de modèles.',
  },
];

// Patterns of the fixtures' helpers (prisma/fixtures/factories).
const FIXTURE_SYNTAX_RULES = [
  {
    selector: "NewExpression[callee.name='Date'] > TemplateLiteral.arguments:has(CallExpression[callee.property.name='padStart'])",
    message: 'Utiliser localAt(day, hour, minute) (fixtures/factories).',
  },
  {
    selector: "ArrowFunctionExpression[params.length=1] > ObjectExpression.body:has(> SpreadElement[argument.name='DEFAULT_RECURRENCE'])",
    message: 'Utiliser rule(changes) (fixtures/factories).',
  },
  {
    selector: "VariableDeclarator[id.name='day'] > ArrowFunctionExpression.init[body.callee.name='addDays']",
    message: 'Utiliser relativeDay(today) (fixtures/factories).',
  },
  {
    selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat'] ~ Identifier[name='resolvedOptions'], CallExpression[callee.property.name='resolvedOptions']",
    message: 'Utiliser TIME_ZONE (fixtures/factories).',
  },
  {
    selector: 'VariableDeclarator[id.name=/^(chart|createEntry|pdf)$/] > ArrowFunctionExpression.init',
    message: 'Utiliser chart / createEntry (fixtures/factories) ou pdfFile (fixtures/mail).',
  },
  {
    selector: "ObjectExpression:has(> Property[key.name='libraryDocumentIds'][value.type='ArrayExpression'][value.elements.length=0]):has(> Property[key.name='linkedEntryIds'])",
    message: 'Utiliser ...EMPTY_ENTRY (fixtures/factories).',
  },
  {
    selector: "ObjectExpression:has(> Property[key.name='unitPrice'][value.value=null]):has(> Property[key.name='quantity'][value.value=null])",
    message: 'Utiliser ...EMPTY_ARTICLE (fixtures/factories).',
  },
];

export default defineConfig([
  globalIgnores(['dist', 'src/generated', 'prisma/migrations']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-syntax': ['error', ...SHARED_SYNTAX_RULES, ...API_SYNTAX_RULES],
      // Fields left out of a copy are named with a leading underscore.
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['prisma/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...SHARED_SYNTAX_RULES, ...API_SYNTAX_RULES, ...FIXTURE_SYNTAX_RULES] },
  },
  {
    // The documents library, to be rewritten entirely: not brought in line.
    files: ['src/services/library/**', 'src/routes/library.ts', 'src/graphql/modules/library.ts', 'prisma/fixtures/library.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
