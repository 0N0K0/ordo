import { DEFAULT_RECURRENCE, recurrenceSchema, routineState, type Recurrence, type RoutineState } from '@ordo/shared';
import { categoryTree } from '../../components/category-tree/category-tree';
import type { Routine, RoutineCategory } from './api';

/** Rule of a new routine: every day. */
export const DAILY: Recurrence = { ...DEFAULT_RECURRENCE, frequency: 'DAILY' };

/** Key of the rows without category. */
export const NO_CATEGORY = 'none';

/**
 * Stored rule of a routine, or null when invalid.
 * @param {Routine} routine Routine.
 * @returns {Recurrence | null} Rule.
 */
export function ruleOf(routine: Routine): Recurrence | null {
  const parsed = recurrenceSchema.safeParse(routine.recurrence);
  return parsed.success ? parsed.data : null;
}

/**
 * Whether the current occurrence of a routine is ticked.
 * @param {Routine} routine Routine.
 * @returns {boolean} Done.
 */
export const isDone = (routine: Routine) => routine.currentDate !== null && routine.doneDates.includes(routine.currentDate);

/**
 * State of a routine today.
 * @param {Routine} routine Routine.
 * @param {string} today Today.
 * @returns {RoutineState} State.
 */
export const stateOf = (routine: Routine, today: string): RoutineState => routineState(routine.currentDate, isDone(routine), today);

/**
 * Required routines of a routine still to do for their current occurrence ("étendre le linge" waits for "laver le linge").
 * @param {Routine} routine Routine.
 * @param {Map<string, Routine>} byId Routines by id.
 * @returns {Routine[]} Routines it waits for.
 */
export function waitingFor(routine: Routine, byId: Map<string, Routine>): Routine[] {
  return routine.requiredIds.flatMap((id) => {
    const required = byId.get(id);
    return required && !required.archived && required.currentDate !== null && !isDone(required) ? [required] : [];
  });
}

/** Row of the routine table: a category heading, or a routine under it (sub-routines under their parent). */
export type RoutineRow =
  | {
      kind: 'group';
      /** Category id, null for the routines without one. */
      id: string | null;
      name: string;
      color: string | null;
      depth: number;
      /** Ids of the categories above it. */
      parents: string[];
      /** Routines in it and in its sub-categories. */
      routines: Routine[];
    }
  | {
      kind: 'routine';
      routine: Routine;
      depth: number;
      /** Category it is shown in (the one of its top routine), null for none. */
      groupId: string | null;
      /** Ids of the categories and routines above it (folding one hides it). */
      parents: string[];
      /** Number of sub-routines shown. */
      children: number;
    };

/**
 * Rows of the table: the categories as their tree, each followed by its routines; a sub-routine follows its parent
 * (whatever its own category), indented. Categories without routine are left out. The routines kept by `keep` stay
 * with their parents (shown for their place).
 * @param {Routine[]} routines Routines, in their order.
 * @param {RoutineCategory[]} categories Categories.
 * @param {(routine: Routine) => boolean} keep Routines shown.
 * @returns {RoutineRow[]} Rows.
 */
export function routineRows(routines: Routine[], categories: RoutineCategory[], keep: (routine: Routine) => boolean): RoutineRow[] {
  const ids = new Set(routines.map((routine) => routine.id));
  const children = new Map<string | null, Routine[]>();
  for (const routine of routines) {
    const parent = routine.parentId && ids.has(routine.parentId) ? routine.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), routine]);
  }
  // A routine is shown when kept, or when one of its sub-routines is.
  const shown = new Map<string, boolean>();
  /**
   * Whether a routine or one of its sub-routines is kept.
   * @param {Routine} routine Routine.
   * @returns {boolean} Shown.
   */
  const isShown = (routine: Routine): boolean => {
    const known = shown.get(routine.id);
    if (known !== undefined) return known;
    shown.set(routine.id, false);
    const value = keep(routine) || (children.get(routine.id) ?? []).some(isShown);
    shown.set(routine.id, value);
    return value;
  };
  const tops = (children.get(null) ?? []).filter(isShown);
  const known = new Set(categories.map((category) => category.id));
  const groupOf = (routine: Routine) => (routine.categoryId && known.has(routine.categoryId) ? routine.categoryId : null);

  /**
   * Rows of a routine and of its sub-routines.
   * @param {Routine} routine Routine.
   * @param {number} depth Its depth.
   * @param {string | null} groupId Category shown in.
   * @param {string[]} parents Ids above it.
   * @returns {RoutineRow[]} Rows.
   */
  const branch = (routine: Routine, depth: number, groupId: string | null, parents: string[]): RoutineRow[] => {
    const kids = (children.get(routine.id) ?? []).filter(isShown);
    return [{ kind: 'routine', routine, depth, groupId, parents, children: kids.length }, ...kids.flatMap((kid) => branch(kid, depth + 1, groupId, [...parents, routine.id]))];
  };
  /**
   * Every routine of a branch.
   * @param {Routine} routine Routine.
   * @returns {Routine[]} It and its shown sub-routines.
   */
  const flatten = (routine: Routine): Routine[] => [routine, ...(children.get(routine.id) ?? []).filter(isShown).flatMap(flatten)];

  const placed = categoryTree(categories);
  const parentsOf = new Map<string, string[]>();
  for (const item of placed)
    parentsOf.set(item.category.id, item.category.parentId && known.has(item.category.parentId) ? [...(parentsOf.get(item.category.parentId) ?? []), item.category.parentId] : []);
  const rows: RoutineRow[] = [];
  for (const item of placed) {
    const subtree = new Set([item.category.id, ...placed.filter((other) => parentsOf.get(other.category.id)?.includes(item.category.id)).map((other) => other.category.id)]);
    const inside = tops.filter((routine) => subtree.has(groupOf(routine) ?? ''));
    if (inside.length === 0) continue;
    const parents = parentsOf.get(item.category.id) ?? [];
    rows.push({ kind: 'group', id: item.category.id, name: item.category.name, color: item.color, depth: item.depth, parents, routines: inside.flatMap(flatten) });
    for (const routine of tops.filter((top) => groupOf(top) === item.category.id)) rows.push(...branch(routine, item.depth + 1, item.category.id, [...parents, item.category.id]));
  }
  const loose = tops.filter((routine) => groupOf(routine) === null);
  if (loose.length) {
    // Without any category heading above, the routines without category need none either.
    const grouped = rows.length > 0;
    if (grouped) rows.push({ kind: 'group', id: null, name: 'Sans catégorie', color: null, depth: 0, parents: [], routines: loose.flatMap(flatten) });
    for (const routine of loose) rows.push(...branch(routine, grouped ? 1 : 0, null, grouped ? [NO_CATEGORY] : []));
  }
  return rows;
}

/**
 * Rows left once the folded categories and routines hide what is under them.
 * @param {RoutineRow[]} rows Rows.
 * @param {ReadonlySet<string>} folded Folded category ids (NO_CATEGORY for the one without) and routine ids.
 * @returns {RoutineRow[]} Rows shown.
 */
export function visibleRoutineRows(rows: RoutineRow[], folded: ReadonlySet<string>): RoutineRow[] {
  return rows.filter((row) => !row.parents.some((id) => folded.has(id)));
}
