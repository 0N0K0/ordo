import { Select } from '@mantine/core';
import { ArrowCounterClockwiseIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { agreed, countOf, labelFormSchema, plural, statusClosing, TASK_STATUS_CATEGORIES, TASK_STATUS_CATEGORY_LABELS, type TaskStatusCategory } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { confirmedDestructive } from '../../../components/dialogs/confirm-destructive';
import { useTaskLabelMutations, useTasksData, type TaskLabel, type TaskLabelKind, type TaskStatus } from '../api';

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
  const { data } = useTasksData();
  const mutations = listMutations(statuses, (values: { label: string; color: string; category: TaskStatusCategory }) => ({ label: values.label, color: values.color, category: values.category }));
  return {
    kind: 'TASK_STATUS',
    schema: labelFormSchema,
    extra: {
      initial: (status) => ({ category: status?.category ?? 'TODO' }),
      render: (form) => <Select label="Catégorie" data={STATUS_CATEGORY_OPTIONS} allowDeselect={false} {...form.getInputProps('category')} />,
    },
    ...mutations,
    /**
     * Saves a status; a category to or out of « Annulé » closes or reopens its tasks (`statusClosing`),
     * confirmed first with their number.
     * @param {string} id Status.
     * @param {{ label: string, color: string, category: TaskStatusCategory }} values Form values.
     * @returns {Promise<unknown>} Saved.
     */
    update: async (id, values) => {
      const before = data?.taskStatuses.find((status) => status.id === id)?.category;
      const effect = before && before !== values.category ? statusClosing(before, values.category) : null;
      const tasks = effect ? (data?.tasks ?? []).filter((task) => task.statusId === id && task.closed === (effect === 'reopen')) : [];
      const n = tasks.length;
      if (n) {
        await confirmedDestructive({
          title: effect === 'close' ? 'Fermer ses tâches' : 'Rouvrir ses tâches',
          risks:
            effect === 'close'
              ? `Un statut « Annulé » ferme ses tâches : ${countOf(n, 'tâche')} ${agreed('ouvert', true, n)} de ce statut ${plural(n, 'sera', 'seront')} ${agreed('fermé', true, n)} et ${agreed('barré', true, n)}.`
              : `Ce statut n’est plus « Annulé » : ${countOf(n, 'tâche')} ${agreed('fermé', true, n)} de ce statut ${plural(n, 'sera', 'seront')} ${agreed('rouvert', true, n)}.`,
          confirmLabel: effect === 'close' ? 'Fermer et enregistrer' : 'Rouvrir et enregistrer',
          confirmIcon: effect === 'close' ? <CheckCircleIcon aria-hidden /> : <ArrowCounterClockwiseIcon aria-hidden />,
        });
      }
      return mutations.update(id, values);
    },
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
