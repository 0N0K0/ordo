import { formatDay, parseDay, routineCategorySchema, routineOccurrences, routineSchema, type RoutineCategoryInput, type RoutineInput } from '@ordo/shared';
import { prisma } from '../db';
import type { Routine, RoutineCategory } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { storedRecurrence } from './calendar-events';

/**
 * Today in Paris, as a calendar date.
 * @returns {string} YYYY-MM-DD.
 */
export const routineToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

/**
 * Error attached to a form field.
 * @param {string} field Field name.
 * @param {string} message Human-readable reason.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */
const fieldError = (field: string, message: string) => clientError('BAD_USER_INPUT', message, { fields: { [field]: message } });

/**
 * Whether `ancestor` is `id` or one of its parents, following a parent map.
 * @param {Map<string, string | null>} parentOf Parent of each id.
 * @param {string} start Id the walk starts from.
 * @param {string} id Id looked for.
 * @returns {boolean} Found.
 */
function reaches(parentOf: Map<string, string | null>, start: string, id: string): boolean {
  const seen = new Set<string>();
  for (let current: string | null | undefined = start; current && !seen.has(current); current = parentOf.get(current)) {
    if (current === id) return true;
    seen.add(current);
  }
  return false;
}

// Categories ------------------------------------------------------------------------------------------------------

/**
 * Validates a category: its parent exists and is not the category or one of its sub-categories.
 * @param {RoutineCategoryInput} input Category.
 * @param {string} [id] Category edited. Optional.
 * @returns {Promise<ReturnType<typeof routineCategorySchema.parse>>} Category.
 */
async function parseCategory(input: RoutineCategoryInput, id?: string) {
  const data = parseInput(routineCategorySchema, input);
  if (!data.parentId) return data;
  const all = await prisma.routineCategory.findMany({ select: { id: true, parentId: true } });
  if (!all.some((category) => category.id === data.parentId)) throw notFound('Catégorie parente');
  if (id && reaches(new Map(all.map((category) => [category.id, category.parentId])), data.parentId, id)) {
    throw fieldError('parentId', 'Une catégorie ne peut pas être rangée sous elle-même.');
  }
  return data;
}

/**
 * Creates a category.
 * @param {RoutineCategoryInput} input Category.
 * @returns {Promise<RoutineCategory>} Category.
 */
export async function createCategory(input: RoutineCategoryInput): Promise<RoutineCategory> {
  return prisma.routineCategory.create({ data: await parseCategory(input) });
}

/**
 * Updates a category.
 * @param {string} id Category id.
 * @param {RoutineCategoryInput} input Category.
 * @returns {Promise<RoutineCategory>} Category.
 */
export async function updateCategory(id: string, input: RoutineCategoryInput): Promise<RoutineCategory> {
  const category = await prisma.routineCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  return prisma.routineCategory.update({ where: { id }, data: await parseCategory(input, id) });
}

/**
 * Moves a category under another one, or to the top level.
 * @param {string} id Category id.
 * @param {string | null} parentId New parent.
 * @returns {Promise<RoutineCategory>} Category.
 */
export async function moveCategory(id: string, parentId: string | null): Promise<RoutineCategory> {
  const category = await prisma.routineCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  return updateCategory(id, { name: category.name, color: category.color, parentId });
}

/**
 * Deletes a category: its routines lose it, its sub-categories go one level up.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await prisma.routineCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  await prisma.$transaction([prisma.routineCategory.updateMany({ where: { parentId: id }, data: { parentId: category.parentId } }), prisma.routineCategory.delete({ where: { id } })]);
}

// Routines --------------------------------------------------------------------------------------------------------

/**
 * Validates a routine and what it points to: category, parent (not itself nor one of its sub-routines), project,
 * assignees and required routines (no cycle).
 * @param {RoutineInput} input Routine.
 * @param {string} [id] Routine edited. Optional.
 * @returns {Promise<ReturnType<typeof routineSchema.parse>>} Routine.
 */
async function parseRoutine(input: RoutineInput, id?: string) {
  const data = parseInput(routineSchema, input);
  data.assigneeIds = [...new Set(data.assigneeIds)];
  data.requiredIds = [...new Set(data.requiredIds)];
  if (data.recurrence.until && data.recurrence.until < data.startDate) throw fieldError('recurrence', 'La fin de la répétition doit suivre la date de début.');
  if (data.categoryId && !(await prisma.routineCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) throw fieldError('categoryId', 'Catégorie introuvable.');
  if (data.projectId && !(await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } }))) throw fieldError('projectId', 'Projet introuvable.');
  if ((await prisma.contributor.count({ where: { id: { in: data.assigneeIds } } })) !== data.assigneeIds.length) throw fieldError('assigneeIds', 'Assigné introuvable.');

  const all = await prisma.routine.findMany({ select: { id: true, parentId: true, requires: { select: { requiredId: true } } } });
  const known = new Set(all.map((routine) => routine.id));
  if (data.parentId) {
    if (!known.has(data.parentId)) throw fieldError('parentId', 'Routine parente introuvable.');
    if (id && reaches(new Map(all.map((routine) => [routine.id, routine.parentId])), data.parentId, id)) {
      throw fieldError('parentId', 'Une routine ne peut pas être rangée sous elle-même.');
    }
  }
  if (data.requiredIds.some((requiredId) => !known.has(requiredId))) throw fieldError('requiredIds', 'Routine introuvable.');
  if (id && data.requiredIds.includes(id)) throw fieldError('requiredIds', 'Une routine ne peut pas dépendre d’elle-même.');
  if (id && data.requiredIds.length) {
    // No cycle: none of the required routines may (indirectly) require this one.
    const requires = new Map(all.map((routine) => [routine.id, routine.requires.map((dependency) => dependency.requiredId)]));
    const stack = [...data.requiredIds];
    const seen = new Set<string>();
    while (stack.length) {
      const current = stack.pop()!;
      if (current === id) throw fieldError('requiredIds', 'Ces dépendances forment une boucle.');
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(requires.get(current) ?? []));
    }
  }
  return data;
}

/**
 * Prisma data of a validated routine.
 * @param {ReturnType<typeof routineSchema.parse>} data Routine.
 * @returns {object} Scalar fields.
 */
const scalars = (data: ReturnType<typeof routineSchema.parse>) => ({
  title: data.title,
  description: data.description,
  categoryId: data.categoryId,
  parentId: data.parentId,
  startDate: parseDay(data.startDate),
  recurrence: data.recurrence,
  estimate: data.estimate,
  projectId: data.projectId,
});

/**
 * Creates a routine, last of its siblings.
 * @param {RoutineInput} input Routine.
 * @returns {Promise<Routine>} Routine.
 */
export async function createRoutine(input: RoutineInput): Promise<Routine> {
  const data = await parseRoutine(input);
  const position = ((await prisma.routine.aggregate({ where: { parentId: data.parentId }, _max: { position: true } }))._max.position ?? -1) + 1;
  return prisma.$transaction(async (tx) => {
    const routine = await tx.routine.create({ data: { ...scalars(data), position, assignees: { connect: data.assigneeIds.map((id) => ({ id })) } } });
    if (data.requiredIds.length) await tx.routineDependency.createMany({ data: data.requiredIds.map((requiredId) => ({ routineId: routine.id, requiredId })) });
    return routine;
  });
}

/**
 * Loads a routine or throws NOT_FOUND.
 * @param {string} id Routine id.
 * @returns {Promise<Routine>} Routine.
 */
async function findRoutine(id: string): Promise<Routine> {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw notFound('Routine');
  return routine;
}

/**
 * Updates a routine (its ticked occurrences stay).
 * @param {string} id Routine id.
 * @param {RoutineInput} input Routine.
 * @returns {Promise<Routine>} Routine.
 */
export async function updateRoutine(id: string, input: RoutineInput): Promise<Routine> {
  await findRoutine(id);
  const data = await parseRoutine(input, id);
  return prisma.$transaction(async (tx) => {
    await tx.routineDependency.deleteMany({ where: { routineId: id } });
    if (data.requiredIds.length) await tx.routineDependency.createMany({ data: data.requiredIds.map((requiredId) => ({ routineId: id, requiredId })) });
    return tx.routine.update({ where: { id }, data: { ...scalars(data), assignees: { set: data.assigneeIds.map((assigneeId) => ({ id: assigneeId })) } } });
  });
}

/**
 * Current form of a routine as an input, with some fields changed.
 * @param {string} id Routine id.
 * @param {Partial<RoutineInput>} changes Changes.
 * @returns {Promise<Routine>} Routine.
 */
export async function patchRoutine(id: string, changes: Partial<RoutineInput>): Promise<Routine> {
  const routine = await prisma.routine.findUnique({
    where: { id },
    include: { assignees: { select: { id: true } }, requires: { select: { requiredId: true } } },
  });
  if (!routine) throw notFound('Routine');
  return updateRoutine(id, {
    title: routine.title,
    description: routine.description,
    categoryId: routine.categoryId,
    parentId: routine.parentId,
    startDate: formatDay(routine.startDate),
    recurrence: storedRecurrence(routine.recurrence) ?? (routine.recurrence as RoutineInput['recurrence']),
    estimate: routine.estimate,
    projectId: routine.projectId,
    assigneeIds: routine.assignees.map((assignee) => assignee.id),
    requiredIds: routine.requires.map((dependency) => dependency.requiredId),
    ...changes,
  });
}

/**
 * Archives or restores a routine (an archived one is no longer due).
 * @param {string} id Routine id.
 * @param {boolean} archived Target state.
 * @returns {Promise<Routine>} Routine.
 */
export async function setRoutineArchived(id: string, archived: boolean): Promise<Routine> {
  await findRoutine(id);
  return prisma.routine.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}

/**
 * Deletes a routine: its sub-routines go one level up, its tracked time stays (without it).
 * @param {string} id Routine id.
 * @returns {Promise<void>}
 */
export async function deleteRoutine(id: string): Promise<void> {
  const routine = await findRoutine(id);
  await prisma.$transaction([prisma.routine.updateMany({ where: { parentId: id }, data: { parentId: routine.parentId } }), prisma.routine.delete({ where: { id } })]);
}

/** Where a routine is dropped, relative to another one. */
export type RoutinePlace = 'BEFORE' | 'AFTER' | 'INSIDE';

/**
 * Moves a routine next to another one (before or after it: same parent and category), or last under it (a
 * sub-routine), then numbers the siblings in their new order.
 * @param {string} id Routine moved.
 * @param {string} targetId Routine it is dropped on.
 * @param {RoutinePlace} place Before, after or inside the target.
 * @returns {Promise<void>}
 */
export async function moveRoutine(id: string, targetId: string, place: RoutinePlace): Promise<void> {
  if (id === targetId) throw clientError('BAD_USER_INPUT', 'Une routine ne peut pas être déplacée sur elle-même.');
  const routine = await findRoutine(id);
  const target = await findRoutine(targetId);
  const parentId = place === 'INSIDE' ? target.id : target.parentId;
  const categoryId = place === 'INSIDE' ? routine.categoryId : target.categoryId;
  // The parent is checked (no loop) by the regular update.
  if (parentId !== routine.parentId || categoryId !== routine.categoryId) await patchRoutine(id, { parentId, categoryId });
  const siblings = (await prisma.routine.findMany({ where: { parentId, id: { not: id } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } })).map((sibling) => sibling.id);
  const index = siblings.indexOf(target.id);
  siblings.splice(place === 'INSIDE' || index === -1 ? siblings.length : place === 'BEFORE' ? index : index + 1, 0, id);
  await prisma.$transaction(siblings.map((siblingId, position) => prisma.routine.update({ where: { id: siblingId }, data: { position } })));
}

/**
 * Ticks or unticks an occurrence of a routine (by default its current one).
 * @param {string} id Routine id.
 * @param {boolean} done Target state.
 * @param {string | null} [date] Occurrence date. Optional. Default = the current occurrence.
 * @returns {Promise<string>} Occurrence date.
 */
export async function setRoutineDone(id: string, done: boolean, date?: string | null): Promise<string> {
  const routine = await findRoutine(id);
  const rule = storedRecurrence(routine.recurrence);
  if (!rule) throw clientError('BAD_USER_INPUT', 'Répétition invalide.');
  const occurrence = date ?? routineOccurrences(rule, formatDay(routine.startDate), routineToday()).current;
  if (!occurrence) throw clientError('BAD_USER_INPUT', 'Cette routine n’a pas encore commencé.');
  if (occurrence > routineToday()) throw clientError('BAD_USER_INPUT', 'Une occurrence à venir ne peut pas être cochée.');
  const key = { routineId_date: { routineId: id, date: parseDay(occurrence) } };
  if (done) await prisma.routineCheck.upsert({ where: key, create: { routineId: id, date: parseDay(occurrence) }, update: {} });
  else await prisma.routineCheck.deleteMany({ where: { routineId: id, date: parseDay(occurrence) } });
  return occurrence;
}
