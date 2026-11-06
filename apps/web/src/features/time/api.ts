import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { TimeEntryFieldsFragment } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { tasksQueryKey } from '../tasks/api';

export type TimeEntry = TimeEntryFieldsFragment;

graphql(`
  fragment TimeEntryFields on TimeEntry {
    id
    projectId
    description
    startedAt
    endedAt
    pausedAt
    pausedSeconds
    duration
    taskIds
    documentId
    documentNumber
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
  projectId: string;
  taskIds: string[];
  description: string | null;
  startedAt: string;
  /** Seconds. */
  duration: number;
}

/**
 * Timer controls and time entry edits.
 * @returns {object} Mutations.
 */
export function useTimeMutations() {
  return {
    start: useTimeMutation(
      async (input: { projectId: string; taskIds: string[]; description?: string | null }) =>
        (await execute(StartTimerDocument, { input })).startTimer,
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
