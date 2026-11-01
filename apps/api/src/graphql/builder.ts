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

// Every root field requires a session unless it opts out with `skipTypeScopes`.
builder.queryType({ authScopes: { loggedIn: true } });
builder.mutationType({ authScopes: { loggedIn: true } });
