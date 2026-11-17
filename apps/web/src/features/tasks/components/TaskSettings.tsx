import { Select, Stack } from '@mantine/core';
import { countBy, labelFormSchema, type TaskStatusCategory } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useTaskLabelMutations, useTasksData } from '../api';
import { ColumnDefaults } from './ColumnDefaults';

const CATEGORY_OPTIONS: { value: TaskStatusCategory; label: string }[] = [
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' },
];

/**
 * Settings of tasks: statuses (with their category), priorities, types and tags.
 * @returns {JSX.Element} Settings.
 */
export function TaskSettings() {
  const { data } = useTasksData();
  const statuses = useTaskLabelMutations('status');
  const priorities = useTaskLabelMutations('priority');
  const types = useTaskLabelMutations('type');
  const tags = useTaskLabelMutations('tag');
  const tasks = data?.tasks ?? [];

  // In the settings sidebar: the sections one under the other, the whole width.
  return (
    <Stack gap="md">
      <ColumnDefaults />
      <SettingsList<NonNullable<typeof data>['taskStatuses'][number], { category: TaskStatusCategory }>
        kind="TASK_STATUS"
        title="Statuts de tâche"
        description="La catégorie donne son sens au statut quel que soit son nom (filtres, tâches « en cours » de l’accueil). C’est l’état ouvert / fermé de la tâche, et non son statut, qui dit si elle est terminée."
        noun="le statut"
        usageNoun="tâches"
        items={data?.taskStatuses ?? []}
        usage={countBy(tasks, (task) => (task.statusId ? [task.statusId] : []))}
        schema={labelFormSchema}
        extra={{
          initial: (status) => ({ category: status?.category ?? 'TODO' }),
          render: (form) => <Select label="Catégorie" data={CATEGORY_OPTIONS} allowDeselect={false} {...form.getInputProps('category')} />,
        }}
        {...listMutations(statuses, (values: { name: string; color: string; category: TaskStatusCategory }) => ({ name: values.name, color: values.color, category: values.category }))}
        renderBadges={(status) => CATEGORY_OPTIONS.find((option) => option.value === status.category)?.label}
      />
      <SettingsList
        kind="TASK_PRIORITY"
        title="Priorités"
        description="L’ordre est celui des listes de sélection et du tri par priorité."
        noun="la priorité"
        usageNoun="tâches"
        items={data?.taskPriorities ?? []}
        usage={countBy(tasks, (task) => (task.priorityId ? [task.priorityId] : []))}
        schema={labelFormSchema}
        {...listMutations(priorities)}
      />
      <SettingsList
        kind="TASK_TYPE"
        title="Types de tâche"
        description="Bug, fonctionnalité, amélioration…"
        noun="le type"
        usageNoun="tâches"
        items={data?.taskTypes ?? []}
        usage={countBy(tasks, (task) => (task.typeId ? [task.typeId] : []))}
        schema={labelFormSchema}
        {...listMutations(types)}
      />
      <SettingsList
        kind="TASK_TAG"
        title="Étiquettes"
        description="Une tâche peut en avoir plusieurs. Synchronisées avec les labels GitHub."
        noun="l’étiquette"
        usageNoun="tâches"
        items={data?.taskTags ?? []}
        usage={countBy(tasks, (task) => task.tagIds)}
        schema={labelFormSchema}
        {...listMutations(tags)}
      />
    </Stack>
  );
}
