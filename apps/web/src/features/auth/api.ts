import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { AccountUserFragment } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type AccountUser = AccountUserFragment;

graphql(`
  fragment AccountUser on User {
    id
    username
    email
    pendingEmail
    contributorId
    role
  }
`);

const MeQuery = graphql(`
  query Me {
    me {
      ...AccountUser
    }
  }
`);

const LoginMutation = graphql(`
  mutation Login($identifier: String!, $password: String!) {
    login(identifier: $identifier, password: $password) {
      ...AccountUser
    }
  }
`);

const LogoutMutation = graphql(`
  mutation Logout {
    logout
  }
`);

const RequestPasswordResetMutation = graphql(`
  mutation RequestPasswordReset($identifier: String!) {
    requestPasswordReset(identifier: $identifier)
  }
`);

const ResetPasswordMutation = graphql(`
  mutation ResetPassword($token: String!, $password: String!) {
    resetPassword(token: $token, password: $password)
  }
`);

const SetUpAccountMutation = graphql(`
  mutation SetUpAccount($token: String!, $password: String!) {
    setUpAccount(token: $token, password: $password)
  }
`);

const ConfirmEmailChangeMutation = graphql(`
  mutation ConfirmEmailChange($token: String!) {
    confirmEmailChange(token: $token)
  }
`);

const ChangePasswordMutation = graphql(`
  mutation ChangePassword($currentPassword: String!, $password: String!) {
    changePassword(currentPassword: $currentPassword, password: $password)
  }
`);

const ChangeUsernameMutation = graphql(`
  mutation ChangeUsername($currentPassword: String!, $username: String!) {
    changeUsername(currentPassword: $currentPassword, username: $username) {
      ...AccountUser
    }
  }
`);

const RequestEmailChangeMutation = graphql(`
  mutation RequestEmailChange($currentPassword: String!, $email: String!) {
    requestEmailChange(currentPassword: $currentPassword, email: $email) {
      ...AccountUser
    }
  }
`);

const CancelEmailChangeMutation = graphql(`
  mutation CancelEmailChange {
    cancelEmailChange {
      ...AccountUser
    }
  }
`);

export const meQueryKey = ['me'] as const;

/**
 * Current user, or null when logged out.
 * @returns {UseQueryResult<AccountUser | null>} Query state.
 */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => (await execute(MeQuery)).me ?? null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Stores the returned user in the `me` cache entry.
 * @returns {(user: AccountUser) => void} Cache updater.
 */
function useSetMe(): (user: AccountUser | null) => void {
  const queryClient = useQueryClient();
  return (user) => queryClient.setQueryData(meQueryKey, user);
}

/**
 * Logs in and stores the user.
 * @returns {UseMutationResult} Mutation state.
 */
export function useLogin() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: async (variables: { identifier: string; password: string }) =>
      (await execute(LoginMutation, variables)).login,
    onSuccess: setMe,
  });
}

/**
 * Logs out and clears every cached query.
 * @returns {UseMutationResult} Mutation state.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await execute(LogoutMutation)).logout,
    onSuccess: () => {
      // Keep the `me` query itself: the auth guard observes it and redirects once it is null.
      queryClient.setQueryData(meQueryKey, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] });
    },
  });
}

/**
 * Requests a password reset link.
 * @returns {UseMutationResult} Mutation state.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (variables: { identifier: string }) =>
      (await execute(RequestPasswordResetMutation, variables)).requestPasswordReset,
  });
}

/**
 * Sets a new password from a reset link.
 * @returns {UseMutationResult} Mutation state.
 */
export function useResetPassword() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: async (variables: { token: string; password: string }) =>
      (await execute(ResetPasswordMutation, variables)).resetPassword,
    // Every session is closed by the server.
    onSuccess: () => setMe(null),
  });
}

/**
 * Chooses the password of a new account from the link sent at its creation.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetUpAccount() {
  return useMutation({
    mutationFn: async (variables: { token: string; password: string }) => (await execute(SetUpAccountMutation, variables)).setUpAccount,
  });
}

/**
 * Whether the logged-in account is the admin: she alone manages the accounts and has professional workspaces.
 * @returns {boolean} Admin.
 */
export function useIsAdmin(): boolean {
  return useMe().data?.role === 'ADMIN';
}

/**
 * Confirms an email change from the link sent to the new address.
 * @returns {UseMutationResult} Mutation state.
 */
export function useConfirmEmailChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { token: string }) =>
      (await execute(ConfirmEmailChangeMutation, variables)).confirmEmailChange,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  });
}

/**
 * Changes the password of the logged-in user.
 * @returns {UseMutationResult} Mutation state.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (variables: { currentPassword: string; password: string }) =>
      (await execute(ChangePasswordMutation, variables)).changePassword,
  });
}

/**
 * Changes the username of the logged-in user.
 * @returns {UseMutationResult} Mutation state.
 */
export function useChangeUsername() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: async (variables: { currentPassword: string; username: string }) =>
      (await execute(ChangeUsernameMutation, variables)).changeUsername,
    onSuccess: setMe,
  });
}

/**
 * Starts an email change (a confirmation link is sent to the new address).
 * @returns {UseMutationResult} Mutation state.
 */
export function useRequestEmailChange() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: async (variables: { currentPassword: string; email: string }) =>
      (await execute(RequestEmailChangeMutation, variables)).requestEmailChange,
    onSuccess: setMe,
  });
}

/**
 * Cancels a pending email change.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCancelEmailChange() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: async () => (await execute(CancelEmailChangeMutation)).cancelEmailChange,
    onSuccess: setMe,
  });
}
