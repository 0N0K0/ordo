import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TreasuryEntryInput } from '@ordo/shared';
import { graphql } from '../../graphql';
import type { ForecastEntriesQuery, TreasuryAccountsQuery, TreasuryEntriesQuery, TreasuryProjectionQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { accountingQueryKey } from '../accounting/api';

export type TreasuryAccount = TreasuryAccountsQuery['treasuryAccounts'][number];
export type TreasuryEntry = TreasuryEntriesQuery['treasuryEntries'][number];
export type ForecastEntry = ForecastEntriesQuery['forecastEntries'][number];
export type TreasuryProjection = TreasuryProjectionQuery['treasuryProjection'];
export type ProjectionItem = TreasuryProjection['items'][number];

// Under the accounting key: payments change documents, and documents change the forecast.
const treasuryKey = [...accountingQueryKey, 'treasury'];

graphql(`
  fragment TreasuryEntryFields on TreasuryEntry {
    id
    accountId
    accountName
    status
    date
    label
    amount
    category
    method
    projectId
    note
    recurrence
    allocations {
      id
      amount
      documentId
      importedDocumentId
      documentLabel
    }
  }
`);

const AccountsDocument = graphql(`
  query TreasuryAccounts {
    treasuryAccounts {
      id
      name
      openingBalance
      openingDate
      archived
      entryCount
      balance
    }
  }
`);

const EntriesDocument = graphql(`
  query TreasuryEntries($from: Date!, $to: Date!, $accountId: ID) {
    treasuryEntries(from: $from, to: $to, accountId: $accountId) {
      ...TreasuryEntryFields
    }
  }
`);

const ForecastEntriesDocument = graphql(`
  query ForecastEntries {
    forecastEntries {
      ...TreasuryEntryFields
    }
  }
`);

const ProjectionDocument = graphql(`
  query TreasuryProjection($today: Date!, $from: Date!, $until: Date!) {
    treasuryProjection(today: $today, from: $from, until: $until) {
      balance
      series {
        date
        balance
        forecast
      }
      items {
        date
        dueDate
        label
        amount
        kind
        overdue
        entryId
        documentId
        importedDocumentId
        recurringInvoiceId
        accountId
      }
    }
  }
`);

const CreateAccount = graphql(`
  mutation CreateTreasuryAccount($input: TreasuryAccountInput!) {
    createTreasuryAccount(input: $input)
  }
`);
const UpdateAccount = graphql(`
  mutation UpdateTreasuryAccount($id: ID!, $input: TreasuryAccountInput!) {
    updateTreasuryAccount(id: $id, input: $input)
  }
`);
const DeleteAccount = graphql(`
  mutation DeleteTreasuryAccount($id: ID!) {
    deleteTreasuryAccount(id: $id)
  }
`);
const CreateEntry = graphql(`
  mutation CreateTreasuryEntry($input: TreasuryEntryInput!) {
    createTreasuryEntry(input: $input)
  }
`);
const UpdateEntry = graphql(`
  mutation UpdateTreasuryEntry($id: ID!, $input: TreasuryEntryInput!) {
    updateTreasuryEntry(id: $id, input: $input)
  }
`);
const DeleteEntry = graphql(`
  mutation DeleteTreasuryEntry($id: ID!) {
    deleteTreasuryEntry(id: $id)
  }
`);
const RealizeForecast = graphql(`
  mutation RealizeTreasuryForecast($id: ID!, $occurrence: Date!, $date: Date!, $amount: Float!) {
    realizeTreasuryForecast(id: $id, occurrence: $occurrence, date: $date, amount: $amount)
  }
`);

/**
 * Treasury accounts with their balance today.
 * @param {boolean} [enabled] Loaded (else left aside). Optional. Default = true.
 * @returns {UseQueryResult} Query state.
 */
export function useTreasuryAccounts(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...treasuryKey, 'accounts'],
    queryFn: async () => (await execute(AccountsDocument)).treasuryAccounts,
  });
}

/**
 * Entries between two dates, latest first.
 * @param {{ from: string, to: string, accountId: string | null }} filter Period and account.
 * @param {boolean} [enabled] Loaded (else left aside). Optional. Default = true.
 * @returns {UseQueryResult} Query state.
 */
export function useTreasuryEntries(filter: { from: string; to: string; accountId: string | null }, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...treasuryKey, 'entries', filter],
    queryFn: async () => (await execute(EntriesDocument, filter)).treasuryEntries,
  });
}

/**
 * Forecast entries (repeated ones included once).
 * @returns {UseQueryResult} Query state.
 */
export function useForecastEntries() {
  return useQuery({ queryKey: [...treasuryKey, 'forecasts'], queryFn: async () => (await execute(ForecastEntriesDocument)).forecastEntries });
}

/**
 * Balance over a period: actual until today, forecast after, with the expected movements.
 * @param {{ today: string, from: string, until: string }} variables Today and period.
 * @param {boolean} [enabled] Loaded (else left aside). Optional. Default = true.
 * @returns {UseQueryResult} Query state.
 */
export function useTreasuryProjection(variables: { today: string; from: string; until: string }, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...treasuryKey, 'projection', variables],
    queryFn: async () => (await execute(ProjectionDocument, variables)).treasuryProjection,
  });
}

/**
 * Mutation refreshing the accounting data once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useTreasuryMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: accountingQueryKey }) });
}

export interface AccountValues {
  name: string;
  openingBalance: number;
  openingDate: string;
  archived: boolean;
}

/**
 * Accounts and entries edition.
 * @returns {object} Mutations.
 */
export function useTreasuryMutations() {
  return {
    createAccount: useTreasuryMutation(async (input: AccountValues) => (await execute(CreateAccount, { input })).createTreasuryAccount),
    updateAccount: useTreasuryMutation(async (variables: { id: string; input: AccountValues }) => (await execute(UpdateAccount, variables)).updateTreasuryAccount),
    deleteAccount: useTreasuryMutation(async (id: string) => (await execute(DeleteAccount, { id })).deleteTreasuryAccount),
    createEntry: useTreasuryMutation(async (input: TreasuryEntryInput) => (await execute(CreateEntry, { input } as never)).createTreasuryEntry),
    updateEntry: useTreasuryMutation(async (variables: { id: string; input: TreasuryEntryInput }) => (await execute(UpdateEntry, variables as never)).updateTreasuryEntry),
    deleteEntry: useTreasuryMutation(async (id: string) => (await execute(DeleteEntry, { id })).deleteTreasuryEntry),
    realize: useTreasuryMutation(
      async (variables: { id: string; occurrence: string; date: string; amount: number }) => (await execute(RealizeForecast, variables)).realizeTreasuryForecast,
    ),
  };
}
