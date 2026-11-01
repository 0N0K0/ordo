import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { meQueryKey } from '../features/auth/api';
import { GraphQLRequestError } from './graphql-client';

/**
 * Sends the user back to the login page when the session has expired.
 * @param {unknown} error Error raised by a query or mutation.
 * @returns {void}
 */
function handleUnauthenticated(error: unknown): void {
  if (error instanceof GraphQLRequestError && error.code === 'UNAUTHENTICATED') {
    queryClient.setQueryData(meQueryKey, null);
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthenticated }),
  mutationCache: new MutationCache({ onError: handleUnauthenticated }),
});
