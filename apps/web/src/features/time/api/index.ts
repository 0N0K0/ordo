import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { graphql } from '../../../graphql';
import type { TimeEntryFieldsFragment } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import type { QueryClient } from '@tanstack/react-query';
import type { RoutinesDataQuery, TasksDataQuery } from '../../../graphql/graphql';
import { notifyWarning } from '../../../lib/notify';
import { routinesKey } from '../../routines/api';
import { routineDoable, useSlotRules, type SlotRules } from '../../calendar/hooks/use-slot-rules';
import { tasksQueryKey } from '../../tasks/api';
import type { CalendarEventScope } from '../../calendar/api';

export type TimeEntry = TimeEntryFieldsFragment;

graphql(`
  fragment TimeEntryFields on TimeEntry {
    id
    projectId
    routines {
      id
      label
    }
    description
    startedAt
    endedAt
    pausedAt
    pausedSeconds
    duration
    taskIds
    documentId
    documentNumber
    events {
      eventId
      occurrenceDate
      label
    }
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

const TimeLostOnDeleteDocument = graphql(`
  query TimeLostOnDelete($taskIds: [ID!], $routineIds: [ID!], $withSubtree: Boolean, $eventId: ID, $scope: CalendarEventScope, $occurrenceDate: Date) {
    timeLostOnDelete(taskIds: $taskIds, routineIds: $routineIds, withSubtree: $withSubtree, eventId: $eventId, scope: $scope, occurrenceDate: $occurrenceDate)
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
  return useInvalidatingMutation(mutationFn, { invalidate: [timeQueryKey, tasksQueryKey] });
}

/** Calendar event (its occurrence for a recurring one) a time is spent on, as the API takes it. */
export interface TimeEventLink {
  eventId: string;
  occurrenceDate: string | null;
}

export interface TimeEntryValues {
  /** Project (null: none, for a time with a task, a routine or an event). */
  projectId: string | null;
  /** Routines the time is spent on (several, decision D18). */
  routineIds?: string[];
  taskIds: string[];
  description: string | null;
  startedAt: string;
  /** Seconds. */
  duration: number;
  /** Calendar events (occurrences) the time was spent on (several, decision D18). */
  events?: TimeEventLink[];
}

/** Timer started: on a project, tasks, routines or event occurrences (at least one of them). */
export interface TimerStartValues {
  projectId?: string | null;
  routineIds?: string[];
  taskIds: string[];
  description?: string | null;
  events?: TimeEventLink[];
}

/** Items about to be deleted (as their deletion takes them), whose times may be deleted with them. */
export interface TimeLostQuery {
  taskIds?: string[];
  routineIds?: string[];
  /** Their sub-tasks or sub-routines are deleted too. */
  withSubtree?: boolean;
  eventId?: string;
  scope?: CalendarEventScope;
  occurrenceDate?: string | null;
}

/**
 * Number of times deleted with tasks, routines or an event (occurrences): those without project, not billed, left
 * with nothing attached (extra A of decision D17).
 * @param {TimeLostQuery} query Items about to be deleted.
 * @returns {Promise<number>} Number of times.
 */
export async function fetchTimeLost(query: TimeLostQuery): Promise<number> {
  return (await execute(TimeLostOnDeleteDocument, query)).timeLostOnDelete;
}

/**
 * Number of times a deletion takes with it (`fetchTimeLost`), for its confirmation.
 * @param {TimeLostQuery} query Items about to be deleted.
 * @returns {UseQueryResult<number>} Query state.
 */
export function useTimeLost(query: TimeLostQuery) {
  return useQuery({ queryKey: [...timeQueryKey, 'lost', query], queryFn: () => fetchTimeLost(query) });
}

/**
 * Warns when a timer starts on tasks out of the hours their slot condition allows (a routine: its moments are kept
 * to them already), or while an event keeps their assignees busy (but the events the timer is on): the timer runs all the
 * same.
 * @param {QueryClient} queryClient Query cache (routines and tasks loaded).
 * @param {SlotRules} slotRules Slot rules of the workspace.
 * @param {TimerStartValues} input Timer started.
 * @returns {void}
 */
function warnOutOfSlots(queryClient: QueryClient, slotRules: SlotRules, input: TimerStartValues): void {
  const routineIds = input.routineIds ?? [];
  const routines = queryClient.getQueryData<RoutinesDataQuery>(routinesKey)?.routines.filter((item) => routineIds.includes(item.id)) ?? [];
  const tasks = queryClient.getQueryData<TasksDataQuery>(tasksQueryKey)?.tasks.filter((task) => input.taskIds.includes(task.id)) ?? [];
  const eventIds = new Set((input.events ?? []).map((event) => event.eventId));
  const items = [
    ...routines.map((routine) => ({ label: routine.label, ...routineDoable(routine) })),
    ...tasks.map((task) => ({ label: task.label, slotCondition: task.slotCondition, assigneeIds: task.assigneeIds, taskId: task.id })),
  ];
  const lines = items.flatMap((item) => {
    const busy = slotRules.blocking(item);
    // The events the timer is on keep nobody from it.
    const event = busy && !eventIds.has((busy as { eventId?: string }).eventId ?? '') ? busy : undefined;
    if (event) return [`${item.label} : pendant « ${event.label} »`];
    return slotRules.inSlots(item.slotCondition) ? [] : [`${item.label} : ${(slotRules.describe(item.slotCondition) ?? '').toLowerCase()}`];
  });
  if (!lines.length) return;
  notifyWarning('Hors des moments prévus', `Le chrono tourne quand même. ${lines.join(' · ')}.`);
}

/**
 * Timer controls and time entry edits. Starting a timer out of the slots of its routines or tasks warns.
 * @returns {object} Mutations.
 */
export function useTimeMutations() {
  const queryClient = useQueryClient();
  const slotRules = useSlotRules();
  return {
    start: useTimeMutation(async (input: TimerStartValues) => {
      const started = (await execute(StartTimerDocument, { input })).startTimer;
      warnOutOfSlots(queryClient, slotRules, input);
      return started;
    }),
    setPaused: useTimeMutation(async (paused: boolean) => (await execute(SetTimerPausedDocument, { paused })).setTimerPaused),
    stop: useTimeMutation(async () => (await execute(StopTimerDocument)).stopTimer),
    create: useTimeMutation(async (input: TimeEntryValues) => (await execute(CreateTimeEntryDocument, { input })).createTimeEntry),
    update: useTimeMutation(async (variables: { id: string; input: Partial<TimeEntryValues> }) => (await execute(UpdateTimeEntryDocument, variables)).updateTimeEntry),
    remove: useTimeMutation(async (id: string) => (await execute(DeleteTimeEntryDocument, { id })).deleteTimeEntry),
  };
}
