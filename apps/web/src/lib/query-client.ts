import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { meQueryKey } from '../features/auth/api';
import { GraphQLRequestError } from './graphql-client';

/**
 * Sends the user back to the login page when the session has expired.
 * @param {unknown} error Error raised by a query or mutation.
 * @returns {void}
 */
function handleUnauthenticated(error: unknown): void {
  // eslint-disable-next-line no-restricted-syntax -- the sign-out of an expired session.
  if (error instanceof GraphQLRequestError && error.code === 'UNAUTHENTICATED') {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- called by the client itself once built (its caches), never before.
    queryClient.setQueryData(meQueryKey, null);
  }
}

/** How long loaded data is shown as it is when a page opens, without asking the server again. */
const FRESH_MS = 15_000;

/** Tells the other tabs of the browser that data changed here. */
const changes = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ordo-data');

/**
 * After a change made here: nothing loaded counts as fresh any more (the next page opened asks the server again, whatever
 * the change touched), and the other tabs are told.
 * @returns {void}
 */
function handleChanged(): void {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define -- called by the client itself once built (its caches), never before.
  void queryClient.invalidateQueries({ refetchType: 'none' });
  changes?.postMessage('changed');
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthenticated }),
  mutationCache: new MutationCache({ onError: handleUnauthenticated, onSuccess: handleChanged }),
  defaultOptions: {
    queries: {
      // Moving between pages does not reload what was just loaded…
      staleTime: FRESH_MS,
      // …but coming back to the app always does: a change made on another device shows at once.
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
    },
  },
});

// A change made in another tab: what is on screen here is reloaded at once.
changes?.addEventListener('message', () => void queryClient.invalidateQueries());
