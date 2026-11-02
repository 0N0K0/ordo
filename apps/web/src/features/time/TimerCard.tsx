import { ActionIcon, Anchor, Button, Group, Paper, Skeleton, Stack, Text, Textarea, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { entrySeconds, formatClock, formatDuration } from '@ordo/shared';
import { PauseIcon, PlayIcon, StopIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { ProjectSelect } from '../tasks/task-ui';
import { useTaskContext, type TaskContext } from '../tasks/use-task-context';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useRunningTimer, useTimeMutations, type TimeEntry } from './api';
import classes from './TimerCard.module.css';
import { TimeTasksSelect } from './TimeTasksSelect';
import { useNow } from './use-now';
import { useStopTimer } from './use-stop-timer';

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
    const modalId = `discard-timer-${entry.id}`;
    modals.open({
      modalId,
      title: 'Abandonner le chrono',
      children: (
        <Stack gap="md">
          <Text size="sm">Le temps en cours ({formatDuration(entrySeconds(entry))}) ne sera pas enregistré. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(entry.id, {
                onSuccess: () => notifySuccess('Chrono abandonné.'),
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
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
            {paused ? 'En pause' : 'En cours'} — depuis{' '}
            {new Date(entry.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
            <Anchor component={Link} to={`/projects/${entry.projectId}?tab=time`} size="xs">
              {context.projectById.get(entry.projectId)?.title ?? 'Projet'}
            </Anchor>
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
      <ProjectSelect
        context={context}
        label="Projet"
        value={entry.projectId}
        onChange={(projectId) => projectId && save({ projectId, taskIds: [] })}
        allowDeselect={false}
        {...extra}
      />
      <TimeTasksSelect context={context} projectId={entry.projectId} value={entry.taskIds} onChange={(taskIds) => save({ taskIds })} {...extra} />
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

/**
 * Timer card (home page, project time tab): the running timer, or the form starting one.
 * @param {{ projectId?: string }} props Component props: project preselected to start a timer.
 * @returns {JSX.Element} Card.
 */
export function TimerCard({ projectId }: { projectId?: string }) {
  const { context } = useTaskContext();
  const running = useRunningTimer();
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Chrono">
      <Stack gap="sm">
        <Title order={2} size="h4">
          Chrono
        </Title>
        {!context || running.isPending ? (
          <Skeleton height={120} />
        ) : running.data ? (
          <>
            {projectId && running.data.projectId !== projectId && (
              <Text size="xs" c="dimmed">
                Un chrono tourne sur un autre projet : en démarrer un nouveau l’arrêtera.
              </Text>
            )}
            <RunningTimer key={running.data.id} entry={running.data} context={context} />
          </>
        ) : (
          <TimerStartForm key={projectId} context={context} defaultProjectId={projectId} />
        )}
      </Stack>
    </Paper>
  );
}
