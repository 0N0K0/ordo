import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { ManagedAccountFragment } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type ManagedAccount = ManagedAccountFragment;

graphql(`
  fragment ManagedAccount on User {
    id
    username
    email
    role
    disabled
    passwordPending
    createdAt
  }
`);

const AccountsQuery = graphql(`
  query Accounts {
    accounts {
      ...ManagedAccount
    }
  }
`);

const CreateAccountMutation = graphql(`
  mutation CreateAccount($input: AccountInput!) {
    createAccount(input: $input) {
      ...ManagedAccount
    }
  }
`);

const ResendAccountSetupMutation = graphql(`
  mutation ResendAccountSetup($id: ID!) {
    resendAccountSetup(id: $id)
  }
`);

const SetAccountDisabledMutation = graphql(`
  mutation SetAccountDisabled($id: ID!, $disabled: Boolean!) {
    setAccountDisabled(id: $id, disabled: $disabled) {
      ...ManagedAccount
    }
  }
`);

const DeleteAccountMutation = graphql(`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id)
  }
`);

const accountsKey = ['accounts'] as const;

/**
 * Every account (admin only).
 * @param {boolean} enabled Load them (the admin is logged in).
 * @returns {UseQueryResult} Query state.
 */
export function useAccounts(enabled: boolean) {
  return useQuery({ queryKey: accountsKey, queryFn: async () => (await execute(AccountsQuery)).accounts, enabled });
}

/**
 * Account creation, link sent again, disabling and deletion (admin only); the list is refreshed once done.
 * @returns {object} Mutations.
 */
export function useAccountMutations() {
  const queryClient = useQueryClient();
  const onSettled = () => queryClient.invalidateQueries({ queryKey: accountsKey });
  return {
    create: useMutation({
      mutationFn: async (input: { username: string; email: string }) => (await execute(CreateAccountMutation, { input })).createAccount,
      onSettled,
    }),
    resend: useMutation({ mutationFn: async (id: string) => (await execute(ResendAccountSetupMutation, { id })).resendAccountSetup, onSettled }),
    setDisabled: useMutation({
      mutationFn: async (variables: { id: string; disabled: boolean }) => (await execute(SetAccountDisabledMutation, variables)).setAccountDisabled,
      onSettled,
    }),
    remove: useMutation({ mutationFn: async (id: string) => (await execute(DeleteAccountMutation, { id })).deleteAccount, onSettled }),
  };
}
