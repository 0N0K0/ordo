import { calendarCategoryFormSchema, type CalendarCategoryFormValues } from '@ordo/shared';
import { assertTreeParent } from '../core/trees';
import { prisma } from '../../db';
import type { CalendarCategory } from '../../generated/prisma/client';
import { orNotFound, parseInput } from '../../graphql/errors';
import { moveInList, nextPositionIn } from '../core/ordering';
import { assertNotArchived } from '../core/archive';

/**
 * Loads a category or throws NOT_FOUND.
 * @param {string} id Category id.
 * @returns {Promise<CalendarCategory>} Category.
 */
async function findCategory(id: string): Promise<CalendarCategory> {
  const category = await orNotFound(prisma.calendarCategory.findUnique({ where: { id } }), 'Catégorie');
  return category;
}

/**
 * Checks a parent: it exists and is not the category itself or one of its descendants.
 * @param {string | null} parentId Parent.
 * @param {string | null} id Category being moved, if any.
 * @returns {Promise<void>}
 */
async function assertParent(parentId: string | null, id: string | null): Promise<void> {
  await assertTreeParent('calendarCategory', parentId, id, { missing: 'Catégorie parente', loop: 'Une catégorie ne peut pas être placée sous elle-même ou sous l’une de ses sous-catégories.' });
}

/**
 * Next position among the children of a parent.
 * @param {string | null} parentId Parent.
 * @returns {Promise<number>} Position.
 */
async function nextPosition(parentId: string | null): Promise<number> {
  return nextPositionIn('calendarCategory', { parentId });
}

/**
 * Creates a category at the end of its parent's children.
 * @param {CalendarCategoryFormValues} input Category.
 * @returns {Promise<CalendarCategory>} Category.
 */
export async function createCalendarCategory(input: CalendarCategoryFormValues): Promise<CalendarCategory> {
  const data = parseInput(calendarCategoryFormSchema, input);
  await assertParent(data.parentId, null);
  await assertNotArchived('calendarCategory', data.parentId);
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
  await assertNotArchived('calendarCategory', id);
  const data = parseInput(calendarCategoryFormSchema, input);
  await assertParent(data.parentId, id);
  const moved = data.parentId !== category.parentId;
  // An archived category takes no new sub-category.
  if (moved) await assertNotArchived('calendarCategory', data.parentId);
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
 * Moves a category among its siblings, under another parent first when one is given.
 * @param {string} id Category id.
 * @param {number} index Target index among its (new) siblings.
 * @param {string | null} [parentId] New parent (null: top level); unchanged when omitted. Optional.
 * @returns {Promise<void>}
 */
export async function moveCalendarCategory(id: string, index: number, parentId?: string | null): Promise<void> {
  let category = await findCategory(id);
  await assertNotArchived('calendarCategory', id);
  if (parentId !== undefined && parentId !== category.parentId) category = await updateCalendarCategory(id, { name: category.name, color: category.color, parentId });
  await moveInList('calendarCategory', id, index, { parentId: category.parentId });
}
