import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { prisma } from '../db';
import { isProd } from '../env';
import type PrismaTypes from '../generated/pothos-types';
import { getDatamodel } from '../generated/pothos-types';
import type { Context } from './context';
import { unauthenticated } from './errors';

export const builder = new SchemaBuilder<{
  Context: Context;
  PrismaTypes: PrismaTypes;
  AuthScopes: { loggedIn: boolean };
  DefaultFieldNullability: false;
  Scalars: {
    ID: { Input: string; Output: string };
    /** Uploaded file (GraphQL multipart request). */
    File: { Input: File; Output: never };
    /** Calendar date, YYYY-MM-DD. */
    Date: { Input: string; Output: Date };
    /** Instant, ISO 8601. */
    DateTime: { Input: Date; Output: Date };
    /** Arbitrary JSON, validated by the resolvers. */
    JSON: { Input: unknown; Output: unknown };
  };
}>({
  defaultFieldNullability: false,
  plugins: [ScopeAuthPlugin, PrismaPlugin],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
    onUnusedQuery: isProd ? null : 'warn',
  },
  scopeAuth: {
    authScopes: (ctx) => ({ loggedIn: ctx.session !== null }),
    unauthorizedError: () => unauthenticated(),
  },
});

builder.scalarType('File', {
  description: 'Uploaded file, sent with a GraphQL multipart request.',
  serialize: () => {
    throw new Error('File can only be used as an input.');
  },
});

builder.scalarType('Date', {
  description: 'Calendar date, YYYY-MM-DD.',
  serialize: (date) => date.toISOString().slice(0, 10),
  parseValue: (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Date must be YYYY-MM-DD.');
    return value;
  },
});

builder.scalarType('JSON', {
  description: 'Arbitrary JSON value, validated by the resolver that receives it.',
  serialize: (value) => value,
  parseValue: (value) => value,
});

builder.scalarType('DateTime', {
  description: 'Instant, ISO 8601.',
  serialize: (date) => date.toISOString(),
  parseValue: (value) => {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new TypeError('Invalid DateTime.');
    return date;
  },
});

// Every root field requires a session unless it opts out with `skipTypeScopes`.
builder.queryType({ authScopes: { loggedIn: true } });
builder.mutationType({ authScopes: { loggedIn: true } });
