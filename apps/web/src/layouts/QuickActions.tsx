import { Button, Menu } from '@mantine/core';
import { modals } from '@mantine/modals';
import { AlarmIcon, CalendarPlusIcon, CaretDownIcon, CheckSquareOffsetIcon, EnvelopeSimpleIcon, FileTextIcon, PlayIcon, PlusIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useMatch } from 'react-router';
import { openNewDocument } from '../features/accounting/new-document';
import { useAlarmForm } from '../features/alarms/use-alarm-form';
import { useEventForm } from '../features/calendar/use-event-form';
import { useMailComposer } from '../features/mail/use-mail-composer';
import { useTaskActions } from '../features/tasks/use-task-actions';
import { useTaskContext } from '../features/tasks/use-task-context';
import { useRunningTimer } from '../features/time/api';
import { TimerStartForm } from '../features/time/TimerCard';
import { useActiveWorkspace } from '../features/workspaces/api';
import classes from './QuickActions.module.css';

interface QuickAction {
  /** Name of the item (menu, screen readers). */
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Creation menu of the header, between the running timer and the account, on every page and at every width: « Ajouter » opens, on hover (or a click, by touch
 * or keyboard), a task, an event, a timer, an alarm, a mail and a quote (not in a personal workspace). On a project
 * page, the project (and its client for a quote) is preselected. A running timer shows before it.
 * @returns {JSX.Element} Menu.
 */
export function QuickActions() {
  const { context } = useTaskContext();
  const projectId = useMatch('/projects/:id')?.params.id;
  const project = projectId ? context?.projectById.get(projectId) : undefined;
  const taskActions = useTaskActions(context);
  const openEvent = useEventForm(context);
  const openAlarm = useAlarmForm(context);
  const openMail = useMailComposer();
  const running = useRunningTimer();
  const { perso } = useActiveWorkspace();

  /**
   * Opens the form starting a timer, its project preselected on a project page.
   * @returns {void}
   */
  const openTimer = () => {
    if (!context) return;
    const modalId = 'new-timer';
    modals.open({
      modalId,
      title: 'Nouveau chrono',
      children: <TimerStartForm context={context} defaultProjectId={project?.id} popover onStarted={() => modals.close(modalId)} />,
    });
  };

  const actions: QuickAction[] = [
    { title: 'Tâche', icon: <CheckSquareOffsetIcon aria-hidden />, onClick: () => taskActions.create(project ? { projectId: project.id } : undefined) },
    { title: 'Évènement', icon: <CalendarPlusIcon aria-hidden />, onClick: () => openEvent({ defaults: project ? { projectId: project.id } : undefined }) },
    // One timer runs at a time: the one running shows on the right of the bar.
    { title: running.data ? 'Chrono (un chrono tourne déjà)' : 'Chrono', icon: <PlayIcon aria-hidden />, onClick: openTimer, disabled: Boolean(running.data) },
    { title: 'Alarme', icon: <AlarmIcon aria-hidden />, onClick: () => openAlarm() },
    { title: 'Mail', icon: <EnvelopeSimpleIcon aria-hidden />, onClick: () => openMail(project ? { projectId: project.id } : {}) },
    // No invoicing in a personal workspace.
    ...(perso ? [] : [{ title: 'Devis', icon: <FileTextIcon aria-hidden />, onClick: () => openNewDocument('QUOTE', project ? { clientId: project.clientId, projectId: project.id } : {}) }]),
  ];

  return (
    <Menu trigger="click-hover" openDelay={60} closeDelay={150} position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        {/* On a very small screen, only the plus (the name stays for screen readers). */}
        <Button
          className={classes.add}
          size="xs"
          variant="light"
          leftSection={<PlusIcon aria-hidden />}
          rightSection={<CaretDownIcon aria-hidden size={12} />}
          disabled={!context}
          aria-haspopup="menu"
          aria-label="Ajouter"
        >
          <span className={classes.label}>Ajouter</span>
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {actions.map((action) => (
          <Menu.Item key={action.title} leftSection={action.icon} onClick={action.onClick} disabled={action.disabled}>
            {action.title}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
