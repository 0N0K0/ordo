import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';
import { PrismaClient } from './generated/prisma/client';
import { getDatamodel } from './generated/pothos-types';
import { currentWorkspaceId } from './workspace-context';

/** Models shared by every workspace (accounts); every other one belongs to a workspace. */
const SHARED = new Set(['Workspace', 'User', 'Session', 'AuthToken']);

type Data = Record<string, unknown>;

const models = Object.entries(getDatamodel().datamodel.models);

/** Relation fields of each model: field name → related model. */
const relations = new Map(models.map(([model, { fields }]) => [model, new Map(fields.filter((field) => field.kind === 'object').map((field) => [field.name, field.type]))]));

/** Relation fields of each model holding the foreign key (set through them, Prisma's "checked" input). */
const owningRelations = new Map(
  models.map(([model, { fields }]) => [model, new Set(fields.filter((field) => field.kind === 'object' && field.relationFromFields?.length).map((field) => field.name))]),
);

/**
 * Tells whether a model belongs to a workspace.
 * @param {string} model Model.
 * @returns {boolean} Whether its rows have a workspace.
 */
const scoped = (model: string) => !SHARED.has(model);

/**
 * Applies a function to a value or to each item of a list.
 * @param {unknown} value Value or list.
 * @param {(item: Data) => Data} fn Function.
 * @returns {unknown} Mapped value or list.
 */
const each = (value: unknown, fn: (item: Data) => Data): unknown => (Array.isArray(value) ? value.map((item: Data) => fn(item)) : fn(value as Data));

/**
 * Tells whether a value is a plain object (not a list, a date or binary data).
 * @param {unknown} value Value.
 * @returns {boolean} Whether it is a plain object.
 */
const isObject = (value: unknown): value is Data => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  // GraphQL arguments have no prototype.
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Gives the workspace to the rows created by the nested writes of a relation (create, createMany,
 * connectOrCreate, upsert, and the creations inside nested updates).
 * @param {string} model Related model.
 * @param {Data} ops Nested write.
 * @param {string} workspaceId Workspace.
 * @returns {Data} Nested write.
 */
function nestedWrite(model: string, ops: Data, workspaceId: string): Data {
  const out: Data = { ...ops };
  if (out.create) out.create = each(out.create, (data) => createData(model, data, workspaceId));
  if (isObject(out.createMany) && out.createMany.data && scoped(model)) {
    out.createMany = { ...out.createMany, data: each(out.createMany.data, (data) => ({ ...data, workspaceId })) };
  }
  if (out.connectOrCreate) out.connectOrCreate = each(out.connectOrCreate, (item) => ({ ...item, create: createData(model, item.create as Data, workspaceId) }));
  if (out.upsert) {
    out.upsert = each(out.upsert, (item) => ({ ...item, create: createData(model, item.create as Data, workspaceId), update: updateData(model, item.update as Data, workspaceId) }));
  }
  if (out.update) {
    out.update = each(out.update, (item) => ('where' in item && isObject(item.data) ? { ...item, data: updateData(model, item.data, workspaceId) } : updateData(model, item, workspaceId)));
  }
  return out;
}

/**
 * Walks the relations of written data for their nested writes.
 * @param {string} model Model.
 * @param {Data} data Data.
 * @param {string} workspaceId Workspace.
 * @returns {Data} Data.
 */
function relationWrites(model: string, data: Data, workspaceId: string): Data {
  const fields = relations.get(model);
  if (!fields || !isObject(data)) return data;
  const out: Data = { ...data };
  for (const [name, target] of fields) {
    if (isObject(out[name])) out[name] = nestedWrite(target, out[name], workspaceId);
  }
  return out;
}

/**
 * Data of an update, with the workspace given to the rows it creates (the workspace of a row never changes).
 * @param {string} model Model.
 * @param {Data} data Data.
 * @param {string} workspaceId Workspace.
 * @returns {Data} Data.
 */
function updateData(model: string, data: Data, workspaceId: string): Data {
  if (!isObject(data)) return data;
  const { workspaceId: _ignored, workspace: _ignoredToo, ...rest } = data;
  return relationWrites(model, rest, workspaceId);
}

/**
 * Data of a creation, with its workspace: as a relation when the data sets its other foreign keys through their
 * relations (Prisma's "checked" input), as the foreign key otherwise.
 * @param {string} model Model.
 * @param {Data} data Data.
 * @param {string} workspaceId Workspace.
 * @returns {Data} Data.
 */
function createData(model: string, data: Data, workspaceId: string): Data {
  if (!isObject(data)) return data;
  const owning = owningRelations.get(model);
  const { workspaceId: _ignored, workspace: _ignoredToo, ...rest } = data;
  const out = relationWrites(model, rest, workspaceId);
  if (!scoped(model)) return out;
  const checked = Object.keys(out).some((key) => owning?.has(key) && out[key] !== undefined);
  return checked ? { ...out, workspace: { connect: { id: workspaceId } } } : { ...out, workspaceId };
}

/** Operations filtered by their `where`. */
const FILTERED = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

/**
 * Limits a query to the current workspace: filters what it reads, updates and deletes, and gives the workspace
 * to what it creates (nested creations included).
 * @param {string} model Model.
 * @param {string} operation Operation.
 * @param {Data} args Arguments.
 * @returns {Data} Arguments.
 */
function scopeArgs(model: string, operation: string, args: Data): Data {
  const workspaceId = currentWorkspaceId();
  const out: Data = { ...args };
  if (FILTERED.has(operation)) out.where = { ...(out.where as Data | undefined), workspaceId };
  if (operation === 'create') out.data = createData(model, out.data as Data, workspaceId);
  if (operation === 'createMany' || operation === 'createManyAndReturn') out.data = each(out.data, (data) => ({ ...data, workspaceId }));
  if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') out.data = updateData(model, out.data as Data, workspaceId);
  if (operation === 'upsert') {
    out.create = createData(model, out.create as Data, workspaceId);
    out.update = updateData(model, out.update as Data, workspaceId);
  }
  return out;
}

const base = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

/**
 * Database client. Every row but the accounts and the workspaces belongs to a workspace: queries only see the rows
 * of the current one (see `runInWorkspace`), and fail outside one. Raw SQL is not limited: it filters by
 * `currentWorkspaceId()` itself.
 */
export const prisma = base.$extends({
  name: 'workspaces',
  query: {
    $allModels: {
      /**
       * Limits the query to the current workspace.
       * @param {object} params Query.
       * @returns {Promise<unknown>} Result.
       */
      $allOperations({ model, operation, args, query }) {
        if (!scoped(model)) return query(args);
        return query(scopeArgs(model, operation, (args ?? {}) as Data) as typeof args);
      },
    },
  },
}) as unknown as PrismaClient;

/** Client without the workspace limits: for the workspaces themselves (and their deletion). */
export const unscopedPrisma = base;
