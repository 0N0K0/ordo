import { emptyInheritedFields, inheritedFieldsGiven, resolveInheritance, type FieldOrigin, type InheritedColumns, type InheritingItem } from '../core/inheritance';

/**
 * Fields a sub-routine inherits from its parent (decision D11): project, assignees, beneficiaries (people and
 * relations), slot condition, « Ouverture », place (not the travel times), categories, and its « quand »: first time,
 * repetition, cases, times of the day, exceptions.
 */
export const ROUTINE_INHERITABLE_FIELDS = [
  'PROJECT',
  'ASSIGNEES',
  'BENEFICIARIES',
  'SLOT_CONDITION',
  'OPENS_ON',
  'LOCATION',
  'CATEGORIES',
  'START_DATE',
  'RECURRENCE',
  'CASES',
  'MOMENTS',
  'MOVES',
] as const;
export type RoutineInheritableField = (typeof ROUTINE_INHERITABLE_FIELDS)[number];

/** Fields of the « quand » of a routine (lot 13c wires their occurrences): never emptied (first time, repetition), or a rule of their own. */
export const ROUTINE_WHEN_FIELDS: readonly RoutineInheritableField[] = ['START_DATE', 'RECURRENCE', 'CASES', 'MOMENTS', 'MOVES', 'OPENS_ON'];

/** Inherited fields of a routine that cannot be emptied: it always has a first time and a repetition. */
export const ROUTINE_REQUIRED_FIELDS: readonly RoutineInheritableField[] = ['START_DATE', 'RECURRENCE'];

/** Routine as its inheritance reads it: the columns of its inherited fields (as stored, or as the app has them). */
export interface InheritingRoutine extends InheritingItem {
  parentId: string | null;
  projectId: string | null;
  assigneeIds: readonly string[];
  beneficiaryIds: readonly string[];
  beneficiaryRelationIds: readonly string[];
  categoryIds: readonly string[];
  slotCondition: unknown;
  /** Former form of its condition (read into it). */
  scheduleIds?: readonly string[];
  excludedScheduleIds?: readonly string[];
  opensOn: unknown;
  location: string | null;
  locationLat: number | null;
  locationLon: number | null;
  startDate: unknown;
  recurrence: unknown;
  /** Former form of its repetition: the schedule it followed. */
  scheduleId?: string | null;
  scheduleAnchor?: string | null;
  cases: unknown;
  moments: unknown;
  /** Window of its single moment (former form of its moments). */
  fromTime: string | null;
  dueTime: string | null;
  moves: unknown;
}

/** Columns of each inherited field of a routine. */
export const ROUTINE_INHERITED_COLUMNS: InheritedColumns<InheritingRoutine, RoutineInheritableField> = {
  PROJECT: ['projectId'],
  ASSIGNEES: ['assigneeIds'],
  BENEFICIARIES: ['beneficiaryIds', 'beneficiaryRelationIds'],
  SLOT_CONDITION: ['slotCondition', 'scheduleIds', 'excludedScheduleIds'],
  OPENS_ON: ['opensOn'],
  LOCATION: ['location', 'locationLat', 'locationLon'],
  CATEGORIES: ['categoryIds'],
  START_DATE: ['startDate'],
  RECURRENCE: ['recurrence', 'scheduleId', 'scheduleAnchor'],
  CASES: ['cases'],
  MOMENTS: ['moments', 'fromTime', 'dueTime'],
  MOVES: ['moves'],
};

/** Routine as it goes: its effective values (same shape), and the state and source of each inherited field. */
export interface EffectiveRoutine<T extends InheritingRoutine> {
  routine: T;
  origins: FieldOrigin<RoutineInheritableField>[];
}

/**
 * Routine as it goes (decision D11): each inherited field from its parent, live, up the chain (cycle-safe); its own
 * value otherwise. The only computation of the inheritance of a routine, for the API (and its occurrences, lot 13c) and
 * the app; the copy keeps the shape of the routine given (stored row or input), so its occurrences are computed from it.
 * @param {T} routine Routine.
 * @param {ReadonlyMap<string, T>} byId Routines of the workspace by id (its ancestors among them).
 * @returns {EffectiveRoutine<T>} Effective routine.
 */
export function effectiveRoutine<T extends InheritingRoutine>(routine: T, byId: ReadonlyMap<string, T>): EffectiveRoutine<T> {
  const { effective, origins } = resolveInheritance(routine, byId, ROUTINE_INHERITED_COLUMNS as InheritedColumns<T, RoutineInheritableField>);
  return { routine: effective, origins };
}

/** Keys of the input of a routine (one, a patch or several) that give each inherited field an own value. */
export const ROUTINE_FIELD_INPUTS: Record<RoutineInheritableField, readonly string[]> = {
  PROJECT: ['projectId'],
  ASSIGNEES: ['assigneeIds', 'addAssigneeIds', 'removeAssigneeIds'],
  BENEFICIARIES: ['beneficiaryIds', 'beneficiaryRelationIds'],
  SLOT_CONDITION: ['slotCondition'],
  OPENS_ON: ['opensOn'],
  LOCATION: ['location'],
  CATEGORIES: ['categoryIds', 'addCategoryIds', 'removeCategoryIds'],
  START_DATE: ['startDate'],
  // A repetition of its own leaves its cases too.
  RECURRENCE: ['recurrence'],
  CASES: ['cases', 'recurrence'],
  MOMENTS: ['moments', 'fromTime', 'dueTime'],
  MOVES: [],
};

/**
 * Inherited fields given an own value by a partial input of a routine (a value, null included; an empty list of ids
 * added or removed changes nothing): the API makes them own, the app shows them so at once.
 * @param {object} input Patch or changes of several routines.
 * @returns {RoutineInheritableField[]} Fields.
 */
export function routineFieldsGiven(input: object): RoutineInheritableField[] {
  return inheritedFieldsGiven(input, ROUTINE_FIELD_INPUTS);
}

/**
 * Fields of a top-level routine without any value of its own: those it inherits once placed under a parent after the
 * fact, as a new sub-routine does; its own values stay. Its « quand » is left out: it always has a
 * first time and a repetition, and an empty case list or moment list has a meaning of its own.
 * @param {InheritingRoutine} routine Routine (its own values).
 * @returns {RoutineInheritableField[]} Fields.
 */
export function emptyRoutineFields(routine: InheritingRoutine): RoutineInheritableField[] {
  const columns = Object.fromEntries(Object.entries(ROUTINE_INHERITED_COLUMNS).filter(([field]) => !ROUTINE_WHEN_FIELDS.includes(field as RoutineInheritableField)));
  return emptyInheritedFields<InheritingRoutine, RoutineInheritableField>(routine, columns);
}
