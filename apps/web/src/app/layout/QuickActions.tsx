import { Button } from '@mantine/core';
import { ActionsMenu } from '../../components/actions/ActionsMenu';
import { AlarmIcon, CalendarPlusIcon, CaretDownIcon, CheckSquareOffsetIcon, EnvelopeSimpleIcon, FileTextIcon, PlayIcon, PlusIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useMatch } from 'react-router';
import { openNewDocument } from '../../features/accounting/lib/new-document';
import { useAlarmForm } from '../../features/alarms/hooks/use-alarm-form';
import { useEventForm } from '../../features/calendar/hooks/use-event-form';
import { useMailComposer } from '../../features/mail/hooks/use-mail-composer';
import { useTaskActions } from '../../features/tasks/hooks/use-task-actions';
import { useTaskContext } from '../../features/tasks/hooks/use-task-context';
import { useRunningTimer } from '../../features/time/api';
import { openTimerForm } from '../../features/time/lib/open-timer-form';
import { useActiveWorkspace } from '../../features/workspaces/api';
import classes from './QuickActions.module.css';
import { TIMER_REPLACED_HINT } from '../../features/time/hooks/use-start-timer';

interface QuickAction {
  /** Name of the item (menu, screen readers). */
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** What it does besides (a timer running stops). Optional. */
  hint?: string;
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
    if (context) openTimerForm(context, project?.id);
  };

  const actions: QuickAction[] = [
    { title: 'Tâche', icon: <CheckSquareOffsetIcon aria-hidden />, onClick: () => taskActions.create(project ? { projectId: project.id } : undefined) },
    { title: 'Évènement', icon: <CalendarPlusIcon aria-hidden />, onClick: () => openEvent({ defaults: project ? { projectId: project.id } : undefined }) },
    // One timer runs at a time: the one running stops (decision Y).
    { title: 'Chrono', icon: <PlayIcon aria-hidden />, onClick: openTimer, hint: running.data ? TIMER_REPLACED_HINT : undefined },
    { title: 'Alarme', icon: <AlarmIcon aria-hidden />, onClick: () => openAlarm() },
    { title: 'Mail', icon: <EnvelopeSimpleIcon aria-hidden />, onClick: () => openMail(project ? { projectId: project.id } : {}) },
    // No invoicing in a personal workspace.
    ...(perso ? [] : [{ title: 'Devis', icon: <FileTextIcon aria-hidden />, onClick: () => openNewDocument('QUOTE', project ? { clientId: project.clientId, projectId: project.id } : {}) }]),
  ];

  return (
    <ActionsMenu
      name="l’ajout"
      hover
      items={actions.map((action) => ({ label: action.title, icon: action.icon, onClick: action.onClick, disabled: action.disabled, hint: action.hint }))}
      target={
        // On a very small screen, only the plus (the name stays for screen readers).
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
      }
    />
  );
}
