import { tableKeySchema, tableViewConfigSchema, taskViewLabelSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Prisma, TaskView, ViewKind } from '../../generated/prisma/client';
import { clientError, parseField, parseInput } from '../../graphql/errors';
import { BY_POSITION, moveInList, nextPositionIn } from '../core/ordering';
import { assertExists, findOrNotFound } from '../core/lookup';
import { toJson } from '../core/json';

/**
 * Loads a view or throws NOT_FOUND.
 * @param {string} id View id.
 * @returns {Promise<TaskView>} View.
 */
function findView(id: string): Promise<TaskView> {
  return findOrNotFound(prisma.taskView, id, 'Vue');
}

/**
 * Validates a view configuration (filters, sorting, columns…), filling missing settings with defaults: only the views
 * of a table (the former kinds — tasks, routines, shopping lists — are kept as they are, no longer changed).
 * @param {ViewKind} kind Kind of the view.
 * @param {unknown} config Raw configuration.
 * @returns {Prisma.InputJsonValue} Configuration, ready to store.
 */
function parseConfig(kind: ViewKind, config: unknown): Prisma.InputJsonValue {
  if (kind !== 'TABLE') throw clientError('BAD_USER_INPUT', 'Ce type de vue n’existe plus : les vues sont celles des tableaux.');
  return toJson(parseField('config', tableViewConfigSchema, config));
}

/**
 * Views of a scope: the tasks, routines, shopping lists or rows of a table of a project's tab, or of their page (null).
 * @param {string | null} projectId Project, or null for the page.
 * @param {ViewKind} kind What the views list.
 * @param {string | null} tableKey Table of the views of kind TABLE (ignored for the other kinds).
 * @returns {Prisma.TaskViewWhereInput} Where clause.
 */
export function viewScope(projectId: string | null, kind: ViewKind, tableKey: string | null): Prisma.TaskViewWhereInput {
  return { projectId, kind, tableKey: kind === 'TABLE' ? tableKey : null };
}

/**
 * Scope of a stored view.
 * @param {TaskView} view View.
 * @returns {Prisma.TaskViewWhereInput} Where clause.
 */
const scopeOf = (view: TaskView) => viewScope(view.projectId, view.kind, view.tableKey);

/**
 * Creates a view at the end of its scope. The first view of a scope becomes its default one.
 * @param {object} input View input.
 * @param {string} input.label Label.
 * @param {unknown} input.config Configuration.
 * @param {string | null} [input.projectId] Project, or null / omitted for the home page. Optional.
 * @param {ViewKind | null} [input.kind] Kind of the view: the rows of a table (default; the former kinds are no longer made). Optional.
 * @param {string | null} [input.tableKey] Table of a view of kind TABLE (required for it). Optional.
 * @returns {Promise<TaskView>} Created view.
 */
export async function createView(input: { label: string; config: unknown; projectId?: string | null; kind?: ViewKind | null; tableKey?: string | null }): Promise<TaskView> {
  const { label } = parseInput(z.object({ label: taskViewLabelSchema }), input);
  const kind = input.kind ?? 'TABLE';
  const tableKey = kind === 'TABLE' ? parseField('tableKey', tableKeySchema, input.tableKey) : null;
  const config = parseConfig(kind, input.config);
  const projectId = input.projectId ?? null;
  await assertExists(prisma.project, projectId, 'Projet');
  const [position, count] = await Promise.all([nextPositionIn('taskView', viewScope(projectId, kind, tableKey)), prisma.taskView.count({ where: viewScope(projectId, kind, tableKey) })]);
  return prisma.taskView.create({
    data: { label, kind, tableKey, config, projectId, position, isDefault: count === 0 },
  });
}

/**
 * Renames a view and/or saves its configuration.
 * @param {string} id View id.
 * @param {object} input Changes; omitted fields are left unchanged.
 * @param {string | null} [input.label] New label. Optional.
 * @param {unknown} [input.config] New configuration. Optional.
 * @returns {Promise<TaskView>} Updated view.
 */
export async function updateView(id: string, input: { label?: string | null; config?: unknown }): Promise<TaskView> {
  const view = await findView(id);
  const label = parseField('label', taskViewLabelSchema.optional(), input.label ?? undefined);
  const config = input.config === undefined || input.config === null ? undefined : parseConfig(view.kind, input.config);
  return prisma.taskView.update({ where: { id }, data: { label, config } });
}

/**
 * Duplicates a view, placed right after it.
 * @param {string} id View id.
 * @param {string} label Label of the copy.
 * @returns {Promise<TaskView>} Copy.
 */
export async function duplicateView(id: string, label: string): Promise<TaskView> {
  const source = await findView(id);
  const copy = await createView({ label, config: source.config, projectId: source.projectId, kind: source.kind, tableKey: source.tableKey });
  const ids = (await prisma.taskView.findMany({ where: scopeOf(source), orderBy: BY_POSITION, select: { id: true } })).map((v) => v.id);
  await moveView(copy.id, ids.indexOf(source.id) + 1);
  return copy;
}

/**
 * Deletes a view. When it was the default one, the first remaining view takes over.
 * @param {string} id View id.
 * @returns {Promise<void>}
 */
export async function deleteView(id: string): Promise<void> {
  const view = await findView(id);
  await prisma.taskView.delete({ where: { id } });
  if (view.isDefault) {
    const first = await prisma.taskView.findFirst({
      where: scopeOf(view),
      orderBy: BY_POSITION,
      select: { id: true },
    });
    if (first) await prisma.taskView.update({ where: { id: first.id }, data: { isDefault: true } });
  }
}

/**
 * Makes a view the one opened by default in its scope.
 * @param {string} id View id.
 * @returns {Promise<void>}
 */
export async function setDefaultView(id: string): Promise<void> {
  const view = await findView(id);
  await prisma.$transaction([
    prisma.taskView.updateMany({ where: { ...scopeOf(view), isDefault: true }, data: { isDefault: false } }),
    prisma.taskView.update({ where: { id }, data: { isDefault: true } }),
  ]);
}

/**
 * Moves a view to a new index in its scope's tab list.
 * @param {string} id View id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveView(id: string, index: number): Promise<void> {
  const view = await findView(id);
  await moveInList('taskView', id, index, scopeOf(view));
}
