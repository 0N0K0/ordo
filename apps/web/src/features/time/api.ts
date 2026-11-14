import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { TimeEntryFieldsFragment } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import type { QueryClient } from '@tanstack/react-query';
import type { RoutinesDataQuery, TasksDataQuery } from '../../graphql/graphql';
import { notifyWarning } from '../../lib/notify';
import { routinesKey } from '../routines/api';
import { useSlotRules, type SlotRules } from '../slot-rules/use-slot-rules';
import { tasksQueryKey } from '../tasks/api';

export type TimeEntry = TimeEntryFieldsFragment;

graphql(`
  fragment TimeEntryFields on TimeEntry {
    id
    projectId
    routineId
    routineTitle
    description
    startedAt
    endedAt
    pausedAt
    pausedSeconds
    duration
    taskIds
    documentId
    documentNumber
    calendarEventId
    calendarOccurrenceDate
    calendarEventTitle
  }
`);

const TimeEntriesDocument = graphql(`
  query TimeEntries($projectId: ID, $since: DateTime) {
    timeEntries(projectId: $projectId, since: $since) {
      ...TimeEntryFields
    }
  }
`);

const RunningTimeEntryDocument = graphql(`
  query RunningTimeEntry {
    runningTimeEntry {
      ...TimeEntryFields
    }
  }
`);

const StartTimerDocument = graphql(`
  mutation StartTimer($input: TimerInput!) {
    startTimer(input: $input) {
      id
    }
  }
`);

const SetTimerPausedDocument = graphql(`
  mutation SetTimerPaused($paused: Boolean!) {
    setTimerPaused(paused: $paused) {
      id
    }
  }
`);

const StopTimerDocument = graphql(`
  mutation StopTimer {
    stopTimer {
      id
    }
  }
`);

const CreateTimeEntryDocument = graphql(`
  mutation CreateTimeEntry($input: TimeEntryInput!) {
    createTimeEntry(input: $input) {
      id
    }
  }
`);

const UpdateTimeEntryDocument = graphql(`
  mutation UpdateTimeEntry($id: ID!, $input: TimeEntryUpdateInput!) {
    updateTimeEntry(id: $id, input: $input) {
      id
    }
  }
`);

const DeleteTimeEntryDocument = graphql(`
  mutation DeleteTimeEntry($id: ID!) {
    deleteTimeEntry(id: $id)
  }
`);

export const timeQueryKey = ['time'] as const;

/**
 * Time entries of a project and its sub-projects, latest first.
 * @param {string} projectId Project (empty: nothing loaded).
 * @returns {UseQueryResult} Query state.
 */
export function useTimeEntries(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: [...timeQueryKey, 'entries', projectId],
    queryFn: async () => (await execute(TimeEntriesDocument, { projectId })).timeEntries,
  });
}

/**
 * Time entries of every project, latest first, started since a moment or all of them.
 * @param {string | null} since Moment (ISO date-time), or null for every entry.
 * @param {boolean} [enabled] Loaded (else left aside). Optional. Default = true.
 * @returns {UseQueryResult} Query state.
 */
export function useTimeEntriesSince(since: string | null, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...timeQueryKey, 'since', since],
    queryFn: async () => (await execute(TimeEntriesDocument, { since })).timeEntries,
  });
}

/**
 * The running timer, or null. Refreshed when the window gets the focus back (another tab may have changed it).
 * @returns {UseQueryResult} Query state.
 */
export function useRunningTimer() {
  return useQuery({
    queryKey: [...timeQueryKey, 'running'],
    queryFn: async () => (await execute(RunningTimeEntryDocument)).runningTimeEntry,
    refetchOnWindowFocus: true,
  });
}

/**
 * Mutation refreshing the time data and the tasks (their tracked time) once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useTimeMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: timeQueryKey }),
        queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
      ]);
    },
  });
}

export interface TimeEntryValues {
  /** Project (null: none, for the time of a routine). */
  projectId: string | null;
  /** Routine the time is spent on. */
  routineId?: string | null;
  taskIds: string[];
  description: string | null;
  startedAt: string;
  /** Seconds. */
  duration: number;
  /** Calendar event the time was spent on (null: none). */
  event?: { eventId: string; occurrenceDate: string | null } | null;
}

/**
 * Warns when a timer starts on a routine or tasks out of their slots (their slot rule, else the default of the
 * workspace), or while an event keeps their assignees busy (but the event the timer is on): the timer runs all the
 * same.
 * @param {QueryClient} queryClient Query cache (routines and tasks loaded).
 * @param {SlotRules} slotRules Slot rules of the workspace.
 * @param {{ routineId?: string | null, taskIds: string[], event?: { eventId: string } | null }} input Timer started.
 * @returns {void}
 */
function warnOutOfSlots(queryClient: QueryClient, slotRules: SlotRules, input: { routineId?: string | null; taskIds: string[]; event?: { eventId: string } | null }): void {
  const routine = input.routineId ? queryClient.getQueryData<RoutinesDataQuery>(routinesKey)?.routines.find((item) => item.id === input.routineId) : undefined;
  const tasks = queryClient.getQueryData<TasksDataQuery>(tasksQueryKey)?.tasks.filter((task) => input.taskIds.includes(task.id)) ?? [];
  const items = [
    ...(routine ? [{ title: routine.title, slotRule: routine.slotRule, assigneeIds: routine.assigneeIds, routineId: routine.id }] : []),
    ...tasks.map((task) => ({ title: task.title, slotRule: task.slotRule, assigneeIds: task.assigneeIds, taskId: task.id })),
  ];
  const lines = items.flatMap((item) => {
    const busy = slotRules.blocking(item);
    // The event the timer is on keeps nobody from it.
    const event = busy && (busy as { eventId?: string }).eventId !== input.event?.eventId ? busy : undefined;
    if (event) return [`${item.title} : pendant « ${event.title} »`];
    return slotRules.inSlots(item.slotRule) ? [] : [`${item.title} : ${(slotRules.describe(slotRules.ruleOf(item.slotRule)) ?? '').toLowerCase()}`];
  });
  if (!lines.length) return;
  notifyWarning('Hors des moments prévus', `Le chrono tourne quand même. ${lines.join(' · ')}.`);
}

/**
 * Timer controls and time entry edits. Starting a timer out of the slots of its routine or tasks warns.
 * @returns {object} Mutations.
 */
export function useTimeMutations() {
  const queryClient = useQueryClient();
  const slotRules = useSlotRules();
  return {
    start: useTimeMutation(
      async (input: { projectId?: string | null; routineId?: string | null; taskIds: string[]; description?: string | null; event?: { eventId: string; occurrenceDate: string | null } | null }) => {
        const started = (await execute(StartTimerDocument, { input })).startTimer;
        warnOutOfSlots(queryClient, slotRules, input);
        return started;
      },
    ),
    setPaused: useTimeMutation(async (paused: boolean) => (await execute(SetTimerPausedDocument, { paused })).setTimerPaused),
    stop: useTimeMutation(async () => (await execute(StopTimerDocument)).stopTimer),
    create: useTimeMutation(async (input: TimeEntryValues) => (await execute(CreateTimeEntryDocument, { input })).createTimeEntry),
    update: useTimeMutation(
      async (variables: { id: string; input: Partial<TimeEntryValues> }) =>
        (await execute(UpdateTimeEntryDocument, variables)).updateTimeEntry,
    ),
    remove: useTimeMutation(async (id: string) => (await execute(DeleteTimeEntryDocument, { id })).deleteTimeEntry),
  };
}
