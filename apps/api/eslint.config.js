import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { planReferencesConfig, SHARED_SYNTAX_RULES } from '../../packages/shared/eslint-rules.js';

// Patterns of the bricks of the API (services/core, graphql, routes/http).
const API_SYNTAX_RULES = [
  // A module loaded on the fly hides an import cycle: the shared part goes to a module both sides import.
  {
    selector: 'ImportExpression',
    message: 'Pas d’import dynamique : déplacer ce qui est partagé dans un module importé des deux côtés (ex. services/routines/routine-occurrences).',
  },
  // A value loaded once per GraphQL request.
  {
    selector: "NewExpression[callee.name='WeakMap'][typeArguments.params.0.typeName.name='Context']",
    message: 'Utiliser perRequest(load) (graphql/batch) : une valeur chargée une fois par requête, ou batchedBy(load) pour les lignes d’une requête.',
  },
  // Trees of tasks and routines.
  {
    selector: "CallExpression[callee.name='cascadeArchive'][arguments.0.value=/^(task|routine)$/]",
    message: 'Utiliser archiveTree(model, id, archived, « X ») (services/core/archive) : sous-éléments et parents archivés trouvés au même endroit.',
  },
  {
    selector: "CallExpression[callee.property.name='some'][callee.object.callee.name='ancestorsOf']",
    message: 'Utiliser topmostIds(model, ids) (services/core/trees) : les éléments du haut d’une sélection.',
  },
  {
    selector: "CallExpression[callee.property.name='at'][callee.object.callee.name='lineageOf']",
    message: 'Utiliser loadProjectRootOf() (services/projects/project-tree) : le projet racine, pour lier dans une même arborescence.',
  },
  {
    selector: "CallExpression[callee.name='movedTo']",
    message: 'Utiliser moveBefore (ordre global), moveInList ou saveSiblingOrder (services/core/ordering).',
  },
  {
    // a < b ? { aId: a, bId: b } : { aId: b, bId: a }: a symmetric link stored once.
    selector: "ConditionalExpression[test.operator='<'][consequent.type=/^(ObjectExpression|ArrayExpression)$/][alternate.type=/^(ObjectExpression|ArrayExpression)$/]",
    message: 'Utiliser orderedPair(a, b) (services/core/relations) : la paire d’un lien symétrique.',
  },
  {
    // An uploaded file stored without the checks (empty, 10 MB): with the client, a transaction or a nested write.
    selector:
      "CallExpression[callee.object.property.name='attachment'][callee.property.name=/^(create|createMany|upsert)$/], Property[key.name=/^attachments?$/] > ObjectExpression > Property[key.name=/^(create|createMany)$/]",
    message: 'Utiliser storeAttachment(file, owner) (services/core/attachments) : fichier vide refusé, 10 Mo au plus.',
  },
  {
    // A stored file deleted by hand: a missing one throws, a leftover fails the change it follows.
    selector: "CallExpression[callee.object.property.name='attachment'][callee.property.name=/^(delete|deleteMany)$/]",
    message: 'Utiliser deleteAttachment(id, leftover ?) (services/core/attachments) : un fichier déjà parti n’est pas une erreur, un reste n’échoue jamais le changement.',
  },
  {
    // « Ce projet est archivé. », « Cette tâche est archivée. »: one message everywhere.
    selector: 'Literal[value=/est archivée?/], TemplateElement[value.raw=/est archivée?/]',
    message:
      'Utiliser assertNotArchived(kind, id, { keep, field }) ou ARCHIVED_MESSAGE (services/core/archive) : un seul message, sous le champ ; refuseForeignArchived(record, quoi) pour un élément d’un autre espace (FOREIGN_ARCHIVED_MESSAGES).',
  },
  {
    // const x = await prisma.y.findUnique(…); if (!x) throw notFound(…) (or the error of a field).
    selector:
      "VariableDeclaration:has(AwaitExpression > CallExpression[callee.property.name=/^find(Unique|First)$/]) + IfStatement[test.operator='!'][test.argument.type='Identifier']:matches([consequent.argument.callee.name=/^(notFound|fieldError)$/], [consequent.body.0.argument.callee.name=/^(notFound|fieldError)$/])",
    message: 'Utiliser orNotFound(prisma.x.findUnique(…), « Élément », champ ?) (graphql/errors) : « Élément introuvable. », sous le champ quand il y en a un.',
  },
  {
    // orNotFound(prisma.x.findUnique({ where: { id } }), « X »): the whole record by its id.
    selector:
      "CallExpression[callee.name='orNotFound'][arguments.length=2] > CallExpression.arguments:first-child[callee.property.name='findUnique'] > ObjectExpression.arguments[properties.length=1] > Property[key.name='where'] > ObjectExpression.value[properties.length=1] > Property[key.name='id']",
    message: 'Utiliser findOrNotFound(prisma.x, id, « X ») (services/core/lookup).',
  },
  {
    // const x = await orNotFound(…); return x;
    selector: "VariableDeclaration[declarations.0.init.argument.callee.name=/^(orNotFound|findOrNotFound)$/] + ReturnStatement[argument.type='Identifier']",
    message: 'Renvoyer directement orNotFound(…) / findOrNotFound(…), sans variable.',
  },
  {
    // assertExists(…) then assertNotArchived(…): two queries for one check.
    selector:
      "ExpressionStatement[expression.argument.callee.name='assertExists'] + ExpressionStatement[expression.argument.callee.name='assertNotArchived'], ExpressionStatement[expression.argument.callee.name='orNotFound']:has(Property[key.name='select'] > ObjectExpression[properties.length=1] > Property[key.name='id']) + ExpressionStatement[expression.argument.callee.name='assertNotArchived']",
    message: 'Utiliser assertActive(prisma.x, id, « X », { keep, field, missingField }) (services/core/archive) : existe et non archivé, en une requête.',
  },
  {
    selector: "ExpressionStatement[expression.argument.callee.name='assertAllExist'] + ExpressionStatement[expression.argument.callee.name='assertNoneArchived']",
    message: 'Utiliser activeIds(prisma.x, ids, « X », { keep, field }) (services/core/archive) : existent et non archivés, en une requête.',
  },
  {
    // if (x.archivedAt) throw …: on a record already loaded.
    selector: "IfStatement[test.type='MemberExpression'][test.property.name='archivedAt']:matches([consequent.type='ThrowStatement'], [consequent.body.0.type='ThrowStatement'])",
    message: 'Utiliser refuseArchived(record, field ?) (services/core/archive) : « Élément archivé… », sous le champ quand il y en a un.',
  },
  {
    // The same test written otherwise: optional chaining, after another condition.
    selector:
      "IfStatement:matches([test.type='ChainExpression'][test.expression.property.name='archivedAt'], [test.operator='&&'][test.right.type='MemberExpression'][test.right.property.name='archivedAt']):matches([consequent.type='ThrowStatement'], [consequent.body.0.type='ThrowStatement'])",
    message: 'Utiliser refuseArchived(record, field ?) (services/core/archive) : « Élément archivé… », sous le champ quand il y en a un.',
  },
  {
    selector: "CallExpression[callee.name=/^(fieldError|clientError)$/] > Identifier.arguments[name='ARCHIVED_MESSAGE']",
    message: 'Utiliser archivedError(field ?), refuseArchived ou assertNotArchived (services/core/archive) : le même refus partout.',
  },
  {
    // const x = id ? await prisma.y.findUnique(…) : null; if (id && !x) throw notFound(…).
    selector:
      "IfStatement[test.operator='&&'][test.right.operator='!'][test.right.argument.type='Identifier']:matches([consequent.argument.callee.name=/^(notFound|fieldError)$/], [consequent.body.0.argument.callee.name=/^(notFound|fieldError)$/])",
    message: 'Utiliser orNotFound(prisma.x.findUnique(…), « Élément ») dans la branche qui cherche (graphql/errors) : « Élément introuvable. ».',
  },
  {
    // const x = await findX(id); await assertNotArchived(kind, id): the record already tells it.
    selector:
      "VariableDeclaration[declarations.0.init.argument.callee.name=/^(find[A-Z]\\w*|orNotFound|findOrNotFound)$/] + ExpressionStatement[expression.argument.callee.name='assertNotArchived'][expression.argument.arguments.1.type='Identifier']",
    message: 'Utiliser refuseArchived(record) (services/core/archive) sur l’élément déjà chargé.',
  },
  {
    selector: "IfStatement[test.type='BinaryExpression'][test.operator='==='][test.left.type='BinaryExpression'][test.left.left.property.name='archivedAt'] > ReturnStatement",
    message: 'Utiliser isArchivedAs(record, archived) (services/core/archive).',
  },
  {
    selector: "TSAsExpression > TSTypeReference.typeAnnotation[typeName.left.name='Prisma'][typeName.right.name=/^InputJson(Value|Object|Array)$/]",
    message: 'Utiliser toJson(value) (services/core/json) : le seul forçage de type des écritures JSON.',
  },
  {
    selector: "CallExpression[callee.name='clientError'][arguments.0.value='NOT_FOUND']",
    message: 'Utiliser notFound(« Élément ») ou orNotFound(requête, « Élément ») (graphql/errors) : « Élément introuvable. ».',
  },
  {
    // A manual order written by hand (position, then label).
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
    selector: "TSAsExpression TSTypeReference[typeName.name=/^(CalendarLink|ItemLink)$/]",
    message: 'Utiliser readLinks(links) (services/core/links).',
  },
  {
    selector: "TSAsExpression[expression.type='TSAsExpression'][expression.expression.type='ArrayExpression']",
    message: 'Utiliser modelDelegate<D>(model, client) (services/core/delegate) sur des noms de modèles.',
  },
  {
    // const x = await findOrNotFound(…); refuseArchived(x);
    selector: "VariableDeclaration[declarations.0.init.argument.callee.name='findOrNotFound'] + ExpressionStatement[expression.callee.name='refuseArchived'][expression.arguments.length=1]",
    message: 'Utiliser findActive(prisma.x, id, « X ») (services/core/archive) : introuvable ou archivé, en une aide.',
  },
  {
    selector: "CallExpression[callee.object.property.name='companyProfile']:has(Property[key.name='invoiceCategoryId'][value.value=true])",
    message: 'Utiliser invoiceCategories() (services/accounting/company).',
  },
  {
    selector: "CallExpression[callee.object.property.name='workspace'][callee.property.name=/^findUnique(OrThrow)?$/]:has(CallExpression[callee.name=/^currentWorkspace(Id)?$/])",
    message: 'Utiliser currentWorkspaceFields(select) (services/workspaces/current-workspace).',
  },
  {
    selector: "MemberExpression[object.callee.name='currentWorkspace'][property.name='id']",
    message: 'Utiliser currentWorkspaceId() (workspace-context).',
  },
  {
    selector: 'Literal[value=/^Ce moyen de paiement ne sert pas aux/]',
    message: 'Utiliser assertMethodFor(methodId, incoming) (services/treasury/treasury-settings).',
  },
  {
    selector: "Literal[value='Ce service n’appartient pas au client.']",
    message: 'Utiliser assertService(serviceId, clientId) (services/accounting/client-parties).',
  },
  {
    selector: "CallExpression[callee.name=/^(assertAllExist|activeIds|assertNoneArchived)$/] > Literal.arguments[value='Bénéficiaire']",
    message: 'Utiliser assertBeneficiaries({ contributorIds, relationIds }, { field, keep }) (services/core/beneficiaries).',
  },
  {
    selector: "LogicalExpression[operator='??'][left.callee.name='sniffImage']",
    message: 'Utiliser sniffedType(buffer) (services/core/attachments).',
  },
  {
    selector: "ObjectExpression:has(> Property[key.name='create'][value.name='LabelColorInput']):has(> Property[key.name='update'][value.name='LabelColorPatch'])",
    message: 'Omettre les entrées de labelMutations (LABEL_COLOR_INPUTS par défaut, graphql/label-inputs).',
  },
  {
    // await findOrNotFound(…); await prisma.x.delete(…): two queries for one deletion.
    selector:
      "ExpressionStatement[expression.argument.callee.name=/^(assertExists|findOrNotFound|orNotFound)$/] + ExpressionStatement[expression.argument.callee.property.name=/^(delete|deleteMany)$/]",
    message: 'Utiliser deleteOrNotFound(prisma.x, id, « X ») (services/core/lookup) : supprimé, ou « X introuvable. », en une requête.',
  },
  {
    // The saved record read again by hand for the answer of a mutation.
    selector:
      "CallExpression[callee.property.name='findUniqueOrThrow'] > ObjectExpression.arguments:has(> SpreadElement) > Property[key.name='where'] > ObjectExpression.value > Property[key.name='id'] > MemberExpression.value[object.type='AwaitExpression']",
    message: 'Utiliser reloaded(prisma.x, query, saving) (graphql/reload).',
  },
  {
    selector: "CallExpression[callee.name='fieldError'] > Literal.arguments:nth-child(2)[value=/introuvable\\.$/]",
    message: 'Utiliser notFound(« X », champ) (graphql/errors) : « X introuvable. » sous le champ.',
  },
  {
    // await assertNotArchived(kind, record.id): the record is already loaded (a value kept by `keep` apart).
    selector: "CallExpression[callee.name='assertNotArchived'][arguments.length=2] > MemberExpression.arguments:nth-child(2)[property.name='id'][object.type='Identifier']",
    message: 'Utiliser refuseArchived(record, field ?) (services/core/archive) sur l’élément déjà chargé.',
  },
  {
    selector: "CallExpression[callee.property.name='enumType'] > ObjectExpression.arguments > Property[key.name='values'] > :matches(ArrayExpression, TSAsExpression[expression.type='ArrayExpression'])",
    message: 'Exporter la liste du partagé (@ordo/shared, XXX_KINDS…) et l’utiliser dans values : une seule liste des valeurs.',
  },
  {
    selector: 'TSAsExpression > TSNeverKeyword.typeAnnotation',
    message: 'Utiliser unchecked(value) (graphql/unchecked) : le seul forçage de type d’une entrée GraphQL vers un service.',
  },
];

// Patterns of the fixtures' helpers (prisma/fixtures/factories).
const FIXTURE_SYNTAX_RULES = [
  {
    selector: "NewExpression[callee.name='Date'] > TemplateLiteral.arguments:has(CallExpression[callee.name='twoDigits'])",
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
  {
    selector: "CallExpression[callee.object.property.name='calendarCategory'][callee.property.name='create']",
    message: 'Utiliser calendarCategory(label, color, parentId, position) (fixtures/factories).',
  },
  {
    selector: "CallExpression[callee.object.property.name='treasuryCategory'][callee.property.name=/^find(Many|First)$/]",
    message: 'Utiliser treasuryCategoryIds() (fixtures/factories).',
  },
  {
    selector: "CallExpression[callee.property.name='find'] > ArrowFunctionExpression > LogicalExpression:has(BinaryExpression[operator='==='][left.property.name='clientId']):has(BinaryExpression[left.property.name='parentId'][right.value=null])",
    message: 'Utiliser clientRootProject(projects, clientId, activeOnly ?) (fixtures/factories).',
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
      // A variable used before its declaration throws at run time (temporal dead zone), which tsc does not see in a
      // callback: declared first. Function declarations are hoisted, types erased.
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true, typedefs: false, ignoreTypeReferences: true, enums: true }],
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
  planReferencesConfig(['**/*.{ts,js}']),
]);
