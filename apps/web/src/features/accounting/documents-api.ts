import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountingDocumentInput } from '@ordo/shared';
import { graphql } from '../../graphql';
import type {
  AccountingDocumentFieldsFragment,
  AccountingDocumentListFieldsFragment,
  AccountingDocumentType,
  ImportedDocumentInput,
  ImportedDocumentsQuery,
  ProjectResourcesQuery,
  RecurringInvoicesQuery,
} from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { accountingQueryKey } from './api';

export type AccountingDocument = AccountingDocumentFieldsFragment;
export type AccountingDocumentSummary = AccountingDocumentListFieldsFragment;
export type RecurringInvoice = RecurringInvoicesQuery['recurringInvoices'][number];
export type ProjectResource = ProjectResourcesQuery['projectResources'][number];

graphql(`
  fragment AccountingDocumentListFields on AccountingDocument {
    id
    type
    status
    number
    issueDate
    dueDate
    clientId
    clientName
    projectId
    title
    totalNet
    totalGross
    currency
    invoicedNet
    sourceNumber
    recurringId
    trackingStatus {
      id
      name
      color
      category
    }
    balance
    overdue
  }
`);

graphql(`
  fragment AccountingDocumentFields on AccountingDocument {
    ...AccountingDocumentListFields
    serviceStart
    serviceEnd
    serviceId
    contactId
    sourceId
    derived {
      id
      type
      status
      number
      totalGross
    }
    seller
    buyer
    introduction
    referenceLabel
    referenceValue
    conclusion
    paymentTerms
    paymentMethods
    lateInterest
    otherMentions
    showBankDetails
    vatApplicable
    vatExemptionText
    globalDiscountType
    globalDiscountValue
    totalVat
    finalizedAt
    updatedAt
    sentAt
    acceptedAt
    signedFileUrl
    signedFileName
    paid
    credited
    reminders {
      id
      date
      note
    }
    payments {
      id
      amount
      entry {
        id
        date
        accountName
        method
      }
    }
    lines {
      id
      kind
      title
      description
      quantity
      unit
      unitPrice
      vatRate
      discountType
      discountValue
    }
    attachments {
      id
      name
      size
      url
    }
  }
`);

const DocumentsDocument = graphql(`
  query AccountingDocuments($clientId: ID, $projectId: ID) {
    accountingDocuments(clientId: $clientId, projectId: $projectId) {
      ...AccountingDocumentListFields
    }
  }
`);

const DocumentDocument = graphql(`
  query AccountingDocument($id: ID!) {
    accountingDocument(id: $id) {
      ...AccountingDocumentFields
    }
  }
`);

const DefaultsDocument = graphql(`
  query NewDocumentDefaults($type: AccountingDocumentType!, $clientId: ID!, $issueDate: Date!) {
    newDocumentDefaults(type: $type, clientId: $clientId, issueDate: $issueDate)
  }
`);

const RecurringInvoicesDocument = graphql(`
  query RecurringInvoices {
    recurringInvoices {
      id
      name
      templateId
      recurrence
      startDate
      nextDate
      autoFinalize
      active
      issuedCount
      template {
        clientName
        totalGross
        currency
      }
    }
  }
`);

const ProjectResourcesDocument = graphql(`
  query ProjectResources($projectId: ID!) {
    projectResources(projectId: $projectId) {
      id
      kind
      title
      note
      url
      size
      createdAt
    }
  }
`);

const CreateDocument = graphql(`
  mutation CreateAccountingDocument($type: AccountingDocumentType!, $input: AccountingDocumentInput!) {
    createAccountingDocument(type: $type, input: $input)
  }
`);
const UpdateDocument = graphql(`
  mutation UpdateAccountingDocument($id: ID!, $input: AccountingDocumentInput!) {
    updateAccountingDocument(id: $id, input: $input)
  }
`);
const DeleteDocument = graphql(`
  mutation DeleteAccountingDocument($id: ID!) {
    deleteAccountingDocument(id: $id)
  }
`);
const FinalizeDocument = graphql(`
  mutation FinalizeAccountingDocument($id: ID!) {
    finalizeAccountingDocument(id: $id)
  }
`);
const CreateFromDocument = graphql(`
  mutation CreateDocumentFrom($sourceId: ID!, $type: AccountingDocumentType!, $depositPercent: Float, $issueDate: Date!) {
    createDocumentFrom(sourceId: $sourceId, type: $type, depositPercent: $depositPercent, issueDate: $issueDate)
  }
`);
const DuplicateDocument = graphql(`
  mutation DuplicateAccountingDocument($id: ID!, $issueDate: Date!) {
    duplicateAccountingDocument(id: $id, issueDate: $issueDate)
  }
`);
const AddAttachments = graphql(`
  mutation AddAccountingAttachments($id: ID!, $files: [File!]!) {
    addAccountingAttachments(id: $id, files: $files)
  }
`);
const RemoveAttachment = graphql(`
  mutation RemoveAccountingAttachment($attachmentId: ID!) {
    removeAccountingAttachment(attachmentId: $attachmentId)
  }
`);
const CreateRecurring = graphql(`
  mutation CreateRecurringInvoice($documentId: ID!, $input: RecurringInvoiceInput!) {
    createRecurringInvoice(documentId: $documentId, input: $input)
  }
`);
const UpdateRecurring = graphql(`
  mutation UpdateRecurringInvoice($id: ID!, $input: RecurringInvoiceInput!) {
    updateRecurringInvoice(id: $id, input: $input)
  }
`);
const DeleteRecurring = graphql(`
  mutation DeleteRecurringInvoice($id: ID!) {
    deleteRecurringInvoice(id: $id)
  }
`);
const AddProjectLink = graphql(`
  mutation AddProjectLink($projectId: ID!, $title: String!, $url: String!, $note: String) {
    addProjectLink(projectId: $projectId, title: $title, url: $url, note: $note)
  }
`);
const AddProjectFiles = graphql(`
  mutation AddProjectFiles($projectId: ID!, $files: [File!]!) {
    addProjectFiles(projectId: $projectId, files: $files)
  }
`);
const UpdateProjectResource = graphql(`
  mutation UpdateProjectResource($id: ID!, $title: String!, $url: String, $note: String) {
    updateProjectResource(id: $id, title: $title, url: $url, note: $note)
  }
`);
const DeleteProjectResource = graphql(`
  mutation DeleteProjectResource($id: ID!) {
    deleteProjectResource(id: $id)
  }
`);
const MoveProjectResource = graphql(`
  mutation MoveProjectResource($id: ID!, $index: Int!) {
    moveProjectResource(id: $id, index: $index)
  }
`);

/**
 * Documents (recurring models excluded), latest first, optionally of a client or a project.
 * @param {{ clientId?: string, projectId?: string }} [filter] Filter. Optional.
 * @returns {UseQueryResult} Query state.
 */
export function useAccountingDocuments(filter: { clientId?: string; projectId?: string } = {}) {
  return useQuery({
    queryKey: [...accountingQueryKey, 'documents', filter],
    queryFn: async () => (await execute(DocumentsDocument, filter)).accountingDocuments,
  });
}

/**
 * One document with its lines.
 * @param {string} id Document.
 * @returns {UseQueryResult} Query state.
 */
export function useAccountingDocument(id: string) {
  return useQuery({ queryKey: [...accountingQueryKey, 'document', id], queryFn: async () => (await execute(DocumentDocument, { id })).accountingDocument });
}

/**
 * Fields of a new document of a client.
 * @param {{ type: AccountingDocumentType, clientId: string, issueDate: string }} variables Type, client and date.
 * @returns {Promise<AccountingDocumentInput>} Fields.
 */
export async function fetchNewDocumentDefaults(variables: { type: AccountingDocumentType; clientId: string; issueDate: string }): Promise<AccountingDocumentInput> {
  return (await execute(DefaultsDocument, variables)).newDocumentDefaults as AccountingDocumentInput;
}

/**
 * Recurring invoices.
 * @returns {UseQueryResult} Query state.
 */
export function useRecurringInvoices() {
  return useQuery({ queryKey: [...accountingQueryKey, 'recurring'], queryFn: async () => (await execute(RecurringInvoicesDocument)).recurringInvoices });
}

/**
 * Files and links of a project.
 * @param {string} projectId Project.
 * @returns {UseQueryResult} Query state.
 */
export function useProjectResources(projectId: string) {
  return useQuery({
    queryKey: [...accountingQueryKey, 'resources', projectId],
    queryFn: async () => (await execute(ProjectResourcesDocument, { projectId })).projectResources,
  });
}

/**
 * Mutation refreshing the accounting data once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useAccountingMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: accountingQueryKey }) });
}

/**
 * Document actions.
 * @returns {object} Mutations.
 */
export function useDocumentMutations() {
  return {
    create: useAccountingMutation(
      async (variables: { type: AccountingDocumentType; input: AccountingDocumentInput }) =>
        (await execute(CreateDocument, variables as never)).createAccountingDocument,
    ),
    update: useAccountingMutation(
      async (variables: { id: string; input: AccountingDocumentInput }) => (await execute(UpdateDocument, variables as never)).updateAccountingDocument,
    ),
    remove: useAccountingMutation(async (id: string) => (await execute(DeleteDocument, { id })).deleteAccountingDocument),
    finalize: useAccountingMutation(async (id: string) => (await execute(FinalizeDocument, { id })).finalizeAccountingDocument),
    createFrom: useAccountingMutation(
      async (variables: { sourceId: string; type: AccountingDocumentType; depositPercent?: number | null; issueDate: string }) =>
        (await execute(CreateFromDocument, variables)).createDocumentFrom,
    ),
    duplicate: useAccountingMutation(async (variables: { id: string; issueDate: string }) => (await execute(DuplicateDocument, variables)).duplicateAccountingDocument),
    addAttachments: useAccountingMutation(async (variables: { id: string; files: File[] }) => (await execute(AddAttachments, variables)).addAccountingAttachments),
    removeAttachment: useAccountingMutation(async (attachmentId: string) => (await execute(RemoveAttachment, { attachmentId })).removeAccountingAttachment),
  };
}

export interface RecurringSettings {
  name: string;
  recurrence: unknown;
  startDate: string;
  autoFinalize: boolean;
  active: boolean;
}

/**
 * Recurring invoices edition.
 * @returns {object} Mutations.
 */
export function useRecurringMutations() {
  return {
    create: useAccountingMutation(async (variables: { documentId: string; input: RecurringSettings }) => (await execute(CreateRecurring, variables)).createRecurringInvoice),
    update: useAccountingMutation(async (variables: { id: string; input: RecurringSettings }) => (await execute(UpdateRecurring, variables)).updateRecurringInvoice),
    remove: useAccountingMutation(async (id: string) => (await execute(DeleteRecurring, { id })).deleteRecurringInvoice),
  };
}

/**
 * Project files and links.
 * @returns {object} Mutations.
 */
export function useProjectResourceMutations() {
  return {
    addLink: useAccountingMutation(
      async (variables: { projectId: string; title: string; url: string; note?: string | null }) => (await execute(AddProjectLink, variables)).addProjectLink,
    ),
    addFiles: useAccountingMutation(async (variables: { projectId: string; files: File[] }) => (await execute(AddProjectFiles, variables)).addProjectFiles),
    update: useAccountingMutation(
      async (variables: { id: string; title: string; url?: string | null; note?: string | null }) => (await execute(UpdateProjectResource, variables)).updateProjectResource,
    ),
    remove: useAccountingMutation(async (id: string) => (await execute(DeleteProjectResource, { id })).deleteProjectResource),
    move: useAccountingMutation(async (variables: { id: string; index: number }) => (await execute(MoveProjectResource, variables)).moveProjectResource),
  };
}


const ImportedDocumentsDocument = graphql(`
  query ImportedDocuments($clientId: ID, $projectId: ID) {
    importedDocuments(clientId: $clientId, projectId: $projectId) {
      id
      type
      number
      issueDate
      dueDate
      clientId
      clientName
      projectId
      title
      totalNet
      totalVat
      totalGross
      currency
      note
      fileUrl
      fileName
      settled
      paid
      balance
    }
  }
`);
const ImportDocument = graphql(`
  mutation ImportDocument($input: ImportedDocumentInput!, $file: File) {
    importDocument(input: $input, file: $file)
  }
`);
const UpdateImportedDocument = graphql(`
  mutation UpdateImportedDocument($id: ID!, $input: ImportedDocumentInput!, $file: File) {
    updateImportedDocument(id: $id, input: $input, file: $file)
  }
`);
const DeleteImportedDocument = graphql(`
  mutation DeleteImportedDocument($id: ID!) {
    deleteImportedDocument(id: $id)
  }
`);

export type ImportedDocument = ImportedDocumentsQuery['importedDocuments'][number];
export type { ImportedDocumentInput };

/**
 * Imported quotes and invoices, optionally of a client or a project.
 * @param {{ clientId?: string, projectId?: string }} [filter] Filter. Optional.
 * @returns {UseQueryResult} Query state.
 */
export function useImportedDocuments(filter: { clientId?: string; projectId?: string } = {}) {
  return useQuery({
    queryKey: [...accountingQueryKey, 'imported', filter],
    queryFn: async () => (await execute(ImportedDocumentsDocument, filter)).importedDocuments,
  });
}

/**
 * Imported documents edition.
 * @returns {object} Mutations.
 */
export function useImportedDocumentMutations() {
  return {
    create: useAccountingMutation(async (variables: { input: ImportedDocumentInput; file: File | null }) => (await execute(ImportDocument, variables)).importDocument),
    update: useAccountingMutation(
      async (variables: { id: string; input: ImportedDocumentInput; file: File | null }) => (await execute(UpdateImportedDocument, variables)).updateImportedDocument,
    ),
    remove: useAccountingMutation(async (id: string) => (await execute(DeleteImportedDocument, { id })).deleteImportedDocument),
  };
}
