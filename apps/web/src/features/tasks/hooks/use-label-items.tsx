import { Select } from '@mantine/core';
import { labelFormSchema, TASK_STATUS_CATEGORIES, TASK_STATUS_CATEGORY_LABELS, type TaskStatusCategory } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { useTaskLabelMutations, type TaskLabel, type TaskLabelKind, type TaskStatus } from '../api';

/** Categories of a status, in its form. */
const STATUS_CATEGORY_OPTIONS: { value: TaskStatusCategory; label: string }[] = TASK_STATUS_CATEGORIES.map((value) => ({ value, label: TASK_STATUS_CATEGORY_LABELS.status[value] }));

/** Settings lists of the task labels (the status has its category). */
const LIST_KINDS = { status: 'TASK_STATUS', priority: 'TASK_PRIORITY', type: 'TASK_TYPE', tag: 'TASK_TAG' } as const;

/**
 * Statuses of the tasks, for their settings list and their form (a creation from a select too): name, color, image and
 * category.
 * @returns {SettingsItemKind<TaskStatus, { category: TaskStatusCategory }> & { remove: (id: string) => Promise<unknown> }} List and form, and the deletion.
 */
export function useTaskStatusItems(): SettingsItemKind<TaskStatus, { category: TaskStatusCategory }> & { remove: (id: string) => Promise<unknown> } {
  const statuses = useTaskLabelMutations('status');
  return {
    kind: 'TASK_STATUS',
    schema: labelFormSchema,
    extra: {
      initial: (status) => ({ category: status?.category ?? 'TODO' }),
      render: (form) => <Select label="Catégorie" data={STATUS_CATEGORY_OPTIONS} allowDeselect={false} {...form.getInputProps('category')} />,
    },
    ...listMutations(statuses, (values: { label: string; color: string; category: TaskStatusCategory }) => ({ label: values.label, color: values.color, category: values.category })),
  };
}

/**
 * Priorities, types or tags of the tasks, for their settings list and their form (a creation from a select too): name,
 * color and image.
 * @param {Exclude<TaskLabelKind, 'status'>} kind Kind of label.
 * @returns {SettingsItemKind<TaskLabel> & { remove: (id: string) => Promise<unknown> }} List and form, and the deletion.
 */
export function useTaskLabelItems(kind: Exclude<TaskLabelKind, 'status'>): SettingsItemKind<TaskLabel> & { remove: (id: string) => Promise<unknown> } {
  const mutations = useTaskLabelMutations(kind);
  return { kind: LIST_KINDS[kind], schema: labelFormSchema, ...listMutations(mutations) };
}
