import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TreasuryCategoryInput, TreasuryCounterpartyInput, TreasuryEntryInput, TreasuryPaymentMethodInput } from '@ordo/shared';
import { graphql } from '../../graphql';
import type {
  ForecastEntriesQuery,
  TreasuryAccountsQuery,
  TreasuryEntriesQuery,
  TreasuryEntrySearchQuery,
  TreasuryDocumentOptionsQuery,
  TreasuryProjectionQuery,
  TreasurySettingsQuery,
  TreasuryBudgetsQuery,
  TreasuryLoansQuery,
} from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { accountingQueryKey } from '../accounting/api';
import { tasksQueryKey } from '../tasks/api';
import { workspaceQueryKey } from '../workspace/api';

export type TreasuryAccount = TreasuryAccountsQuery['treasuryAccounts'][number];
export type TreasuryEntry = TreasuryEntriesQuery['treasuryEntries'][number];
export type ForecastEntry = ForecastEntriesQuery['forecastEntries'][number];
export type TreasuryProjection = TreasuryProjectionQuery['treasuryProjection'];
export type ProjectionItem = TreasuryProjection['items'][number];
export type TreasurySettings = TreasurySettingsQuery;
export type TreasuryCategory = TreasurySettingsQuery['treasuryCategories'][number];
export type TreasuryPaymentMethod = TreasurySettingsQuery['treasuryPaymentMethods'][number];
export type TreasuryCounterparty = TreasurySettingsQuery['treasuryCounterparties'][number];
export type TreasuryMember = TreasurySettingsQuery['treasuryMembers'][number];
export type TreasuryContext = TreasurySettingsQuery['treasuryContexts'][number];
export type TreasuryRelation = TreasurySettingsQuery['treasuryRelations'][number];
export type TreasuryContextPeriod = TreasurySettingsQuery['treasuryContextPeriods'][number];
export type TreasuryEntryLine = TreasuryEntry['lines'][number];
export type EntryDocument = TreasuryDocumentOptionsQuery['treasuryDocumentOptions'][number];
export type FoundEntry = TreasuryEntrySearchQuery['treasuryEntrySearch'][number];

// Under the accounting key: payments change documents, and documents change the forecast.
const treasuryKey = [...accountingQueryKey, 'treasury'];

graphql(`
  fragment TreasuryEntryFields on TreasuryEntry {
    id
    accountId
    accountName
    status
    date
    valueDate
    label
    amount
    categoryId
    methodId
    methodName
    clientId
    counterpartyId
    payerName
    linkedEntries {
      id
      date
      label
      amount
      status
    }
    projectId
    note
    url
    recurrence
    lines {
      id
      label
      mode
      value
      memberId
      relationId
      loan
      date
      categoryId
      contextId
      projectId
      documents {
        ...TreasuryEntryDocumentFields
      }
      linkedLines {
        id
        entryId
        entryLabel
        date
        label
        amount
        status
      }
      linkedEntries {
        id
        date
        label
        amount
        status
      }
    }
    linkedByLines {
      id
      entryId
      entryLabel
      date
      label
      amount
      status
    }
    allocations {
      id
      amount
      documentId
      importedDocumentId
      documentLabel
    }
    documents {
      ...TreasuryEntryDocumentFields
    }
  }
`);

graphql(`
  fragment TreasuryEntryDocumentFields on TreasuryEntryDocument {
    id
    source
    kind
    title
    url
    projectId
    place
  }
`);

const DocumentOptionsDocument = graphql(`
  query TreasuryDocumentOptions {
    treasuryDocumentOptions {
      ...TreasuryEntryDocumentFields
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
      csvMapping
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
        payerName
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

const SettingsDocument = graphql(`
  query TreasurySettings {
    treasuryCategories {
      id
      name
      color
      direction
      parentId
      entryCount
    }
    treasuryPaymentMethods {
      id
      name
      incoming
      outgoing
      entryCount
    }
    treasuryCounterparties {
      id
      name
      note
      archived
      entryCount
    }
    treasuryMembers {
      id
      name
      handle
      avatarUrl
      isMe
    }
    treasuryContexts {
      id
      name
      color
      position
    }
    treasuryRelations {
      id
      name
      note
      contributorId
      lineCount
      budgetCount
    }
    treasuryContextPeriods {
      id
      contextId
      startDate
      endDate
      note
    }
  }
`);

const EntrySearchDocument = graphql(`
  query TreasuryEntrySearch($text: String!) {
    treasuryEntrySearch(text: $text, limit: 20) {
      id
      date
      label
      amount
      status
      accountName
      lines {
        id
        label
        mode
        value
      }
    }
  }
`);

const CreateCategory = graphql(`
  mutation CreateTreasuryCategory($input: TreasuryCategoryInput!) {
    createTreasuryCategory(input: $input)
  }
`);
const UpdateCategory = graphql(`
  mutation UpdateTreasuryCategory($id: ID!, $input: TreasuryCategoryInput!) {
    updateTreasuryCategory(id: $id, input: $input)
  }
`);
const DeleteCategory = graphql(`
  mutation DeleteTreasuryCategory($id: ID!) {
    deleteTreasuryCategory(id: $id)
  }
`);
const CreateMethod = graphql(`
  mutation CreateTreasuryPaymentMethod($input: TreasuryPaymentMethodInput!) {
    createTreasuryPaymentMethod(input: $input)
  }
`);
const UpdateMethod = graphql(`
  mutation UpdateTreasuryPaymentMethod($id: ID!, $input: TreasuryPaymentMethodInput!) {
    updateTreasuryPaymentMethod(id: $id, input: $input)
  }
`);
const DeleteMethod = graphql(`
  mutation DeleteTreasuryPaymentMethod($id: ID!) {
    deleteTreasuryPaymentMethod(id: $id)
  }
`);
const CreateCounterparty = graphql(`
  mutation CreateTreasuryCounterparty($input: TreasuryCounterpartyInput!) {
    createTreasuryCounterparty(input: $input)
  }
`);
const UpdateCounterparty = graphql(`
  mutation UpdateTreasuryCounterparty($id: ID!, $input: TreasuryCounterpartyInput!) {
    updateTreasuryCounterparty(id: $id, input: $input)
  }
`);
const DeleteCounterparty = graphql(`
  mutation DeleteTreasuryCounterparty($id: ID!) {
    deleteTreasuryCounterparty(id: $id)
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

const InvoiceCategoriesDocument = graphql(`
  query InvoiceTreasuryCategories {
    invoiceTreasuryCategories {
      invoiceCategoryId
      creditNoteCategoryId
    }
  }
`);

const SetInvoiceCategories = graphql(`
  mutation SetInvoiceTreasuryCategories($invoiceCategoryId: ID, $creditNoteCategoryId: ID) {
    setInvoiceTreasuryCategories(invoiceCategoryId: $invoiceCategoryId, creditNoteCategoryId: $creditNoteCategoryId)
  }
`);

/**
 * Treasury categories of the payments of invoices and of the refunds of credit notes (the budgets they count in).
 * @returns {UseQueryResult} Query state.
 */
export function useInvoiceTreasuryCategories() {
  return useQuery({ queryKey: [...treasuryKey, 'invoice-categories'], queryFn: async () => (await execute(InvoiceCategoriesDocument)).invoiceTreasuryCategories });
}

/**
 * Treasury settings: categories, payment methods and counterparties.
 * @returns {UseQueryResult} Query state.
 */
export function useTreasurySettings() {
  return useQuery({ queryKey: [...treasuryKey, 'settings'], queryFn: () => execute(SettingsDocument) });
}

/**
 * Documents of the app that can support an entry: the library, then the documents of the projects.
 * @param {boolean} [enabled] Loaded (else left aside). Optional. Default = true.
 * @returns {UseQueryResult} Query state.
 */
export function useTreasuryDocumentOptions(enabled = true) {
  return useQuery({ enabled, queryKey: [...treasuryKey, 'document-options'], queryFn: async () => (await execute(DocumentOptionsDocument)).treasuryDocumentOptions });
}

/**
 * Entries whose label contains a text (at least 2 characters), to link them.
 * @param {string} text Text searched.
 * @returns {UseQueryResult} Query state.
 */
export function useTreasuryEntrySearch(text: string) {
  const trimmed = text.trim();
  return useQuery({
    enabled: trimmed.length >= 2,
    queryKey: [...treasuryKey, 'search', trimmed],
    queryFn: async () => (await execute(EntrySearchDocument, { text: trimmed })).treasuryEntrySearch,
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
    setInvoiceCategories: useTreasuryMutation(
      async (variables: { invoiceCategoryId: string | null; creditNoteCategoryId: string | null }) => (await execute(SetInvoiceCategories, variables)).setInvoiceTreasuryCategories,
    ),
    createAccount: useTreasuryMutation(async (input: AccountValues) => (await execute(CreateAccount, { input })).createTreasuryAccount),
    updateAccount: useTreasuryMutation(async (variables: { id: string; input: AccountValues }) => (await execute(UpdateAccount, variables)).updateTreasuryAccount),
    deleteAccount: useTreasuryMutation(async (id: string) => (await execute(DeleteAccount, { id })).deleteTreasuryAccount),
    createEntry: useTreasuryMutation(async (input: TreasuryEntryInput) => (await execute(CreateEntry, { input } as never)).createTreasuryEntry),
    updateEntry: useTreasuryMutation(async (variables: { id: string; input: TreasuryEntryInput }) => (await execute(UpdateEntry, variables as never)).updateTreasuryEntry),
    deleteEntry: useTreasuryMutation(async (id: string) => (await execute(DeleteEntry, { id })).deleteTreasuryEntry),
    createCategory: useTreasuryMutation(async (input: TreasuryCategoryInput) => (await execute(CreateCategory, { input })).createTreasuryCategory),
    updateCategory: useTreasuryMutation(async (variables: { id: string; input: TreasuryCategoryInput }) => (await execute(UpdateCategory, variables)).updateTreasuryCategory),
    deleteCategory: useTreasuryMutation(async (id: string) => (await execute(DeleteCategory, { id })).deleteTreasuryCategory),
    createMethod: useTreasuryMutation(async (input: TreasuryPaymentMethodInput) => (await execute(CreateMethod, { input })).createTreasuryPaymentMethod),
    updateMethod: useTreasuryMutation(async (variables: { id: string; input: TreasuryPaymentMethodInput }) => (await execute(UpdateMethod, variables)).updateTreasuryPaymentMethod),
    deleteMethod: useTreasuryMutation(async (id: string) => (await execute(DeleteMethod, { id })).deleteTreasuryPaymentMethod),
    createCounterparty: useTreasuryMutation(async (input: TreasuryCounterpartyInput) => (await execute(CreateCounterparty, { input } as never)).createTreasuryCounterparty),
    updateCounterparty: useTreasuryMutation(
      async (variables: { id: string; input: TreasuryCounterpartyInput }) => (await execute(UpdateCounterparty, variables as never)).updateTreasuryCounterparty,
    ),
    deleteCounterparty: useTreasuryMutation(async (id: string) => (await execute(DeleteCounterparty, { id })).deleteTreasuryCounterparty),
    realize: useTreasuryMutation(
      async (variables: { id: string; occurrence: string; date: string; amount: number }) => (await execute(RealizeForecast, variables)).realizeTreasuryForecast,
    ),
  };
}

const AddMember = graphql(`
  mutation AddTreasuryMember($contributorId: ID, $name: String) {
    addTreasuryMember(contributorId: $contributorId, name: $name)
  }
`);

const RemoveMember = graphql(`
  mutation RemoveTreasuryMember($contributorId: ID!) {
    removeTreasuryMember(contributorId: $contributorId)
  }
`);

const SaveRelation = graphql(`
  mutation SaveTreasuryRelation($id: ID, $input: TreasuryRelationInput!) {
    saveTreasuryRelation(id: $id, input: $input)
  }
`);

const DeleteRelation = graphql(`
  mutation DeleteTreasuryRelation($id: ID!) {
    deleteTreasuryRelation(id: $id)
  }
`);

const SaveContext = graphql(`
  mutation SaveTreasuryContext($id: ID, $input: TreasuryContextInput!) {
    saveTreasuryContext(id: $id, input: $input)
  }
`);

const DeleteContext = graphql(`
  mutation DeleteTreasuryContext($id: ID!) {
    deleteTreasuryContext(id: $id)
  }
`);

const SaveContextPeriod = graphql(`
  mutation SaveTreasuryContextPeriod($id: ID, $input: TreasuryContextPeriodInput!) {
    saveTreasuryContextPeriod(id: $id, input: $input)
  }
`);

const DeleteContextPeriod = graphql(`
  mutation DeleteTreasuryContextPeriod($id: ID!) {
    deleteTreasuryContextPeriod(id: $id)
  }
`);

/**
 * Members of the team or household, relations, contexts and their planned periods. A member is a contributor: adding one
 * also refreshes the contributors of the tasks and projects.
 * @returns {object} Mutations.
 */
export function useTreasuryTeamMutations() {
  const queryClient = useQueryClient();
  const contributorsChanged = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: accountingQueryKey }),
      queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKey }),
    ]);
  return {
    addMember: useMutation({
      mutationFn: async (variables: { contributorId?: string; name?: string }) => (await execute(AddMember, variables)).addTreasuryMember,
      onSettled: contributorsChanged,
    }),
    removeMember: useMutation({
      mutationFn: async (contributorId: string) => (await execute(RemoveMember, { contributorId })).removeTreasuryMember,
      onSettled: contributorsChanged,
    }),
    saveRelation: useTreasuryMutation(async (variables: { id: string | null; input: { name: string; note: string | null; contributorId: string | null } }) => (await execute(SaveRelation, variables)).saveTreasuryRelation),
    deleteRelation: useTreasuryMutation(async (id: string) => (await execute(DeleteRelation, { id })).deleteTreasuryRelation),
    saveContext: useTreasuryMutation(async (variables: { id: string | null; input: { name: string; color: string } }) => (await execute(SaveContext, variables)).saveTreasuryContext),
    deleteContext: useTreasuryMutation(async (id: string) => (await execute(DeleteContext, { id })).deleteTreasuryContext),
    saveContextPeriod: useTreasuryMutation(
      async (variables: { id: string | null; input: { contextId: string; startDate: string; endDate: string; note: string | null } }) =>
        (await execute(SaveContextPeriod, variables)).saveTreasuryContextPeriod,
    ),
    deleteContextPeriod: useTreasuryMutation(async (id: string) => (await execute(DeleteContextPeriod, { id })).deleteTreasuryContextPeriod),
  };
}

const BudgetsDocument = graphql(`
  query TreasuryBudgets($from: String!, $to: String!) {
    treasuryBudgets {
      id
      month
      memberId
      relationId
      contextId
      categoryId
      amount
      repeatEvery
      repeatUntil
    }
    treasuryBudgetReport(from: $from, to: $to) {
      month
      memberId
      relationId
      contextId
      categoryId
      budget
      actual
      forecast
      budgeted
    }
  }
`);

const SaveBudget = graphql(`
  mutation SaveTreasuryBudget($id: ID, $input: TreasuryBudgetInput!) {
    saveTreasuryBudget(id: $id, input: $input)
  }
`);

const DeleteBudget = graphql(`
  mutation DeleteTreasuryBudget($id: ID!) {
    deleteTreasuryBudget(id: $id)
  }
`);

export type TreasuryBudget = TreasuryBudgetsQuery['treasuryBudgets'][number];
export type BudgetReportRow = TreasuryBudgetsQuery['treasuryBudgetReport'][number];

/**
 * Budgets, and their comparison with the movements of a range of months.
 * @param {string} from First month (YYYY-MM).
 * @param {string} to Last month (YYYY-MM).
 * @returns {UseQueryResult<TreasuryBudgetsQuery>} Query state.
 */
export function useTreasuryBudgets(from: string, to: string) {
  return useQuery({ queryKey: [...treasuryKey, 'budgets', from, to], queryFn: () => execute(BudgetsDocument, { from, to }), placeholderData: (previous) => previous });
}

/**
 * Budgets creation, change and deletion.
 * @returns {object} Mutations.
 */
export function useTreasuryBudgetMutations() {
  return {
    save: useTreasuryMutation(
      async (variables: {
        id: string | null;
        input: {
          month: string;
          memberId: string | null;
          relationId: string | null;
          contextId: string | null;
          categoryId: string;
          amount: number;
          repeatEvery: number | null;
          repeatUntil: string | null;
        };
      }) => (await execute(SaveBudget, variables)).saveTreasuryBudget,
    ),
    remove: useTreasuryMutation(async (id: string) => (await execute(DeleteBudget, { id })).deleteTreasuryBudget),
  };
}

const LoansDocument = graphql(`
  query TreasuryLoans {
    treasuryLoans {
      relationId
      balance
      out
      in
      items {
        lineId
        entryId
        date
        label
        amount
      }
    }
  }
`);

const ImportStatement = graphql(`
  mutation ImportTreasuryStatement($accountId: ID!, $mapping: JSON, $rows: [TreasuryStatementRowInput!]!) {
    importTreasuryStatement(accountId: $accountId, mapping: $mapping, rows: $rows)
  }
`);

export type RelationLoans = TreasuryLoansQuery['treasuryLoans'][number];

/**
 * Loans with the relations, both ways.
 * @returns {UseQueryResult} Query state.
 */
export function useTreasuryLoans() {
  return useQuery({ queryKey: [...treasuryKey, 'loans'], queryFn: async () => (await execute(LoansDocument)).treasuryLoans });
}

/**
 * Import of the operations of a bank statement (new entries, or forecasts realized).
 * @returns {UseMutationResult} Mutation state.
 */
export function useImportStatement() {
  return useTreasuryMutation(
    async (variables: { accountId: string; mapping: unknown; rows: { date: string; label: string; amount: number; forecastId: string | null; occurrence: string | null }[] }) =>
      (await execute(ImportStatement, variables)).importTreasuryStatement as { created: number; realized: number },
  );
}
