import { changedInheritance, effectiveRoutine, routineFieldsGiven, marksInherited, ROUTINE_INHERITABLE_FIELDS, ROUTINE_REQUIRED_FIELDS, type EffectiveRoutine, type RoutineInheritableField, type RoutineMove } from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma, type Routine } from '../../generated/prisma/client';
import { fieldError } from '../../graphql/errors';
import { toJson } from '../core/json';
import { connectIds } from '../core/relations';

/** People and categories of a routine its inheritance reads (a Prisma include). */
const INHERITED_LINKS = {
  assignees: { select: { id: true } },
  beneficiaries: { select: { id: true } },
  beneficiaryRelations: { select: { id: true } },
  categories: { select: { id: true } },
} as const;

/** Stored routine with the ids of its people and categories, as its inheritance reads it. */
export type StoredInheritingRoutine = Routine & {
  assigneeIds: string[];
  beneficiaryIds: string[];
  beneficiaryRelationIds: string[];
  categoryIds: string[];
};

/**
 * Every routine of the current workspace (archived ones too: a parent archived still gives its values), by id, for
 * `effectiveRoutine`.
 * @returns {Promise<Map<string, StoredInheritingRoutine>>} Routines.
 */
export async function loadRoutineInheritance(): Promise<Map<string, StoredInheritingRoutine>> {
  const rows = await prisma.routine.findMany({ include: INHERITED_LINKS });
  const ids = (items: { id: string }[]) => items.map((item) => item.id);
  return new Map(
    rows.map(({ assignees, beneficiaries, beneficiaryRelations, categories, ...row }) => [
      row.id,
      { ...row, assigneeIds: ids(assignees), beneficiaryIds: ids(beneficiaries), beneficiaryRelationIds: ids(beneficiaryRelations), categoryIds: ids(categories) },
    ]),
  );
}

/**
 * Effective routine of an id (`effectiveRoutine`): the stored row, each inherited field from its parent; none for a
 * routine missing.
 * @param {ReadonlyMap<string, StoredInheritingRoutine>} byId Loaded routines.
 * @param {string} id Routine.
 * @returns {EffectiveRoutine<StoredInheritingRoutine> | null} Routine as it goes.
 */
export function effectiveRoutineOf(byId: ReadonlyMap<string, StoredInheritingRoutine>, id: string): EffectiveRoutine<StoredInheritingRoutine> | null {
  const routine = byId.get(id);
  return routine ? effectiveRoutine(routine, byId) : null;
}

/**
 * Inherited list of a routine once changed by a partial input: fields set to inherit, those given a value or emptied
 * left out; none without parent.
 * @param {readonly string[]} current Fields it inherits now.
 * @param {{ inherit?: readonly RoutineInheritableField[] | null, clear?: readonly RoutineInheritableField[] | null, input: object, hasParent: boolean }} change Change.
 * @returns {RoutineInheritableField[]} Fields inherited.
 */
export function changedRoutineInheritance(
  current: readonly string[],
  change: { inherit?: readonly RoutineInheritableField[] | null; clear?: readonly RoutineInheritableField[] | null; input: object; hasParent: boolean },
): RoutineInheritableField[] {
  return changedInheritance(current, { inherit: change.inherit, own: [...routineFieldsGiven(change.input), ...(change.clear ?? [])], hasParent: change.hasParent, fields: ROUTINE_INHERITABLE_FIELDS });
}

/**
 * Values of a routine input emptying fields on purpose (« Vider »). Its first time and its repetition
 * cannot be emptied; its exceptions are not in its input (`clearedMoves`).
 * @param {readonly RoutineInheritableField[] | null | undefined} fields Fields emptied.
 * @returns {Record<string, unknown>} Input values.
 */
export function clearedRoutineInput(fields: readonly RoutineInheritableField[] | null | undefined): Record<string, unknown> {
  const cleared = new Set(fields ?? []);
  if (ROUTINE_REQUIRED_FIELDS.some((field) => cleared.has(field))) throw fieldError('clear', 'La première fois et la répétition d’une routine ne se vident pas : donnez-lui les siennes ou rétablissez l’héritage.');
  return {
    ...(cleared.has('PROJECT') && { projectId: null }),
    ...(cleared.has('ASSIGNEES') && { assigneeIds: [] }),
    ...(cleared.has('BENEFICIARIES') && { beneficiaryIds: [], beneficiaryRelationIds: [] }),
    ...(cleared.has('SLOT_CONDITION') && { slotCondition: null }),
    ...(cleared.has('OPENS_ON') && { opensOn: null }),
    ...(cleared.has('LOCATION') && { location: null, locationLat: null, locationLon: null }),
    ...(cleared.has('CATEGORIES') && { categoryIds: [] }),
    ...(cleared.has('CASES') && { cases: [] }),
    ...(cleared.has('MOMENTS') && { moments: [], fromTime: null, dueTime: null }),
  };
}

/**
 * Data saving exceptions of a routine given on it (an occurrence moved, cancelled or given back): they are its own from
 * then on, even when it inherited its parent's (those it went by are the base of the change).
 * @param {{ inheritedFields: readonly string[] }} routine Routine (its stored list).
 * @param {readonly RoutineMove[]} moves Its exceptions now.
 * @returns {{ moves: Prisma.InputJsonValue, inheritedFields: string[] }} Prisma data.
 */
export function withOwnMoves(routine: { inheritedFields: readonly string[] }, moves: readonly RoutineMove[]): { moves: Prisma.InputJsonValue; inheritedFields: string[] } {
  return { moves: toJson(moves), inheritedFields: routine.inheritedFields.filter((field) => field !== 'MOVES') };
}

/**
 * Before routines lose their parent (made top-level, parent deleted): each field they inherit becomes their own, with
 * the value they went by (nothing changes for the user), and they inherit nothing more.
 * @param {readonly string[]} ids Routines.
 * @returns {Promise<void>}
 */
export async function freezeRoutineInheritance(ids: readonly string[]): Promise<void> {
  const inheriting = await prisma.routine.findMany({ where: { id: { in: [...ids] }, NOT: { inheritedFields: { isEmpty: true } } }, select: { id: true } });
  if (!inheriting.length) return;
  const byId = await loadRoutineInheritance();
  const json = (value: unknown) => (value === null ? Prisma.DbNull : toJson(value));
  await prisma.$transaction(
    inheriting.map(({ id }) => {
      const { routine } = effectiveRoutineOf(byId, id)!;
      const inherited = new Set(byId.get(id)!.inheritedFields);
      return prisma.routine.update({
        where: { id },
        data: {
          inheritedFields: [],
          ...(inherited.has('PROJECT') && { projectId: routine.projectId }),
          ...(inherited.has('ASSIGNEES') && { assignees: { set: connectIds(routine.assigneeIds) } }),
          ...(inherited.has('BENEFICIARIES') && { beneficiaries: { set: connectIds(routine.beneficiaryIds) }, beneficiaryRelations: { set: connectIds(routine.beneficiaryRelationIds) } }),
          ...(inherited.has('CATEGORIES') && { categories: { set: connectIds(routine.categoryIds) } }),
          ...(inherited.has('SLOT_CONDITION') && { slotCondition: json(routine.slotCondition), scheduleIds: routine.scheduleIds, excludedScheduleIds: routine.excludedScheduleIds }),
          ...(inherited.has('OPENS_ON') && { opensOn: json(routine.opensOn) }),
          ...(inherited.has('LOCATION') && { location: routine.location, locationLat: routine.locationLat, locationLon: routine.locationLon }),
          ...(inherited.has('START_DATE') && { startDate: routine.startDate }),
          ...(inherited.has('RECURRENCE') && { recurrence: toJson(routine.recurrence), scheduleId: routine.scheduleId, scheduleAnchor: routine.scheduleAnchor }),
          ...(inherited.has('CASES') && { cases: toJson(routine.cases) }),
          ...(inherited.has('MOMENTS') && { moments: toJson(routine.moments), fromTime: routine.fromTime, dueTime: routine.dueTime }),
          ...(inherited.has('MOVES') && { moves: toJson(routine.moves) }),
        },
      });
    }),
  );
}

/**
 * Keeps the stored project of the routines inheriting it equal to their effective one (a project inherited is stored
 * too: tracked time, links in the project tree), after a change of project up their chain.
 * @returns {Promise<string[]>} Routines whose project changed.
 */
export async function syncInheritedRoutineProjects(): Promise<string[]> {
  const byId = await loadRoutineInheritance();
  const changed = [...byId.values()].flatMap((stored) => {
    if (!marksInherited(stored, 'PROJECT')) return [];
    const { routine } = effectiveRoutineOf(byId, stored.id)!;
    return routine.projectId !== stored.projectId ? [{ id: stored.id, projectId: routine.projectId }] : [];
  });
  if (changed.length) await prisma.$transaction(changed.map((item) => prisma.routine.update({ where: { id: item.id }, data: { projectId: item.projectId } })));
  return changed.map((item) => item.id);
}
