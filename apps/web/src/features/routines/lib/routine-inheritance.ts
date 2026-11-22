import { ROUTINE_INHERITED_COLUMNS, ROUTINE_REQUIRED_FIELDS, ROUTINE_WHEN_FIELDS, marksInherited, type RoutineInheritableField, type RoutineSlot } from '@ordo/shared';
import { inheritedRow } from '../../../components/inheritance/inheritance';
import type { InheritableFieldOption } from '../../../components/inheritance/InheritanceForm';
import type { RoutinesDataQuery } from '../../../graphql/graphql';

type RoutineRow = RoutinesDataQuery['routines'][number];

/** Name of each inherited field of a routine. */
export const ROUTINE_FIELD_LABELS: Record<RoutineInheritableField, string> = {
  PROJECT: 'Projet',
  CATEGORIES: 'Catégories',
  PRIORITY: 'Priorité',
  ASSIGNEES: 'Assignés',
  BENEFICIARIES: 'Bénéficiaires',
  LOCATION: 'Lieu',
  SLOT_CONDITION: 'Créneaux',
  OPENS_ON: 'Ouverture',
  START_DATE: 'première fois',
  RECURRENCE: 'répétition',
  CASES: 'cas',
  MOMENTS: 'moments',
  MOVES: 'exceptions',
};

/** Name of each inherited field of a routine as a label of its own (« Héritage… »). */
const ROUTINE_OPTION_LABELS = Object.fromEntries(Object.entries(ROUTINE_FIELD_LABELS).map(([field, label]) => [field, label.charAt(0).toUpperCase() + label.slice(1)])) as Record<
  RoutineInheritableField,
  string
>;

/**
 * Inherited fields of a routine offered by « Héritage… » (rows checked, row menu, menu of its panel): every one, its
 * « quand » too (first time, repetition, cases, moments, exceptions, condition, « Ouverture »: the occurrences that
 * disappear with it are confirmed, as for any change of it); the first time and the repetition are never emptied.
 */
export const ROUTINE_INHERITANCE_OPTIONS: InheritableFieldOption<RoutineInheritableField>[] = (
  ['PROJECT', 'CATEGORIES', 'PRIORITY', 'ASSIGNEES', 'BENEFICIARIES', 'LOCATION', 'SLOT_CONDITION', 'OPENS_ON', 'START_DATE', 'RECURRENCE', 'CASES', 'MOMENTS', 'MOVES'] as const
).map((field) => ({
  field,
  label: ROUTINE_OPTION_LABELS[field],
  required: ROUTINE_REQUIRED_FIELDS.includes(field),
}));

/** Fields of the « Répétition et moments » of a routine, shown and given back together in its panel (its first time apart). */
export const ROUTINE_REPETITION_FIELDS: readonly RoutineInheritableField[] = [...ROUTINE_WHEN_FIELDS.filter((field) => field !== 'MOVES' && field !== 'START_DATE'), 'SLOT_CONDITION'];

/** Fields of the form « Répétition et moments » changes in the panel (its first time apart), saved together. */
export const ROUTINE_REPETITION_KEYS = ['recurrence', 'cases', 'slotCondition', 'moments', 'opensOn'] as const;

/** Inherited field shown by each column of the routine table. */
export const ROUTINE_CELL_FIELDS: Partial<Record<string, RoutineInheritableField>> = {
  project: 'PROJECT',
  categories: 'CATEGORIES',
  priority: 'PRIORITY',
  assignees: 'ASSIGNEES',
  beneficiaries: 'BENEFICIARIES',
  location: 'LOCATION',
  slots: 'SLOT_CONDITION',
  opensOn: 'OPENS_ON',
  startDate: 'START_DATE',
  repetition: 'RECURRENCE',
  fromTime: 'MOMENTS',
  dueTime: 'MOMENTS',
};

/**
 * Routine as the screens read it: each inherited field takes the value it goes by (`effective`),
 * its window that of its first moment, so its cells, panel, filters, sorts, groups and exports show what it follows.
 * Its occurrences (state, due dates, ticks, agenda) are those the API computes from the same « quand ».
 * @param {RoutineRow} routine Routine as the API gives it.
 * @returns {RoutineRow} Routine.
 */
export function routineRow(routine: RoutineRow): RoutineRow {
  const row = inheritedRow(routine, ROUTINE_INHERITED_COLUMNS as Partial<Record<string, readonly (keyof RoutineRow)[]>>);
  if (!marksInherited(routine, 'MOMENTS')) return row;
  // eslint-disable-next-line no-restricted-syntax -- routineRow itself: the moments it goes by.
  const first = (routine.effective.moments as RoutineSlot[] | null)?.[0];
  return { ...row, fromTime: first?.fromTime ?? null, dueTime: first?.dueTime ?? null };
}

/**
 * Name of the parent of a routine, as its inherited fields mention it (« Hérité de « Ménage » »).
 * @param {{ parentId: string | null }} routine Routine.
 * @param {ReadonlyMap<string, { label: string }>} byId Routines by id.
 * @returns {string} Name (« la routine parente » when it is not loaded).
 */
export function routineParentName(routine: { parentId: string | null }, byId: ReadonlyMap<string, { label: string }>): string {
  const parent = routine.parentId ? byId.get(routine.parentId) : undefined;
  return parent ? `« ${parent.label} »` : 'la routine parente';
}
