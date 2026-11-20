import { Stack } from '@mantine/core';
import { countBy, TASK_STATUS_CATEGORY_LABELS } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useTasksData } from '../api';
import { useTaskLabelItems, useTaskStatusItems } from '../hooks/use-label-items';
import { ColumnDefaults } from './ColumnDefaults';

/**
 * Settings of tasks: statuses (with their category), priorities, types and tags.
 * @returns {JSX.Element} Settings.
 */
export function TaskSettings() {
  const { data } = useTasksData();
  const statuses = useTaskStatusItems();
  const priorities = useTaskLabelItems('priority');
  const types = useTaskLabelItems('type');
  const tags = useTaskLabelItems('tag');
  const tasks = data?.tasks ?? [];

  // In the settings sidebar: the sections one under the other, the whole width.
  return (
    <Stack gap="md">
      <ColumnDefaults />
      <SettingsList
        {...statuses}
        title="Statuts de tâche"
        description="La catégorie donne son sens au statut quel que soit son libellé (filtres, tâches « en cours » de l’accueil). C’est l’état ouvert / fermé de la tâche qui dit si elle est terminée ; seul un statut « Annulé » la ferme (et la barre), le quitter la rouvre."
        noun="le statut"
        usageNoun={{ one: 'de la tâche', many: 'tâches' }}
        items={data?.taskStatuses ?? []}
        usage={countBy(tasks, (task) => (task.statusId ? [task.statusId] : []))}
        renderBadges={(status) => TASK_STATUS_CATEGORY_LABELS.status[status.category]}
      />
      <SettingsList
        {...priorities}
        title="Priorités"
        description="L’ordre est celui des listes de sélection et du tri par priorité."
        noun="la priorité"
        feminine
        usageNoun={{ one: 'de la tâche', many: 'tâches' }}
        items={data?.taskPriorities ?? []}
        usage={countBy(tasks, (task) => (task.priorityId ? [task.priorityId] : []))}
      />
      <SettingsList
        {...types}
        title="Types de tâche"
        description="Bug, fonctionnalité, amélioration…"
        noun="le type"
        usageNoun={{ one: 'de la tâche', many: 'tâches' }}
        items={data?.taskTypes ?? []}
        usage={countBy(tasks, (task) => (task.typeId ? [task.typeId] : []))}
      />
      <SettingsList
        {...tags}
        title="Étiquettes"
        description="Une tâche peut en avoir plusieurs. Synchronisées avec les labels GitHub."
        noun="l’étiquette"
        feminine
        usageNoun={{ one: 'de la tâche', many: 'tâches' }}
        items={data?.taskTags ?? []}
        usage={countBy(tasks, (task) => task.tagIds)}
      />
    </Stack>
  );
}
