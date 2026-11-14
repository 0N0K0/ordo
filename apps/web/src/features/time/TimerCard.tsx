import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { ActionIcon, Anchor, Button, Group, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { entrySeconds, formatClock, formatDuration } from '@ordo/shared';
import { PauseIcon, PlayIcon, StopIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { ProjectSelect } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { useTimeMutations, type TimeEntry } from './api';
import classes from './TimerCard.module.css';
import { TimeTasksSelect } from './TimeTasksSelect';
import { useNow } from './use-now';
import { useStopTimer } from './use-stop-timer';
import * as fmt from '../../lib/format';

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
 * Starts a timer on a project, optionally on some of its tasks, with a description of the work.
 * @param {TimerStartFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimerStartForm({ context, defaultProjectId, defaultTaskIds = [], popover, onStarted }: TimerStartFormProps) {
  const { start } = useTimeMutations();
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null);
  const [taskIds, setTaskIds] = useState<string[]>(defaultTaskIds);
  const [description, setDescription] = useState('');
  const extra = popover ? inPopover : {};

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!projectId) return;
        start.mutate(
          { projectId, taskIds, description },
          {
            onSuccess: () => {
              setTaskIds([]);
              setDescription('');
              onStarted?.();
            },
            onError: (error) => notifyError(error.message),
          },
        );
      }}
    >
      <Stack gap="sm">
        <div className={classes.fields}>
          <ProjectSelect
            context={context}
            label="Projet"
            required
            value={projectId}
            onChange={(value) => {
              setProjectId(value);
              setTaskIds([]);
            }}
            {...extra}
          />
          <TimeTasksSelect context={context} projectId={projectId} value={taskIds} onChange={setTaskIds} {...extra} />
        </div>
        <Textarea
          label="Description"
          placeholder="Ce que vous faites…"
          autosize
          minRows={2}
          maxRows={8}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" leftSection={<PlayIcon aria-hidden />} disabled={!projectId} loading={start.isPending}>
            Démarrer
          </Button>
        </Group>
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
 * Running timer: clock, pause / resume, stop, discard; its project, tasks and description stay editable.
 * @param {RunningTimerProps} props Component props.
 * @returns {JSX.Element} Timer.
 */
export function RunningTimer({ entry, context, popover }: RunningTimerProps) {
  const { setPaused, update, remove } = useTimeMutations();
  const { stopTimer, isPending: stopping } = useStopTimer();
  const paused = entry.pausedAt !== null;
  const now = useNow(!paused);
  const [description, setDescription] = useState(entry.description ?? '');
  const extra = popover ? inPopover : {};

  /**
   * Saves a change of the running entry.
   * @param {object} input Changes.
   * @returns {void}
   */
  const save = (input: { projectId?: string; taskIds?: string[]; description?: string | null }) =>
    update.mutate({ id: entry.id, input }, { onError: (error) => notifyError(error.message) });

  /**
   * Asks for confirmation before discarding the running timer.
   * @returns {void}
   */
  const confirmDiscard = () => {
    confirmDestructive({ title: 'Abandonner le chrono', risks: (
<>
<Text size="sm">Le temps en cours ({formatDuration(entrySeconds(entry))}) ne sera pas enregistré. Cette action est irréversible.</Text>
</>
), confirmLabel: 'Abandonner', onConfirm: () => { remove.mutate(entry.id, {
                onSuccess: () => notifySuccess('Chrono abandonné.'),
                onError: (error) => notifyError(error.message),
              }); } });
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={0}>
          <Text className={classes.clock} data-paused={paused || undefined} aria-live="off">
            {formatClock(entrySeconds(entry, now))}
          </Text>
          <Text size="xs" c="dimmed">
            {paused ? 'En pause' : 'En cours'} — depuis{' '}
            {fmt.time(new Date(entry.startedAt))} ·{' '}
            {entry.projectId ? (
              <Anchor component={Link} to={`/projects/${entry.projectId}?tab=time`} size="xs">
                {context.projectById.get(entry.projectId)?.title ?? 'Projet'}
              </Anchor>
            ) : (
              <Anchor component={Link} to="/routines" size="xs">
                {entry.routineTitle ?? 'Routine'}
              </Anchor>
            )}
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={paused ? 'Reprendre' : 'Pause'}>
            <ActionIcon
              size="lg"
              variant="light"
              aria-label={paused ? 'Reprendre' : 'Pause'}
              loading={setPaused.isPending}
              onClick={() => setPaused.mutate(!paused, { onError: (error) => notifyError(error.message) })}
            >
              {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Arrêter et enregistrer">
            <ActionIcon size="lg" variant="filled" aria-label="Arrêter et enregistrer" loading={stopping} onClick={() => stopTimer(entry)}>
              <StopIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Abandonner (sans enregistrer)">
            <ActionIcon size="lg" variant="subtle" color="gray" aria-label="Abandonner le chrono" onClick={confirmDiscard}>
              <TrashIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <div className={classes.fields}>
        <ProjectSelect
          context={context}
          label="Projet"
          value={entry.projectId}
          onChange={(projectId) => projectId && save({ projectId, taskIds: [] })}
          allowDeselect={false}
          {...extra}
        />
        <TimeTasksSelect context={context} projectId={entry.projectId} value={entry.taskIds} onChange={(taskIds) => save({ taskIds })} {...extra} />
      </div>
      <Textarea
        label="Description"
        placeholder="Ce que vous faites…"
        autosize
        minRows={2}
        maxRows={8}
        value={description}
        onChange={(event) => setDescription(event.currentTarget.value)}
        onBlur={() => description !== (entry.description ?? '') && save({ description })}
      />
    </Stack>
  );
}
