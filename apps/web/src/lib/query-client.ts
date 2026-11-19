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
    queryClient.setQueryData(meQueryKey, null);
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthenticated }),
  mutationCache: new MutationCache({ onError: handleUnauthenticated }),
});
