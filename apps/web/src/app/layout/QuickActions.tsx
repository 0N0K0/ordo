import { ActionButton } from '../../components/actions/ActionButton';
import { ActionsMenu } from '../../components/actions/ActionsMenu';
import { AlarmIcon, ArrowsClockwiseIcon, CalendarPlusIcon, CheckSquareOffsetIcon, EnvelopeSimpleIcon, FileTextIcon, PlayIcon, PlusIcon, TimerIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useMatch } from 'react-router';
import { openNewDocument } from '../../features/accounting/lib/new-document';
import { useAlarmForm } from '../../features/alarms/hooks/use-alarm-form';
import { useMailComposer } from '../../features/mail/hooks/use-mail-composer';
import { useDayAdd } from '../../features/my-day/hooks/use-day-add';
import { useTaskContext } from '../../features/tasks/hooks/use-task-context';
import { openTimerForm } from '../../features/time/lib/open-timer-form';
import { openCountdownForm } from '../../features/countdowns/lib/open-countdown-form';
import { useActiveWorkspace } from '../../features/workspaces/api';
import classes from './QuickActions.module.css';
import { usePageAddDay } from './page-add';

import { PROJECT_ROUTE } from '../pages';

interface QuickAction {
  /** Name of the item (menu, screen readers). */
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** What it does besides (a timer running stops). Optional. */
  hint?: string;
}

/**
 * Creation menu of the header, between the running timer and the account, on every page and at every width: « Ajouter » opens, on hover (or a click, by touch
 * or keyboard), a task, an event, a routine, a timer (chrono), a countdown (« Minuteur »), an alarm, a mail and a quote (not in a personal workspace). On a project
 * page, the project (and its client for a quote) is preselected; on « Ma journée », the task, the event and the routine are prefilled
 * with the day shown, as the « Ajouter » of the page (`useDayAdd`). A running timer shows before it.
 * @returns {JSX.Element} Menu.
 */
export function QuickActions() {
  const { context } = useTaskContext();
  const projectId = useMatch(PROJECT_ROUTE)?.params.id;
  const project = projectId ? context?.projectById.get(projectId) : undefined;
  // On « Ma journée », the day shown: the task, the event and the routine are prefilled with it, as the « Ajouter » of the page.
  const addDay = usePageAddDay();
  const add = useDayAdd(context);
  const openAlarm = useAlarmForm(context);
  const openMail = useMailComposer();
  const { perso } = useActiveWorkspace();

  /**
   * Opens the form starting a timer, its project preselected on a project page.
   * @returns {void}
   */
  const openTimer = () => {
    if (context) openTimerForm(context, project?.id);
  };

  const actions: QuickAction[] = [
    { label: 'Tâche', icon: <CheckSquareOffsetIcon aria-hidden />, onClick: () => add.task(addDay, project ? { projectId: project.id } : undefined) },
    { label: 'Évènement', icon: <CalendarPlusIcon aria-hidden />, onClick: () => add.event(addDay, project ? { projectId: project.id } : undefined) },
    { label: 'Routine', icon: <ArrowsClockwiseIcon aria-hidden />, onClick: () => add.routine(addDay, project ? { projectId: project.id } : undefined) },
    // Several timers run at once: the ones running keep running.
    { label: 'Chrono', icon: <PlayIcon aria-hidden />, onClick: openTimer },
    { label: 'Minuteur', icon: <TimerIcon aria-hidden />, onClick: () => openCountdownForm() },
    { label: 'Alarme', icon: <AlarmIcon aria-hidden />, onClick: () => openAlarm() },
    { label: 'Mail', icon: <EnvelopeSimpleIcon aria-hidden />, onClick: () => openMail(project ? { projectId: project.id } : {}) },
    // No invoicing in a personal workspace.
    ...(perso ? [] : [{ label: 'Devis', icon: <FileTextIcon aria-hidden />, onClick: () => openNewDocument('QUOTE', project ? { clientId: project.clientId, projectId: project.id } : {}) }]),
  ];

  return (
    <ActionsMenu
      about="l’ajout"
      hover
      items={actions.map((action) => ({ label: action.label, icon: action.icon, onClick: action.onClick, hint: action.hint }))}
      target={
        // On a very small screen, only the plus (the name stays for screen readers).
        <ActionButton priority="secondary" className={classes.add} size="xs" icon={<PlusIcon aria-hidden />} disabled={!context} aria-label="Ajouter">
          <span className={classes.label}>Ajouter</span>
        </ActionButton>
      }
    />
  );
}
