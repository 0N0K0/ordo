import { Stack } from '@mantine/core';
import { countBy, TASK_STATUS_CATEGORY_LABELS } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useTasksData } from '../api';
import { useTaskLabelItems, useTaskStatusItems } from '../hooks/use-label-items';
import { ColumnDefaults } from './ColumnDefaults';
import { LightningIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { TASK_AUTOMATIONS_PATH } from '../../../app/pages';
import { PriorityTypeSettings } from './PriorityTypeSettings';

/**
 * Settings of tasks: statuses (with their category), priorities and types (shared with the routines: their uses count
 * both), tags, the button of the page of their automations, then the columns of new views.
 * @returns {JSX.Element} Settings.
 */
export function TaskSettings() {
  const { data } = useTasksData();
  const statuses = useTaskStatusItems();
  const tags = useTaskLabelItems('tag');
  const tasks = data?.tasks ?? [];

  // In the settings sidebar: the sections one under the other, the whole width.
  return (
    <Stack gap="md">
      <SettingsList
        {...statuses}
        title="Statuts de tâche"
        description="La catégorie donne son sens au statut quel que soit son libellé (filtres, tâches « en cours » de l’accueil). Un statut ne ferme ni ne rouvre une tâche : on la ferme comme terminée ou comme annulée ; les automatisations peuvent lier le statut « Annulé » à l’annulation."
        noun="le statut"
        usageNoun={{ one: 'de la tâche', many: 'tâches' }}
        items={data?.taskStatuses ?? []}
        usage={countBy(tasks, (task) => (task.statusId ? [task.statusId] : []))}
        renderBadges={(status) => TASK_STATUS_CATEGORY_LABELS.status[status.category]}
      />
      <PriorityTypeSettings />
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
      <SettingsSection
        title="Automatisations"
        description="Des règles « quand … alors … » pour toutes les tâches de l’espace : quand le début est renseigné, le statut passe à « En cours »…"
        actions={
          <ActionButton icon={<LightningIcon aria-hidden />} to={TASK_AUTOMATIONS_PATH}>
            Gérer les règles
          </ActionButton>
        }
      />
      {/* Last: the columns of new views (a long list). */}
      <ColumnDefaults />
    </Stack>
  );
}
