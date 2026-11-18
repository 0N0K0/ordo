import { calendarCategoryFormSchema, type CalendarCategoryFormValues } from '@ordo/shared';
import { treeListService } from '../core/trees';
import type { CalendarCategory } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';

/** Categories of the events, in a tree; a deleted one's sub-categories go up a level, its events only lose it. */
const categories = treeListService<CalendarCategory, CalendarCategoryFormValues>(
  'calendarCategory',
  { notFound: 'Catégorie', missingParent: 'Catégorie parente', loop: 'Une catégorie ne peut pas être placée sous elle-même ou sous l’une de ses sous-catégories.' },
  {
    parse: (input) => parseInput(calendarCategoryFormSchema, input),
    moveInput: (category, parentId) => ({ name: category.name, color: category.color, parentId }),
  },
);

/**
 * Creates a category at the end of its parent's children.
 * @param {CalendarCategoryFormValues} input Category.
 * @returns {Promise<CalendarCategory>} Category.
 */
export function createCalendarCategory(input: CalendarCategoryFormValues): Promise<CalendarCategory> {
  return categories.create(input);
}

/**
 * Updates a category (moving it under another parent puts it at the end).
 * @param {string} id Category id.
 * @param {CalendarCategoryFormValues} input Category.
 * @returns {Promise<CalendarCategory>} Category.
 */
export function updateCalendarCategory(id: string, input: CalendarCategoryFormValues): Promise<CalendarCategory> {
  return categories.update(id, input);
}

/**
 * Deletes a category: its sub-categories go up a level (under its parent), its events only lose it.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export function deleteCalendarCategory(id: string): Promise<void> {
  return categories.remove(id);
}

/**
 * Moves a category under another parent (or to the top level), then among its siblings.
 * @param {string} id Category id.
 * @param {string | null | undefined} parentId New parent, null for the top level; undefined: unchanged.
 * @param {number | null} [index] Index among its (new) siblings; last when omitted. Optional.
 * @returns {Promise<void>}
 */
export function moveCalendarCategory(id: string, parentId: string | null | undefined, index?: number | null): Promise<void> {
  return categories.move(id, parentId, index);
}
