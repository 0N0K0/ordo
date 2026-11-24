import { countBy } from '@ordo/shared';
import { useQuery } from '@tanstack/react-query';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { useMemo } from 'react';
import { graphql } from '../../../graphql';
import type { AlarmFieldsFragment, AlarmInput, AlarmRingFieldsFragment, AlarmRingInput, PushConfigQuery, PushSubscriptionInput } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

export type Alarm = AlarmFieldsFragment;
export type { AlarmInput };
/** A ring of an alarm or a reminder as the API keeps it. */
export type AlarmRing = AlarmRingFieldsFragment;

// A reminder of a task, a routine, an event, an éphéméride or a birthday: every query of reminders selects it.
graphql(`
  fragment ReminderFields on Reminder {
    before
    at
    days
    anchor
    ringtone
  }
`);

graphql(`
  fragment AlarmRingFields on AlarmRing {
    id
    key
    workspaceId
    title
    lines
    path
    linkLabel
    ringtone
    dueAt
    ringingSince
    nextAt
    stoppedAt
  }
`);

const AlarmRingsDocument = graphql(`
  query AlarmRings {
    alarmRings {
      ...AlarmRingFields
    }
  }
`);

const RingAlarmDocument = graphql(`
  mutation RingAlarm($input: AlarmRingInput!) {
    ringAlarm(input: $input) {
      ...AlarmRingFields
    }
  }
`);

const SnoozeAlarmRingDocument = graphql(`
  mutation SnoozeAlarmRing($key: String!) {
    snoozeAlarmRing(key: $key) {
      ...AlarmRingFields
    }
  }
`);

const StopAlarmRingDocument = graphql(`
  mutation StopAlarmRing($key: String!) {
    stopAlarmRing(key: $key)
  }
`);

/**
 * Rings of the user changed in the last 6 hours, stopped ones included (every workspace).
 * @returns {Promise<AlarmRing[]>} Rings.
 */
export async function fetchAlarmRings(): Promise<AlarmRing[]> {
  return (await execute(AlarmRingsDocument)).alarmRings;
}

/**
 * Records that an alarm or a reminder starts ringing (first ring or repetition).
 * @param {AlarmRingInput} input Ring.
 * @returns {Promise<AlarmRing>} Ring as kept (stopped already: `stoppedAt`).
 */
export async function sendAlarmRing(input: AlarmRingInput): Promise<AlarmRing> {
  return (await execute(RingAlarmDocument, { input })).ringAlarm;
}

/**
 * « Répéter dans N min ».
 * @param {string} key Key of the ring.
 * @returns {Promise<AlarmRing | null>} Ring, null when unknown or stopped.
 */
export async function sendAlarmSnooze(key: string): Promise<AlarmRing | null> {
  return (await execute(SnoozeAlarmRingDocument, { key })).snoozeAlarmRing ?? null;
}

/**
 * « Arrêter ».
 * @param {string} key Key of the ring.
 * @returns {Promise<boolean>} Done.
 */
export async function sendAlarmStop(key: string): Promise<boolean> {
  return (await execute(StopAlarmRingDocument, { key })).stopAlarmRing;
}

graphql(`
  fragment AlarmFields on Alarm {
    id
    label
    note
    type
    startDate
    time
    frequency
    interval
    weekdays
    endDate
    recurrence
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
 * Every alarm, reloaded every 5 minutes (in the background too).
 * @returns {UseQueryResult} Query state.
 */
export function useAlarms() {
  // A tab left open in the background sees the alarms created or changed elsewhere.
  return useQuery({ queryKey: alarmsQueryKey, queryFn: async () => (await execute(AlarmsDocument)).alarms, refetchInterval: 5 * 60_000, refetchIntervalInBackground: true });
}

/**
 * Number of enabled alarms of each task (tasks without any are left out).
 * @returns {Map<string, number>} Count by task id.
 */
export function useTaskAlarmCounts(): Map<string, number> {
  const { data } = useAlarms();
  return useMemo(() => {
    return countBy(data ?? [], (alarm) => (alarm.enabled ? alarm.taskId : null));
  }, [data]);
}

/**
 * Mutation refreshing the alarms once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useAlarmMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  return useInvalidatingMutation(mutationFn, { invalidate: [alarmsQueryKey] });
}

/**
 * Alarm creation, edition, deletion, and the record of rung occurrences.
 * @returns {object} Mutations.
 */
export function useAlarmMutations() {
  return {
    create: useAlarmMutation(async (input: AlarmInput) => (await execute(CreateAlarmDocument, { input })).createAlarm),
    update: useAlarmMutation(async (variables: { id: string; input: AlarmInput }) => (await execute(UpdateAlarmDocument, variables)).updateAlarm),
    remove: useAlarmMutation(async (id: string) => (await execute(DeleteAlarmDocument, { id })).deleteAlarm),
    markFired: useAlarmMutation(async (variables: { id: string; at: string }) => (await execute(MarkAlarmFiredDocument, variables)).markAlarmFired),
  };
}

// Push notifications ----------------------------------------------------------------------

const PushConfigDocument = graphql(`
  query PushConfig {
    pushPublicKey
    pushSubscriptions {
      id
      endpoint
      label
      createdAt
      lastSuccessAt
    }
  }
`);

const RegisterPushSubscriptionDocument = graphql(`
  mutation RegisterPushSubscription($input: PushSubscriptionInput!) {
    registerPushSubscription(input: $input) {
      id
    }
  }
`);

const RemovePushSubscriptionDocument = graphql(`
  mutation RemovePushSubscription($id: ID!) {
    removePushSubscription(id: $id)
  }
`);

const TestPushSubscriptionDocument = graphql(`
  mutation TestPushSubscription($id: ID!) {
    testPushSubscription(id: $id)
  }
`);

/** Push on this server (its public key, null: off) and the devices of the user. */
export type PushConfig = PushConfigQuery;

/** A device of the user receiving the push notifications. */
export type PushDevice = PushConfigQuery['pushSubscriptions'][number];

export const pushQueryKey = ['push-devices'] as const;

/**
 * Push on this server and the devices of the user (every workspace).
 * @returns {Promise<PushConfig>} Key and devices.
 */
export function fetchPushConfig(): Promise<PushConfig> {
  return execute(PushConfigDocument);
}

/**
 * Push on this server and the devices of the user, as a query.
 * @returns {UseQueryResult<PushConfig>} Query state.
 */
export function usePushConfig() {
  return useQuery({ queryKey: pushQueryKey, queryFn: fetchPushConfig });
}

/**
 * Subscribes a device of the user.
 * @param {PushSubscriptionInput} input Endpoint, keys and label of the device.
 * @returns {Promise<string>} Id of the device.
 */
export async function sendPushSubscription(input: PushSubscriptionInput): Promise<string> {
  return (await execute(RegisterPushSubscriptionDocument, { input })).registerPushSubscription.id;
}

/**
 * Removes a device of the user.
 * @param {string} id Device.
 * @returns {Promise<boolean>} Done.
 */
export async function sendPushRemoval(id: string): Promise<boolean> {
  return (await execute(RemovePushSubscriptionDocument, { id })).removePushSubscription;
}

/**
 * Removal and test of a device, the devices refreshed once done.
 * @returns {object} Mutations.
 */
export function usePushMutations() {
  return {
    remove: useInvalidatingMutation(sendPushRemoval, { invalidate: [pushQueryKey] }),
    test: useInvalidatingMutation(async (id: string) => (await execute(TestPushSubscriptionDocument, { id })).testPushSubscription, { invalidate: [pushQueryKey] }),
  };
}
