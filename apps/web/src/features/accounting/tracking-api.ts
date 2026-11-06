import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentPaymentInput, DocumentStatusCategory, DocumentStatusScope } from '@ordo/shared';
import { graphql } from '../../graphql';
import type { DocumentStatusesQuery, OverdueInvoicesQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { accountingQueryKey } from './api';

export type DocumentStatus = DocumentStatusesQuery['documentStatuses'][number];
export type OverdueInvoice = OverdueInvoicesQuery['overdueInvoices'][number];

const DocumentStatusesDocument = graphql(`
  query DocumentStatuses {
    documentStatuses {
      id
      scope
      name
      color
      category
      position
      documentCount
    }
  }
`);

const OverdueInvoicesDocument = graphql(`
  query OverdueInvoices($today: Date!) {
    overdueInvoices(today: $today) {
      id
      type
      number
      clientId
      clientName
      projectId
      contactId
      serviceId
      issueDate
      dueDate
      totalGross
      currency
      balance
      billingEmail
      reminderCount
      lastReminderAt
    }
  }
`);

const SendReminders = graphql(`
  mutation SendDocumentReminders($accountId: ID!, $documentIds: [ID!]!) {
    sendDocumentReminders(accountId: $accountId, documentIds: $documentIds) {
      documentId
      number
      error
    }
  }
`);

const CreateStatus = graphql(`
  mutation CreateDocumentStatus($scope: DocumentStatusScope!, $name: String!, $color: String!, $category: DocumentStatusCategory!) {
    createDocumentStatus(scope: $scope, name: $name, color: $color, category: $category)
  }
`);
const UpdateStatus = graphql(`
  mutation UpdateDocumentStatus($id: ID!, $name: String, $color: String, $category: DocumentStatusCategory) {
    updateDocumentStatus(id: $id, name: $name, color: $color, category: $category)
  }
`);
const DeleteStatus = graphql(`
  mutation DeleteDocumentStatus($id: ID!) {
    deleteDocumentStatus(id: $id)
  }
`);
const MoveStatus = graphql(`
  mutation MoveDocumentStatus($id: ID!, $index: Int!) {
    moveDocumentStatus(id: $id, index: $index)
  }
`);
const SetTrackingStatus = graphql(`
  mutation SetDocumentTrackingStatus($id: ID!, $statusId: ID!) {
    setDocumentTrackingStatus(id: $id, statusId: $statusId)
  }
`);
const MarkSent = graphql(`
  mutation MarkDocumentSent($id: ID!) {
    markDocumentSent(id: $id)
  }
`);
const AcceptQuote = graphql(`
  mutation AcceptQuote($id: ID!, $date: Date!, $file: File) {
    acceptQuote(id: $id, date: $date, file: $file)
  }
`);
const RemoveSignedQuote = graphql(`
  mutation RemoveSignedQuote($id: ID!) {
    removeSignedQuote(id: $id)
  }
`);
const AddReminder = graphql(`
  mutation AddDocumentReminder($id: ID!, $note: String) {
    addDocumentReminder(id: $id, note: $note)
  }
`);
const DeleteReminder = graphql(`
  mutation DeleteDocumentReminder($id: ID!) {
    deleteDocumentReminder(id: $id)
  }
`);
const RecordPayment = graphql(`
  mutation RecordDocumentPayment($id: ID!, $input: DocumentPaymentInput!) {
    recordDocumentPayment(id: $id, input: $input)
  }
`);

/**
 * Tracking statuses of the documents, by scope and position.
 * @returns {UseQueryResult} Query state.
 */
export function useDocumentStatuses() {
  return useQuery({ queryKey: [...accountingQueryKey, 'statuses'], queryFn: async () => (await execute(DocumentStatusesDocument)).documentStatuses });
}

/**
 * Final invoices still due after their due date, with their reminders.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {UseQueryResult} Query state.
 */
export function useOverdueInvoices(today: string) {
  return useQuery({ queryKey: [...accountingQueryKey, 'overdue', today], queryFn: async () => (await execute(OverdueInvoicesDocument, { today })).overdueInvoices });
}

/**
 * Mutation refreshing the accounting data (documents, statuses, treasury) once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useAccountingMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: accountingQueryKey }) });
}

/**
 * Edition of the tracking statuses of a scope (shaped for the label manager).
 * @param {DocumentStatusScope} scope Quotes or invoices.
 * @returns {object} Mutations.
 */
export function useDocumentStatusMutations(scope: DocumentStatusScope) {
  return {
    create: useAccountingMutation(
      async (input: { name: string; color: string; category?: DocumentStatusCategory }) =>
        (await execute(CreateStatus, { scope, name: input.name, color: input.color, category: input.category ?? 'SENT' })).createDocumentStatus,
    ),
    update: useAccountingMutation(
      async ({ id, input }: { id: string; input: { name?: string; color?: string; category?: DocumentStatusCategory } }) =>
        (await execute(UpdateStatus, { id, ...input })).updateDocumentStatus,
    ),
    remove: useAccountingMutation(async ({ id }: { id: string }) => (await execute(DeleteStatus, { id })).deleteDocumentStatus),
    move: useAccountingMutation(async (variables: { id: string; index: number }) => (await execute(MoveStatus, variables)).moveDocumentStatus),
  };
}

/**
 * Tracking of a final document: status, sending, acceptance, reminders, payments.
 * @returns {object} Mutations.
 */
export function useTrackingMutations() {
  return {
    setStatus: useAccountingMutation(async (variables: { id: string; statusId: string }) => (await execute(SetTrackingStatus, variables)).setDocumentTrackingStatus),
    markSent: useAccountingMutation(async (id: string) => (await execute(MarkSent, { id })).markDocumentSent),
    accept: useAccountingMutation(async (variables: { id: string; date: string; file: File | null }) => (await execute(AcceptQuote, variables)).acceptQuote),
    removeSigned: useAccountingMutation(async (id: string) => (await execute(RemoveSignedQuote, { id })).removeSignedQuote),
    addReminder: useAccountingMutation(async (variables: { id: string; note: string | null }) => (await execute(AddReminder, variables)).addDocumentReminder),
    sendReminders: useAccountingMutation(
      async (variables: { accountId: string; documentIds: string[] }) => (await execute(SendReminders, variables)).sendDocumentReminders,
    ),
    deleteReminder: useAccountingMutation(async (id: string) => (await execute(DeleteReminder, { id })).deleteDocumentReminder),
    recordPayment: useAccountingMutation(
      async (variables: { id: string; input: DocumentPaymentInput }) =>
        (await execute(RecordPayment, { id: variables.id, input: { ...variables.input, methodId: variables.input.methodId ?? null } })).recordDocumentPayment,
    ),
  };
}
