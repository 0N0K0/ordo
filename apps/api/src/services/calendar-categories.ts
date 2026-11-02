import { calendarCategoryFormSchema, type CalendarCategoryFormValues } from '@ordo/shared';
import { prisma } from '../db';
import type { CalendarCategory } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';

/**
 * Loads a category or throws NOT_FOUND.
 * @param {string} id Category id.
 * @returns {Promise<CalendarCategory>} Category.
 */
async function findCategory(id: string): Promise<CalendarCategory> {
  const category = await prisma.calendarCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  return category;
}

/**
 * Checks a parent: it exists and is not the category itself or one of its descendants.
 * @param {string | null} parentId Parent.
 * @param {string | null} id Category being moved, if any.
 * @returns {Promise<void>}
 */
async function assertParent(parentId: string | null, id: string | null): Promise<void> {
  if (!parentId) return;
  const categories = await prisma.calendarCategory.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]));
  if (!parentOf.has(parentId)) throw notFound('Catégorie parente');
  for (let current: string | null | undefined = parentId; current; current = parentOf.get(current)) {
    if (current === id) {
      const message = 'Une catégorie ne peut pas être placée sous elle-même ou sous l’une de ses sous-catégories.';
      throw clientError('BAD_USER_INPUT', message, { fields: { parentId: message } });
    }
  }
}

/**
 * Next position among the children of a parent.
 * @param {string | null} parentId Parent.
 * @returns {Promise<number>} Position.
 */
async function nextPosition(parentId: string | null): Promise<number> {
  const { _max } = await prisma.calendarCategory.aggregate({ where: { parentId }, _max: { position: true } });
  return (_max.position ?? -1) + 1;
}

/**
 * Creates a category at the end of its parent's children.
 * @param {CalendarCategoryFormValues} input Category.
 * @returns {Promise<CalendarCategory>} Category.
 */
export async function createCalendarCategory(input: CalendarCategoryFormValues): Promise<CalendarCategory> {
  const data = parseInput(calendarCategoryFormSchema, input);
  await assertParent(data.parentId, null);
  return prisma.calendarCategory.create({ data: { ...data, position: await nextPosition(data.parentId) } });
}

/**
 * Updates a category (moving it under another parent puts it at the end).
 * @param {string} id Category id.
 * @param {CalendarCategoryFormValues} input Category.
 * @returns {Promise<CalendarCategory>} Category.
 */
export async function updateCalendarCategory(id: string, input: CalendarCategoryFormValues): Promise<CalendarCategory> {
  const category = await findCategory(id);
  const data = parseInput(calendarCategoryFormSchema, input);
  await assertParent(data.parentId, id);
  const moved = data.parentId !== category.parentId;
  return prisma.calendarCategory.update({
    where: { id },
    data: { ...data, ...(moved && { position: await nextPosition(data.parentId) }) },
  });
}

/**
 * Deletes a category with its sub-categories (events only lose them).
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteCalendarCategory(id: string): Promise<void> {
  await findCategory(id);
  await prisma.calendarCategory.delete({ where: { id } });
}

/**
 * Moves a category among its siblings.
 * @param {string} id Category id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveCalendarCategory(id: string, index: number): Promise<void> {
  const category = await findCategory(id);
  const siblings = await prisma.calendarCategory.findMany({
    where: { parentId: category.parentId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const order = moveInOrder(
    siblings.map((item) => item.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((categoryId, position) => prisma.calendarCategory.update({ where: { id: categoryId }, data: { position } })));
}
