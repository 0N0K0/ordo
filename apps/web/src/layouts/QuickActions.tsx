import { ActionIcon, Button, Group, Menu, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { AlarmIcon, CalendarPlusIcon, CheckSquareOffsetIcon, EnvelopeSimpleIcon, FileTextIcon, PlusIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useMatch } from 'react-router';
import { openNewDocument } from '../features/accounting/new-document';
import { useAlarmForm } from '../features/alarms/use-alarm-form';
import { useEventForm } from '../features/calendar/use-event-form';
import { useMailComposer } from '../features/mail/use-mail-composer';
import { useTaskActions } from '../features/tasks/use-task-actions';
import { useTaskContext } from '../features/tasks/use-task-context';
import { TimerWidget } from '../features/time/TimerWidget';

interface QuickAction {
  label: string;
  /** Name of the button (tooltip, menu, screen readers). */
  title: string;
  icon: ReactNode;
  onClick: () => void;
}

/**
 * Creation buttons of the header, on every page: task, event, timer, alarm, mail and quote. On a project
 * page, the project (and its client for a quote) is preselected. Labelled on large screens, icons with a
 * tooltip on medium ones, one « Créer » menu on phones (the timer staying next to it).
 * @returns {JSX.Element} Buttons.
 */
export function QuickActions() {
  const { context } = useTaskContext();
  const wide = useMediaQuery('(min-width: 75em)');
  const phone = useMediaQuery('(max-width: 48em)');
  const projectId = useMatch('/projects/:id')?.params.id;
  const project = projectId ? context?.projectById.get(projectId) : undefined;
  const taskActions = useTaskActions(context);
  const openEvent = useEventForm(context);
  const openAlarm = useAlarmForm(context);
  const openMail = useMailComposer();

  const before: QuickAction[] = [
    { label: 'Tâche', title: 'Nouvelle tâche', icon: <CheckSquareOffsetIcon aria-hidden />, onClick: () => taskActions.create(project ? { projectId: project.id } : undefined) },
    { label: 'Évènement', title: 'Nouvel évènement', icon: <CalendarPlusIcon aria-hidden />, onClick: () => openEvent({ defaults: project ? { projectId: project.id } : undefined }) },
  ];
  const after: QuickAction[] = [
    { label: 'Alarme', title: 'Nouvelle alarme', icon: <AlarmIcon aria-hidden />, onClick: () => openAlarm() },
    { label: 'Mail', title: 'Nouveau mail', icon: <EnvelopeSimpleIcon aria-hidden />, onClick: () => openMail(project ? { projectId: project.id } : {}) },
    { label: 'Devis', title: 'Nouveau devis', icon: <FileTextIcon aria-hidden />, onClick: () => openNewDocument('QUOTE', project ? { clientId: project.clientId, projectId: project.id } : {}) },
  ];

  if (phone) {
    return (
      <Group gap="xs" wrap="nowrap">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Tooltip label="Créer">
              <ActionIcon size="input-xs" variant="light" aria-label="Créer">
                <PlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            {[...before, ...after].map((action) => (
              <Menu.Item key={action.label} leftSection={action.icon} onClick={action.onClick} disabled={!context}>
                {action.title}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <TimerWidget defaultProjectId={project?.id} compact />
      </Group>
    );
  }

  /**
   * Button of an action: labelled, or an icon with a tooltip.
   * @param {QuickAction} action Action.
   * @returns {JSX.Element} Button.
   */
  const button = (action: QuickAction) =>
    wide ? (
      <Button key={action.label} size="xs" variant="light" leftSection={action.icon} onClick={action.onClick} disabled={!context} aria-label={action.title}>
        {action.label}
      </Button>
    ) : (
      <Tooltip key={action.label} label={action.title}>
        <ActionIcon size="input-xs" variant="light" aria-label={action.title} onClick={action.onClick} disabled={!context}>
          {action.icon}
        </ActionIcon>
      </Tooltip>
    );

  return (
    <Group gap="xs" wrap="nowrap" role="group" aria-label="Créer">
      {before.map(button)}
      <TimerWidget defaultProjectId={project?.id} compact={!wide} />
      {after.map(button)}
    </Group>
  );
}
