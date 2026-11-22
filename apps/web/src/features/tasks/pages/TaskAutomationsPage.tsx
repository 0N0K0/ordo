import { Badge, Stack } from '@mantine/core';
import { capitalize, taskAutomationTriggerSchema, TASK_AUTOMATION_CHANGE_LABELS, TASK_AUTOMATION_EVENT_LABELS, TASK_AUTOMATION_FIELD_META } from '@ordo/shared';
import { PauseIcon, PlayIcon } from '@phosphor-icons/react';
import { PAGES } from '../../../app/pages';
import { BackLink } from '../../../components/page/BackLink';
import { PageHeader } from '../../../components/page/PageHeader';
import { SettingsList } from '../../../components/settings/SettingsList';
import { ON_ERROR } from '../../../lib/notify';
import { useTaskAutomationMutations, useTaskAutomations, type TaskAutomation } from '../api/automations';
import { useTaskAutomationItems } from '../hooks/use-task-automation-items';
import { useTaskContext } from '../hooks/use-task-context';

/**
 * Trigger of a rule in a few words, after its name: « Début est renseigné », « La tâche est fermée ».
 * @param {TaskAutomation} rule Rule.
 * @returns {string} Words.
 */
function triggerText(rule: TaskAutomation): string {
  const trigger = taskAutomationTriggerSchema.safeParse(rule.trigger);
  if (!trigger.success) return '';
  const { event, field, change } = trigger.data;
  if (event !== 'FIELD_CHANGED' || !field || !change) return TASK_AUTOMATION_EVENT_LABELS[event];
  return `${capitalize(TASK_AUTOMATION_FIELD_META[field].label)} ${TASK_AUTOMATION_CHANGE_LABELS[change]}`;
}

/**
 * Automations of the tasks of the workspace (« quand … alors … »), for every task of every project: the rules in their
 * order (applied in it), each added and edited in the side panel (name, on or off, trigger, condition, actions),
 * switched on or off, reordered, archived, deleted once confirmed, as every settings list.
 * @returns {JSX.Element} Page.
 */
export function TaskAutomationsPage() {
  const { data, isPending } = useTaskAutomations();
  const { context } = useTaskContext();
  const { update, remove } = useTaskAutomationMutations();
  return (
    <Stack gap="md">
      <BackLink to={PAGES.tasks.path}>{PAGES.tasks.label}</BackLink>
      <PageHeader
        title="Automatisations des tâches"
        description="Quand quelque chose arrive à une tâche (de tout projet), et qu’elle remplit la condition, la règle la change. Les règles s’appliquent dans leur ordre ; une règle peut en déclencher une autre."
      />
      <SettingsList
        title="Règles"
        description="Ce qu’une règle change est annoncé par une notification, avec « Annuler »."
        noun="la règle"
        feminine
        items={data ?? []}
        loading={isPending}
        renderBadges={(rule) => (
          <>
            <Badge size="xs" variant="light" color="gray">
              {triggerText(rule)}
            </Badge>
            {!rule.enabled && (
              <Badge size="xs" variant="light" color="yellow">
                Désactivée
              </Badge>
            )}
          </>
        )}
        menuItems={(rule) =>
          rule.archived
            ? []
            : [
                {
                  label: rule.enabled ? 'Désactiver' : 'Activer',
                  icon: rule.enabled ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />,
                  onClick: () => update.mutate({ id: rule.id, input: { enabled: !rule.enabled } }, ON_ERROR),
                },
              ]
        }
        remove={(id) => remove.mutateAsync({ id })}
        {...useTaskAutomationItems(context)}
      />
    </Stack>
  );
}
