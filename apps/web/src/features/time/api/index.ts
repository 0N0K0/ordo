import { timeQueryKey } from '../../../lib/query-keys';
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
import { unavailableWarning } from '../../calendar/lib/schedule-text';
import { taskRow } from '../../tasks/lib/task-inheritance';
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

const RunningTimeEntriesDocument = graphql(`
  query RunningTimeEntries {
    runningTimeEntries {
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
  mutation SetTimerPaused($id: ID!, $paused: Boolean!) {
    setTimerPaused(id: $id, paused: $paused) {
      id
    }
  }
`);

const StopTimerDocument = graphql(`
  mutation StopTimer($id: ID!) {
    stopTimer(id: $id) {
      id
    }
  }
`);

const StopAllTimersDocument = graphql(`
  mutation StopAllTimers {
    stopAllTimers {
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

const LostOnDeleteDocument = graphql(`
  query LostOnDelete(
    $taskIds: [ID!]
    $routineIds: [ID!]
    $withSubtree: Boolean
    $eventId: ID
    $scope: CalendarEventScope
    $occurrenceDate: Date
    $calendarId: ID
    $routineOccurrence: RoutineOccurrenceGoneInput
  ) {
    lostOnDelete(
      taskIds: $taskIds
      routineIds: $routineIds
      withSubtree: $withSubtree
      eventId: $eventId
      scope: $scope
      occurrenceDate: $occurrenceDate
      calendarId: $calendarId
      routineOccurrence: $routineOccurrence
    ) {
      times
      comments
    }
  }
`);

const DeleteTimeEntryDocument = graphql(`
  mutation DeleteTimeEntry($id: ID!) {
    deleteTimeEntry(id: $id)
  }
`);

export { timeQueryKey };

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
 * The running timers (several at once), the first started first. Refreshed when the window gets the
 * focus back (another tab may have changed them), and every minute, in the background too.
 * @returns {UseQueryResult<TimeEntry[]>} Query state.
 */
export function useRunningTimers() {
  return useQuery({
    queryKey: [...timeQueryKey, 'running'],
    queryFn: async () => (await execute(RunningTimeEntriesDocument)).runningTimeEntries,
    refetchOnWindowFocus: true,
    // A tab left open in the background sees the timers started or stopped elsewhere, and those stopped after 24 hours.
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

/**
 * The running timer spent on an item, if any (the first started).
 * @param {readonly TimeEntry[] | undefined} running Running timers.
 * @param {(entry: TimeEntry) => boolean} on Whether a timer is on the item.
 * @returns {TimeEntry | null} Its timer, null when none runs on it.
 */
export function runningOn(running: readonly TimeEntry[] | undefined, on: (entry: TimeEntry) => boolean): TimeEntry | null {
  return running?.find(on) ?? null;
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
  /** Routines the time is spent on (several). */
  routineIds?: string[];
  taskIds: string[];
  description: string | null;
  startedAt: string;
  /** Seconds. */
  duration: number;
  /** Calendar events (occurrences) the time was spent on (several). */
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

/** Items about to be deleted (as their deletion takes them), whose times and comments may be deleted with them. */
export interface LostOnDeleteQuery {
  taskIds?: string[];
  routineIds?: string[];
  /** Their sub-tasks or sub-routines are deleted too. */
  withSubtree?: boolean;
  eventId?: string;
  scope?: CalendarEventScope;
  occurrenceDate?: string | null;
  /** A calendar deleted with all its events. */
  calendarId?: string;
  /** An occurrence of a routine deleted (THIS), or it and the following ones (FOLLOWING). */
  routineOccurrence?: { id: string; date: string; scope: CalendarEventScope };
}

/** What a deletion takes with it: times without project left with nothing attached, comments of what is deleted. */
export interface LostOnDelete {
  times: number;
  comments: number;
}

/**
 * What a deletion of tasks, routines, occurrences of a routine, an event (occurrences) or a calendar takes with it: the
 * times without project, not billed, left with nothing attached, and the comments of what is
 * deleted.
 * @param {LostOnDeleteQuery} query Items about to be deleted.
 * @returns {Promise<LostOnDelete>} Numbers.
 */
export async function fetchLostOnDelete(query: LostOnDeleteQuery): Promise<LostOnDelete> {
  return (await execute(LostOnDeleteDocument, query)).lostOnDelete;
}

/**
 * What a deletion takes with it (`fetchLostOnDelete`), for its confirmation.
 * @param {LostOnDeleteQuery} query Items about to be deleted.
 * @returns {UseQueryResult<LostOnDelete>} Query state.
 */
export function useLostOnDelete(query: LostOnDeleteQuery) {
  return useQuery({ queryKey: [...timeQueryKey, 'lost', query], queryFn: () => fetchLostOnDelete(query) });
}

/**
 * Warns when a timer starts on tasks out of the hours their slot condition or their « Horaires » allow, those they go
 * by (their own or inherited; a routine: its moments are kept to its condition already), during slots « Indisponible »
 * of the workspace, or while an event keeps their assignees busy (but the events the timer is on): the timer runs all the
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
    ...tasks.map(taskRow).map((task) => ({ label: task.label, slotCondition: task.slotCondition, hours: task.hours, assigneeIds: task.assigneeIds, taskId: task.id })),
  ];
  const lines = items.flatMap((item) => {
    const busy = slotRules.blocking(item);
    // The events the timer is on keep nobody from it.
    const event = busy && !eventIds.has((busy as { eventId?: string }).eventId ?? '') ? busy : undefined;
    if (event) return [`${item.label} : pendant « ${event.label} »`];
    const out = [...(slotRules.inSlots(item.slotCondition) ? [] : [(slotRules.describe(item.slotCondition) ?? '').toLowerCase()]), ...(slotRules.inHours(item.hours) ? [] : ['hors de ses horaires'])];
    return out.length ? [`${item.label} : ${out.join(' et ')}`] : [];
  });
  // The slots « Indisponible » hold every routine and task alike: told once.
  const unavailable = items.length ? unavailableWarning(slotRules.unavailable()) : null;
  if (!lines.length && !unavailable) return;
  notifyWarning('Hors des moments prévus', ['Le chrono tourne quand même.', unavailable, lines.length ? `${lines.join(' · ')}.` : null].filter(Boolean).join(' '));
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
    setPaused: useTimeMutation(async (variables: { id: string; paused: boolean }) => (await execute(SetTimerPausedDocument, variables)).setTimerPaused),
    stop: useTimeMutation(async (id: string) => (await execute(StopTimerDocument, { id })).stopTimer),
    stopAll: useTimeMutation(async () => (await execute(StopAllTimersDocument)).stopAllTimers),
    create: useTimeMutation(async (input: TimeEntryValues) => (await execute(CreateTimeEntryDocument, { input })).createTimeEntry),
    update: useTimeMutation(async (variables: { id: string; input: Partial<TimeEntryValues> }) => (await execute(UpdateTimeEntryDocument, variables)).updateTimeEntry),
    remove: useTimeMutation(async (id: string) => (await execute(DeleteTimeEntryDocument, { id })).deleteTimeEntry),
  };
}
