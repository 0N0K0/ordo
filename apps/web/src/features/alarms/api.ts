import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { graphql } from '../../graphql';
import type { AlarmFieldsFragment, AlarmInput } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type Alarm = AlarmFieldsFragment;
export type { AlarmInput };

graphql(`
  fragment AlarmFields on Alarm {
    id
    title
    note
    type
    startDate
    time
    frequency
    interval
    weekdays
    endDate
    minutes
    projectId
    taskId
    enabled
    lastFiredAt
    createdAt
  }
`);

const AlarmsDocument = graphql(`
  query Alarms {
    alarms {
      ...AlarmFields
    }
  }
`);

const CreateAlarmDocument = graphql(`
  mutation CreateAlarm($input: AlarmInput!) {
    createAlarm(input: $input) {
      id
    }
  }
`);

const UpdateAlarmDocument = graphql(`
  mutation UpdateAlarm($id: ID!, $input: AlarmInput!) {
    updateAlarm(id: $id, input: $input) {
      id
    }
  }
`);

const DeleteAlarmDocument = graphql(`
  mutation DeleteAlarm($id: ID!) {
    deleteAlarm(id: $id)
  }
`);

const MarkAlarmFiredDocument = graphql(`
  mutation MarkAlarmFired($id: ID!, $at: DateTime!) {
    markAlarmFired(id: $id, at: $at)
  }
`);

export const alarmsQueryKey = ['alarms'] as const;

/**
 * Every alarm.
 * @returns {UseQueryResult} Query state.
 */
export function useAlarms() {
  return useQuery({ queryKey: alarmsQueryKey, queryFn: async () => (await execute(AlarmsDocument)).alarms });
}

/**
 * Number of enabled alarms of each task (tasks without any are left out).
 * @returns {Map<string, number>} Count by task id.
 */
export function useTaskAlarmCounts(): Map<string, number> {
  const { data } = useAlarms();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const alarm of data ?? []) if (alarm.enabled && alarm.taskId) counts.set(alarm.taskId, (counts.get(alarm.taskId) ?? 0) + 1);
    return counts;
  }, [data]);
}

/**
 * Mutation refreshing the alarms once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useAlarmMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: alarmsQueryKey }),
  });
}

/**
 * Alarm creation, edition, deletion, and the record of rung occurrences.
 * @returns {object} Mutations.
 */
export function useAlarmMutations() {
  return {
    create: useAlarmMutation(async (input: AlarmInput) => (await execute(CreateAlarmDocument, { input })).createAlarm),
    update: useAlarmMutation(
      async (variables: { id: string; input: AlarmInput }) => (await execute(UpdateAlarmDocument, variables)).updateAlarm,
    ),
    remove: useAlarmMutation(async (id: string) => (await execute(DeleteAlarmDocument, { id })).deleteAlarm),
    markFired: useAlarmMutation(
      async (variables: { id: string; at: string }) => (await execute(MarkAlarmFiredDocument, variables)).markAlarmFired,
    ),
  };
}
