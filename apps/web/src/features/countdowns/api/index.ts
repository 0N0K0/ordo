import { useQuery } from '@tanstack/react-query';
import { graphql } from '../../../graphql';
import type { CountdownFieldsFragment, CountdownInput, DeadTimeFieldsFragment } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { useInvalidatingMutation } from '../../../lib/mutation';

/** A timer (« minuteur ») of the user, in every workspace. */
export type Countdown = CountdownFieldsFragment;
/** A dead time (« temps mort ») of a task or a routine, as the API gives it. */
export type DeadTimeOutput = DeadTimeFieldsFragment;
export type { CountdownInput };

// A dead time of a task or a routine: every query of tasks and routines selects it.
graphql(`
  fragment DeadTimeFields on DeadTime {
    label
    minutes
    ringtone
  }
`);

graphql(`
  fragment CountdownFields on Countdown {
    id
    label
    durationSeconds
    endsAt
    remainingSeconds
    ringtone
    workspaceId
    taskId
    routineId
    occurrenceDate
    subject
    path
    linkLabel
    createdAt
  }
`);

const CountdownsDocument = graphql(`
  query Countdowns {
    countdowns {
      ...CountdownFields
    }
  }
`);

const StartCountdownDocument = graphql(`
  mutation StartCountdown($input: CountdownInput!) {
    startCountdown(input: $input) {
      ...CountdownFields
    }
  }
`);

const SetCountdownPausedDocument = graphql(`
  mutation SetCountdownPaused($id: ID!, $paused: Boolean!) {
    setCountdownPaused(id: $id, paused: $paused) {
      id
    }
  }
`);

const ExtendCountdownDocument = graphql(`
  mutation ExtendCountdown($id: ID!, $minutes: Int!) {
    extendCountdown(id: $id, minutes: $minutes) {
      id
    }
  }
`);

const RingCountdownDocument = graphql(`
  mutation RingCountdown($id: ID!) {
    ringCountdown(id: $id)
  }
`);

const CancelCountdownDocument = graphql(`
  mutation CancelCountdown($id: ID!) {
    cancelCountdown(id: $id)
  }
`);

/** Cache key of the timers (the user's: the same in every workspace). */
export const countdownsQueryKey = ['countdowns'] as const;

/**
 * Timers of the user not rung yet, the soonest end first. Refreshed every minute and when the window gets the focus
 * back (another tab or device may have started, paused or cancelled one).
 * @returns {UseQueryResult<Countdown[]>} Query state.
 */
export function useCountdowns() {
  return useQuery({ queryKey: countdownsQueryKey, queryFn: async () => (await execute(CountdownsDocument)).countdowns, refetchOnWindowFocus: true, refetchInterval: 60_000 });
}

/**
 * Records that the end of a timer rang: it no longer shows (its ring goes on, kept by the API as the others).
 * @param {string} id Timer.
 * @returns {Promise<boolean>} Done.
 */
export async function sendCountdownRung(id: string): Promise<boolean> {
  return (await execute(RingCountdownDocument, { id })).ringCountdown;
}

/**
 * Mutation refreshing the timers once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useCountdownMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  return useInvalidatingMutation(mutationFn, { invalidate: [countdownsQueryKey] });
}

/**
 * Start, pause / resume, more minutes, cancel of the timers.
 * @returns {object} Mutations.
 */
export function useCountdownMutations() {
  return {
    start: useCountdownMutation(async (input: CountdownInput) => (await execute(StartCountdownDocument, { input })).startCountdown),
    setPaused: useCountdownMutation(async (variables: { id: string; paused: boolean }) => (await execute(SetCountdownPausedDocument, variables)).setCountdownPaused),
    extend: useCountdownMutation(async (variables: { id: string; minutes: number }) => (await execute(ExtendCountdownDocument, variables)).extendCountdown),
    cancel: useCountdownMutation(async (id: string) => (await execute(CancelCountdownDocument, { id })).cancelCountdown),
  };
}
