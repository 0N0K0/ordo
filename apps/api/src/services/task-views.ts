import { routineViewConfigSchema, taskViewConfigSchema, taskViewNameSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Prisma, TaskView, ViewKind } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';

/**
 * Loads a view or throws NOT_FOUND.
 * @param {string} id View id.
 * @returns {Promise<TaskView>} View.
 */
async function findView(id: string): Promise<TaskView> {
  const view = await prisma.taskView.findUnique({ where: { id } });
  if (!view) throw notFound('Vue');
  return view;
}

/**
 * Validates a view configuration (filters, sorting, columns…) of its kind, filling missing settings with defaults.
 * @param {ViewKind} kind Tasks or routines.
 * @param {unknown} config Raw configuration.
 * @returns {Prisma.InputJsonObject} Configuration, ready to store.
 */
function parseConfig(kind: ViewKind, config: unknown): Prisma.InputJsonObject {
  const schema = kind === 'ROUTINES' ? routineViewConfigSchema : taskViewConfigSchema;
  return parseInput(z.object({ config: schema }), { config }).config as unknown as Prisma.InputJsonObject;
}

/**
 * Views of a scope: the tasks or the routines of a project's tab, or of their page (null).
 * @param {string | null} projectId Project, or null for the page.
 * @param {ViewKind} kind Tasks or routines.
 * @returns {Prisma.TaskViewWhereInput} Where clause.
 */
function scope(projectId: string | null, kind: ViewKind): Prisma.TaskViewWhereInput {
  return { projectId, kind };
}

/**
 * Creates a view at the end of its scope. The first view of a scope becomes its default one.
 * @param {object} input View input.
 * @param {string} input.name Name.
 * @param {unknown} input.config Configuration.
 * @param {string | null} [input.projectId] Project, or null / omitted for the home page. Optional.
 * @param {ViewKind | null} [input.kind] Tasks (default) or routines. Optional.
 * @returns {Promise<TaskView>} Created view.
 */
export async function createView(input: { name: string; config: unknown; projectId?: string | null; kind?: ViewKind | null }): Promise<TaskView> {
  const { name } = parseInput(z.object({ name: taskViewNameSchema }), input);
  const kind = input.kind ?? 'TASKS';
  const config = parseConfig(kind, input.config);
  const projectId = input.projectId ?? null;
  if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) {
    throw notFound('Projet');
  }
  const [{ _max }, count] = await Promise.all([
    prisma.taskView.aggregate({ where: scope(projectId, kind), _max: { position: true } }),
    prisma.taskView.count({ where: scope(projectId, kind) }),
  ]);
  return prisma.taskView.create({
    data: { name, kind, config, projectId, position: (_max.position ?? -1) + 1, isDefault: count === 0 },
  });
}

/**
 * Renames a view and/or saves its configuration.
 * @param {string} id View id.
 * @param {object} input Changes; omitted fields are left unchanged.
 * @param {string | null} [input.name] New name. Optional.
 * @param {unknown} [input.config] New configuration. Optional.
 * @returns {Promise<TaskView>} Updated view.
 */
export async function updateView(id: string, input: { name?: string | null; config?: unknown }): Promise<TaskView> {
  const view = await findView(id);
  const { name } = parseInput(z.object({ name: taskViewNameSchema.optional() }), { name: input.name ?? undefined });
  const config = input.config === undefined || input.config === null ? undefined : parseConfig(view.kind, input.config);
  return prisma.taskView.update({ where: { id }, data: { name, config } });
}

/**
 * Duplicates a view, placed right after it.
 * @param {string} id View id.
 * @param {string} name Name of the copy.
 * @returns {Promise<TaskView>} Copy.
 */
export async function duplicateView(id: string, name: string): Promise<TaskView> {
  const source = await findView(id);
  const copy = await createView({ name, config: source.config, projectId: source.projectId, kind: source.kind });
  const ids = (
    await prisma.taskView.findMany({ where: scope(source.projectId, source.kind), orderBy: { position: 'asc' }, select: { id: true } })
  ).map((v) => v.id);
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
      where: scope(view.projectId, view.kind),
      orderBy: { position: 'asc' },
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
    prisma.taskView.updateMany({ where: { ...scope(view.projectId, view.kind), isDefault: true }, data: { isDefault: false } }),
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
  const views = await prisma.taskView.findMany({
    where: scope(view.projectId, view.kind),
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const order = moveInOrder(
    views.map((view) => view.id),
    id,
    index,
  );
  await prisma.$transaction(
    order.map((viewId, position) => prisma.taskView.update({ where: { id: viewId }, data: { position } })),
  );
}
