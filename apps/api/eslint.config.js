import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { SHARED_SYNTAX_RULES } from '../../packages/shared/eslint-rules.js';

// Patterns of the bricks of the API (services/core, graphql, routes/http).
const API_SYNTAX_RULES = [
  {
    // const x = await prisma.y.findUnique(…); if (!x) throw notFound(…)
    selector:
      "VariableDeclaration:has(AwaitExpression > CallExpression[callee.property.name=/^find(Unique|First)$/]) + IfStatement[test.operator='!'][test.argument.type='Identifier']:matches([consequent.argument.callee.name='notFound'], [consequent.body.0.argument.callee.name='notFound'])",
    message: 'Utiliser orNotFound(prisma.x.findUnique(…), « Élément ») (graphql/errors).',
  },
  {
    selector: "CallExpression[callee.property.name='toNumber'][arguments.length=0]",
    message: 'Utiliser fromDecimal(value) (services/core/decimal).',
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
    files: ['src/services/library/**', 'src/routes/library.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
