import { taskViewConfigSchema, taskViewNameSchema, type TaskViewConfig } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Prisma, TaskView } from '../generated/prisma/client';
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
 * Validates a view configuration (filters, sorting, columns…), filling missing settings with defaults.
 * @param {unknown} config Raw configuration.
 * @returns {Prisma.InputJsonObject} Configuration, ready to store.
 */
function parseConfig(config: unknown): Prisma.InputJsonObject {
  const parsed: TaskViewConfig = parseInput(z.object({ config: taskViewConfigSchema }), { config }).config;
  return parsed as unknown as Prisma.InputJsonObject;
}

/**
 * Creates a view at the end of the list. The first view becomes the default one.
 * @param {object} input View input.
 * @param {string} input.name Name.
 * @param {unknown} input.config Configuration.
 * @returns {Promise<TaskView>} Created view.
 */
export async function createView(input: { name: string; config: unknown }): Promise<TaskView> {
  const { name } = parseInput(z.object({ name: taskViewNameSchema }), input);
  const config = parseConfig(input.config);
  const [{ _max }, count] = await Promise.all([
    prisma.taskView.aggregate({ _max: { position: true } }),
    prisma.taskView.count(),
  ]);
  return prisma.taskView.create({
    data: { name, config, position: (_max.position ?? -1) + 1, isDefault: count === 0 },
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
  await findView(id);
  const { name } = parseInput(z.object({ name: taskViewNameSchema.optional() }), { name: input.name ?? undefined });
  const config = input.config === undefined || input.config === null ? undefined : parseConfig(input.config);
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
  const copy = await createView({ name, config: source.config });
  const ids = (await prisma.taskView.findMany({ orderBy: { position: 'asc' }, select: { id: true } })).map((v) => v.id);
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
    const first = await prisma.taskView.findFirst({ orderBy: { position: 'asc' }, select: { id: true } });
    if (first) await prisma.taskView.update({ where: { id: first.id }, data: { isDefault: true } });
  }
}

/**
 * Makes a view the one opened by default.
 * @param {string} id View id.
 * @returns {Promise<void>}
 */
export async function setDefaultView(id: string): Promise<void> {
  await findView(id);
  await prisma.$transaction([
    prisma.taskView.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.taskView.update({ where: { id }, data: { isDefault: true } }),
  ]);
}

/**
 * Moves a view to a new index in the tab list.
 * @param {string} id View id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveView(id: string, index: number): Promise<void> {
  await findView(id);
  const views = await prisma.taskView.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  const order = moveInOrder(
    views.map((view) => view.id),
    id,
    index,
  );
  await prisma.$transaction(
    order.map((viewId, position) => prisma.taskView.update({ where: { id: viewId }, data: { position } })),
  );
}
