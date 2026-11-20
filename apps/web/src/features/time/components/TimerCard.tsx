import { projectPath, PAGES } from '../../../app/pages';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Anchor, Group, Stack, Text } from '@mantine/core';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { entrySeconds, formatClock, formatDuration } from '@ordo/shared';
import { PlayIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ON_ERROR } from '../../../lib/notify';
import { ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeMutations, type TimeEntry, type TimeEntryValues } from '../api';
import classes from './TimerCard.module.css';
import { TimeSubjectsFields, type TimeSubjectsValue } from './TimeSubjectsFields';
import { entryEventKeys, parseEventKeys } from '../lib/time-events';
import { localDay, localToday } from '../../../lib/dates';
import { useNow } from '../../../lib/use-now';
import { TimerControls } from './TimerControls';
import { useStartTimer } from '../hooks/use-start-timer';
import * as fmt from '../../../lib/format';
import { FormActions } from '../../../components/dialogs/FormActions';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { TIMER_RUNNING } from './TimerStop';
import { entrySubject } from '../lib/entry-subject';

/** Dropdowns inside a popover stay in it (a portal would close the popover on click). */
const inPopover = { comboboxProps: { withinPortal: false } };

interface TimerStartFormProps {
  context: TaskContext;
  /** Preselected project. */
  defaultProjectId?: string;
  /** Preselected tasks. */
  defaultTaskIds?: string[];
  /** Rendered inside a popover. */
  popover?: boolean;
  onStarted?: () => void;
}

/**
 * Starts a timer on a project, tasks, routines or events of the day (at least one of them, decisions D17 and D18), with
 * a description of the work.
 * @param {TimerStartFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimerStartForm({ context, defaultProjectId, defaultTaskIds = [], popover, onStarted }: TimerStartFormProps) {
  const { startTimer, isPending: starting } = useStartTimer();
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null);
  const [subjects, setSubjects] = useState<TimeSubjectsValue>({ routineIds: [], taskIds: defaultTaskIds, events: [] });
  const [description, setDescription] = useState('');
  const extra = popover ? inPopover : {};
  const empty = !projectId && !subjects.taskIds.length && !subjects.routineIds.length && !subjects.events.length;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (empty) return;
        startTimer({ projectId, routineIds: subjects.routineIds, taskIds: subjects.taskIds, events: parseEventKeys(subjects.events), description }, () => {
          setSubjects({ routineIds: [], taskIds: [], events: [] });
          setDescription('');
          onStarted?.();
        });
      }}
    >
      <Stack gap="sm">
        <div className={classes.fields}>
          <ProjectSelect
            context={context}
            label="Projet"
            description="Facultatif avec une tâche, une routine ou un évènement."
            clearable
            value={projectId}
            onChange={(value) => {
              setProjectId(value);
              // Tasks and routines go with the project tree (the API's rule).
              setSubjects((current) => ({ ...current, routineIds: [], taskIds: [] }));
            }}
            {...extra}
          />
          <TimeSubjectsFields context={context} projectId={projectId} day={localToday()} value={subjects} onChange={(change) => setSubjects((current) => ({ ...current, ...change }))} {...extra} />
        </div>
        <MarkdownEditor label="Description" placeholder="Ce que vous faites…" minRows={2} value={description} onChange={setDescription} suggestions={context.suggestionsFor(projectId)} />
        <FormActions submitLabel="Démarrer le chrono" submitIcon={<PlayIcon aria-hidden />} disabled={empty} loading={starting} />
      </Stack>
    </form>
  );
}

interface RunningTimerProps {
  entry: TimeEntry;
  context: TaskContext;
  popover?: boolean;
}

/**
 * Running timer: clock, pause / resume, stop, discard; its project, routines, tasks, events and description stay
 * editable (removing the last one of a time without project is refused by the API).
 * @param {RunningTimerProps} props Component props.
 * @returns {JSX.Element} Timer.
 */
export function RunningTimer({ entry, context, popover }: RunningTimerProps) {
  const { update, remove } = useTimeMutations();
  const paused = entry.pausedAt !== null;
  const now = useNow(!paused);
  const [description, setDescription] = useState(entry.description ?? '');
  const extra = popover ? inPopover : {};

  /**
   * Saves a change of the running entry.
   * @param {object} input Changes.
   * @returns {void}
   */
  const save = (input: Partial<TimeEntryValues>) => update.mutate({ id: entry.id, input }, ON_ERROR);

  /**
   * Asks for confirmation before discarding the running timer.
   * @returns {void}
   */
  const confirmDiscard = () => {
    confirmDestructive({
      title: 'Abandonner le chrono',
      risks: <>Le temps en cours ({formatDuration(entrySeconds(entry))}) ne sera pas enregistré.</>,
      confirmLabel: 'Abandonner',
      run: () => remove.mutateAsync(entry.id),
      done: 'Chrono abandonné.',
    });
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={0}>
          <Text className={classes.clock} data-paused={paused || undefined} aria-live="off">
            {formatClock(entrySeconds(entry, now))}
          </Text>
          <Text size="xs" c="dimmed">
            {paused ? 'Chrono en pause' : TIMER_RUNNING} — depuis {fmt.time(entry.startedAt)} ·{' '}
            {entry.projectId ? (
              <Anchor component={Link} to={projectPath(entry.projectId, 'time')} size="xs">
                {entrySubject(entry, context)}
              </Anchor>
            ) : entry.routines.length ? (
              <Anchor component={Link} to={PAGES.routines.path} size="xs">
                {entrySubject(entry, context)}
              </Anchor>
            ) : (
              entrySubject(entry, context)
            )}
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <TimerControls entry={entry} size="lg" />
          <RemoveButton label="Abandonner (sans enregistrer)" aria-label="Abandonner le chrono" size="lg" onClick={confirmDiscard} />
        </Group>
      </Group>
      <div className={classes.fields}>
        <ProjectSelect
          context={context}
          label="Projet"
          value={entry.projectId}
          onChange={(projectId) => projectId && save({ projectId, taskIds: [], routineIds: [] })}
          allowDeselect={false}
          {...extra}
        />
        <TimeSubjectsFields
          context={context}
          projectId={entry.projectId}
          day={localDay(entry.startedAt)}
          entry={entry}
          value={{ routineIds: entry.routines.map((routine) => routine.id), taskIds: entry.taskIds, events: entryEventKeys(entry) }}
          onChange={(change) => save({ ...change, events: change.events && parseEventKeys(change.events) })}
          {...extra}
        />
      </div>
      <MarkdownEditor
        label="Description"
        placeholder="Ce que vous faites…"
        minRows={2}
        value={description}
        onChange={setDescription}
        suggestions={context.suggestionsFor(entry.projectId)}
        onBlur={() => description !== (entry.description ?? '') && save({ description })}
      />
    </Stack>
  );
}
