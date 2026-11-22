import { TASK_INHERITED_COLUMNS, marksInherited, taskNumbered, type TaskInheritableField } from '@ordo/shared';
import { inheritedRow, originOf } from '../../../components/inheritance/inheritance';
import type { InheritableFieldOption } from '../../../components/inheritance/InheritanceForm';
import type { InheritedFieldState } from '../../../components/inheritance/InheritedField';
import type { TaskFieldsFragment } from '../../../graphql/graphql';
import type { TaskInputValues } from '../api';

/** Name of each inherited field of a task, in the « Héritage » form. */
export const TASK_FIELD_LABELS: Record<TaskInheritableField, string> = {
  PROJECT: 'Projet',
  PRIORITY: 'Priorité',
  MILESTONE: 'Jalon',
  ASSIGNEES: 'Assignés',
  BENEFICIARIES: 'Bénéficiaires',
  MIN_DATE: 'Ouverture',
  DEADLINE: 'Échéance',
  SLOT_CONDITION: 'Créneaux',
  HOURS: 'Horaires',
  LOCATION: 'Lieu',
};

/** Inherited fields of a task offered by « Héritage… » (its project is never emptied). */
export const TASK_INHERITANCE_OPTIONS: InheritableFieldOption<TaskInheritableField>[] = (Object.keys(TASK_FIELD_LABELS) as TaskInheritableField[]).map((field) => ({
  field,
  label: TASK_FIELD_LABELS[field],
  required: field === 'PROJECT',
}));

/** Inherited field shown by each column of the task table. */
export const TASK_CELL_FIELDS: Partial<Record<string, TaskInheritableField>> = {
  project: 'PROJECT',
  priority: 'PRIORITY',
  milestone: 'MILESTONE',
  assignees: 'ASSIGNEES',
  beneficiaries: 'BENEFICIARIES',
  minDate: 'MIN_DATE',
  deadline: 'DEADLINE',
  slots: 'SLOT_CONDITION',
  location: 'LOCATION',
};

/**
 * Task as the screens read it: each inherited field takes the value it goes by (`effective`), so
 * its cells, panel, filters, sorts, groups and exports show what it follows; an inherited « Ouverture » or « Échéance »
 * holds its parent's (one from its milestone, project or sprint stays shown in place, `inheritedDateHint`).
 * @param {TaskFieldsFragment} task Task as the API gives it.
 * @returns {TaskFieldsFragment} Task.
 */
export function taskRow(task: TaskFieldsFragment): TaskFieldsFragment {
  const row = inheritedRow(task, TASK_INHERITED_COLUMNS as Partial<Record<string, readonly (keyof TaskFieldsFragment)[]>>);
  const fromParent = (field: 'MIN_DATE' | 'DEADLINE') => originOf(task, field)?.source === 'PARENT';
  // eslint-disable-next-line no-restricted-syntax -- taskRow itself: the dates its parent goes by.
  const { minDate, deadline } = task.effective;
  return {
    ...row,
    ...(marksInherited(task, 'MIN_DATE') && { minDate: fromParent('MIN_DATE') ? minDate : null }),
    ...(marksInherited(task, 'DEADLINE') && { deadline: fromParent('DEADLINE') ? deadline : null }),
  };
}

/**
 * State and actions of an inherited field of a task in its panel (`InheritedField`): « Vider » (`clear`) and
 * « Rétablir l'héritage » (`inherit`), saved at once as every field of the panel.
 * @param {TaskFieldsFragment} task Task.
 * @param {TaskInheritableField} field Field.
 * @param {(input: Omit<TaskInputValues, 'projectId'>) => void} save Saves a change of the task.
 * @returns {InheritedFieldState} State.
 */
export function taskFieldState(task: TaskFieldsFragment, field: TaskInheritableField, save: (input: Omit<TaskInputValues, 'projectId'>) => void): InheritedFieldState {
  return {
    origin: originOf(task, field),
    onClear: field === 'PROJECT' ? undefined : () => save({ clear: [field] }),
    onInherit: () => save({ inherit: [field] }),
  };
}

/**
 * Name of the parent of a task, as its inherited fields mention it (« Hérité de « #12 Écrire le devis » »).
 * @param {{ parentId: string | null }} task Task.
 * @param {ReadonlyMap<string, { number: number | null, label: string }>} taskById Tasks by id.
 * @returns {string} Name (« la tâche parente » when it is not loaded).
 */
export function taskParentName(task: { parentId: string | null }, taskById: ReadonlyMap<string, { number: number | null; label: string }>): string {
  const parent = task.parentId ? taskById.get(task.parentId) : undefined;
  return parent ? `« ${taskNumbered(parent)} »` : 'la tâche parente';
}
