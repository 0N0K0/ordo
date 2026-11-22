import { emptyInheritedFields, inheritanceChain, inheritedFieldsGiven, marksInherited, resolveInheritance, type FieldOrigin, type InheritedColumns, type InheritingItem } from '../core/inheritance';

/**
 * Fields a sub-routine inherits from its parent: project, assignees, beneficiaries (people and
 * relations), slot condition, « Ouverture », place (not the travel times), categories, priority (as a sub-task; not its
 * type), and its « quand »: first time, repetition, cases, times of the day, exceptions.
 */
export const ROUTINE_INHERITABLE_FIELDS = [
  'PROJECT',
  'ASSIGNEES',
  'BENEFICIARIES',
  'SLOT_CONDITION',
  'OPENS_ON',
  'LOCATION',
  'CATEGORIES',
  'PRIORITY',
  'START_DATE',
  'RECURRENCE',
  'CASES',
  'MOMENTS',
  'MOVES',
] as const;
export type RoutineInheritableField = (typeof ROUTINE_INHERITABLE_FIELDS)[number];

/** Fields of the « quand » of a routine (their occurrences follow them): never emptied (first time, repetition), or a rule of their own. */
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
  priorityId: string | null;
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
  PRIORITY: ['priorityId'],
  START_DATE: ['startDate'],
  RECURRENCE: ['recurrence', 'scheduleId', 'scheduleAnchor'],
  CASES: ['cases'],
  MOMENTS: ['moments', 'fromTime', 'dueTime'],
  MOVES: ['moves'],
};

/**
 * Fields its occurrences are computed from: its « quand » and its slot condition (which keeps the occurrences its
 * moments are allowed on).
 */
export const ROUTINE_TIMING_FIELDS: readonly RoutineInheritableField[] = [...ROUTINE_WHEN_FIELDS, 'SLOT_CONDITION'];

/** Columns of the fields its occurrences are computed from. */
const ROUTINE_TIMING_COLUMNS = Object.fromEntries(ROUTINE_TIMING_FIELDS.map((field) => [field, ROUTINE_INHERITED_COLUMNS[field]])) as InheritedColumns<InheritingRoutine, RoutineInheritableField>;

/** Routine as its occurrences read it: its id, parent and inherited list (absent: its own columns only). */
export interface TimedRoutine {
  id?: string;
  parentId?: string | null;
  inheritedFields?: readonly string[];
}

/**
 * Whether a routine takes some of the fields its occurrences are computed from from its parent.
 * @param {TimedRoutine} routine Routine.
 * @returns {boolean} Some inherited.
 */
export function inheritsTiming(routine: TimedRoutine): routine is TimedRoutine & { id: string; inheritedFields: readonly string[] } {
  const listed = routine.inheritedFields;
  return Boolean(routine.id) && listed !== undefined && ROUTINE_TIMING_FIELDS.some((field) => marksInherited({ parentId: routine.parentId, inheritedFields: listed }, field));
}

/**
 * Routine as its occurrences go: each field of its « quand » and its slot condition it inherits taken from the routine
 * it goes by, live, up the chain (`resolveInheritance`, as `effectiveRoutine`); its other columns as given. The one
 * resolution every computation of its occurrences reads (API: agenda, « à faire », state, ticks, reminders, losses);
 * a routine inheriting none of them is given back as it is. The row given may be a routine as a change would leave it
 * (its parent and its list then those of the change).
 * @param {T} routine Routine (stored row, or as changed).
 * @param {ReadonlyMap<string, InheritingRoutine>} byId Routines of the workspace by id (its ancestors among them).
 * @returns {T} Routine as its occurrences go.
 */
export function effectiveRoutineTiming<T extends TimedRoutine>(routine: T, byId: ReadonlyMap<string, InheritingRoutine>): T {
  if (!inheritsTiming(routine)) return routine;
  const { effective } = resolveInheritance(routine as unknown as InheritingRoutine, byId, ROUTINE_TIMING_COLUMNS);
  return effective as unknown as T;
}

/**
 * Routines whose occurrences a change of the « quand » or condition of some routines changes: those routines, and each
 * routine taking one of these fields from them through its chain of parents.
 * @param {readonly string[]} ids Routines changed.
 * @param {ReadonlyMap<string, InheritingRoutine>} byId Routines of the workspace by id.
 * @returns {string[]} Ids, those changed first.
 */
export function timingHeirs(ids: readonly string[], byId: ReadonlyMap<string, InheritingRoutine>): string[] {
  const changed = new Set(ids);
  const heirs = [...byId.values()].filter(
    (routine) => !changed.has(routine.id) && ROUTINE_TIMING_FIELDS.some((field) => inheritanceChain(routine, field, byId).slice(1).some((item) => changed.has(item.id))),
  );
  return [...changed, ...heirs.map((routine) => routine.id)];
}

/** Routine as it goes: its effective values (same shape), and the state and source of each inherited field. */
export interface EffectiveRoutine<T extends InheritingRoutine> {
  routine: T;
  origins: FieldOrigin<RoutineInheritableField>[];
}

/**
 * Routine as it goes: each inherited field from its parent, live, up the chain (cycle-safe); its own
 * value otherwise. The only computation of the inheritance of a routine, for the API (and its occurrences) and
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
  PRIORITY: ['priorityId'],
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
 * Fields of its « quand » a routine placed under a parent after the fact never takes when empty: its first time and
 * its repetition are never empty; no case means it follows its own repetition, no moment one moment without hours, and
 * no exception none on the days of its own rule. Its « Ouverture », none, is taken as any empty field.
 */
const NEVER_ADOPTED: readonly RoutineInheritableField[] = ['START_DATE', 'RECURRENCE', 'CASES', 'MOMENTS', 'MOVES'];

/**
 * Fields of a top-level routine without any value of its own: those it inherits once placed under a parent after the
 * fact, as a new sub-routine does; its own values stay. Its « quand » is left out (`NEVER_ADOPTED`), its « Ouverture »
 * aside.
 * @param {InheritingRoutine} routine Routine (its own values).
 * @returns {RoutineInheritableField[]} Fields.
 */
export function emptyRoutineFields(routine: InheritingRoutine): RoutineInheritableField[] {
  const columns = Object.fromEntries(Object.entries(ROUTINE_INHERITED_COLUMNS).filter(([field]) => !NEVER_ADOPTED.includes(field as RoutineInheritableField)));
  return emptyInheritedFields<InheritingRoutine, RoutineInheritableField>(routine, columns);
}
