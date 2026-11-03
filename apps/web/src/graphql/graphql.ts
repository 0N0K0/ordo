/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type AccountingDocumentInput = {
  billingSchedule?: string | null | undefined;
  clientId: string | number;
  conclusion?: string | null | undefined;
  contactId?: string | number | null | undefined;
  depositType?: DiscountType | null | undefined;
  depositValue?: number | null | undefined;
  dueDate?: string | null | undefined;
  globalDiscountType?: DiscountType | null | undefined;
  globalDiscountValue?: number | null | undefined;
  introduction?: string | null | undefined;
  issueDate: string;
  lateInterest?: string | null | undefined;
  lines: Array<AccountingLineInput>;
  otherMentions?: string | null | undefined;
  paymentMethods?: string | null | undefined;
  paymentTerms?: string | null | undefined;
  projectId?: string | number | null | undefined;
  referenceLabel?: string | null | undefined;
  referenceValue?: string | null | undefined;
  serviceEnd?: string | null | undefined;
  serviceId?: string | number | null | undefined;
  serviceStart?: string | null | undefined;
  showBankDetails: boolean;
  /** Tracked time billed on the document (replaces the previous ones); unchanged when omitted. */
  timeEntryIds?: Array<string | number> | null | undefined;
  title?: string | null | undefined;
  vatApplicable: boolean;
};

export type AccountingDocumentStatus =
  | 'DRAFT'
  | 'FINAL'
  | 'TEMPLATE';

export type AccountingDocumentType =
  | 'CREDIT_NOTE'
  | 'DEPOSIT_INVOICE'
  | 'INVOICE'
  | 'QUOTE';

export type AccountingLineInput = {
  description?: string | null | undefined;
  discountType?: DiscountType | null | undefined;
  discountValue?: number | null | undefined;
  kind: AccountingLineKind;
  quantity: number;
  title: string;
  unit: AccountingUnit;
  unitPrice: number;
  vatRate: number;
};

export type AccountingLineKind =
  | 'DEDUCTION'
  | 'DISBURSEMENT'
  | 'ITEM'
  | 'TEXT';

export type AccountingUnit =
  | 'DAY'
  | 'DEPOSIT'
  | 'FLAT'
  | 'HOUR'
  | 'MONTH'
  | 'UNIT';

export type AlarmFrequency =
  | 'DAILY'
  | 'MONTHLY'
  | 'ONCE'
  | 'WEEKLY';

export type AlarmInput = {
  enabled: boolean;
  endDate?: string | null | undefined;
  frequency: AlarmFrequency;
  interval: number;
  minutes?: number | null | undefined;
  note?: string | null | undefined;
  projectId?: string | number | null | undefined;
  startDate?: string | null | undefined;
  taskId?: string | number | null | undefined;
  /** HH:MM, local time. */
  time?: string | null | undefined;
  title: string;
  type: AlarmType;
  /** 1 (Monday) to 7 (Sunday). */
  weekdays: Array<number>;
};

export type AlarmType =
  | 'NOT_TRACKING'
  | 'REMINDER'
  | 'TRACKING_DURATION';

/** Omitted fields are left unchanged; null clears a field. */
export type BulkTaskInput = {
  addAssigneeIds?: Array<string | number> | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  milestoneId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  removeAssigneeIds?: Array<string | number> | null | undefined;
  sprintId?: string | number | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  typeId?: string | number | null | undefined;
};

export type CalendarCategoryInput = {
  color: string;
  name: string;
  parentId?: string | number | null | undefined;
};

/** Times are local to timeZone; all-day events have none. */
export type CalendarEventInput = {
  allDay: boolean;
  categoryIds: Array<string | number>;
  contributorIds: Array<string | number>;
  description?: string | null | undefined;
  endDate: string;
  endTime?: string | null | undefined;
  links: Array<CalendarLinkInput>;
  location?: string | null | undefined;
  projectId?: string | number | null | undefined;
  recurrence?: unknown;
  /** Minutes before the start. */
  reminders: Array<number>;
  startDate: string;
  startTime?: string | null | undefined;
  timeZone: string;
  title: string;
};

/** Scope of a change to a recurring event. */
export type CalendarEventScope =
  | 'ALL'
  | 'FOLLOWING'
  | 'THIS';

export type CalendarLinkInput = {
  label: string;
  url: string;
};

export type CatalogItemInput = {
  archived: boolean;
  description?: string | null | undefined;
  /** ITEM or DISBURSEMENT. */
  kind: AccountingLineKind;
  title: string;
  unit: AccountingUnit;
  unitPrice: number;
  vatRate: number;
};

export type ClientContactInput = {
  email: string;
  firstName: string;
  jobTitle: string;
  lastName: string;
  phones: unknown;
  serviceId?: string | number | null | undefined;
};

export type ClientDetailsInput = {
  activityCode: string;
  address?: unknown;
  email: string;
  firstName: string;
  kind: ClientKind;
  lastName: string;
  phones: unknown;
  siren: string;
  siret: string;
  vatNumber: string;
  website: string;
};

export type ClientInput = {
  color?: string | null | undefined;
  icon?: File | null | undefined;
  name: string;
};

export type ClientKind =
  | 'COMPANY'
  | 'INDIVIDUAL';

export type ClientServiceInput = {
  address?: unknown;
  email: string;
  name: string;
  phones: unknown;
};

export type ClientUpdateInput = {
  /** null clears the color. */
  color?: string | null | undefined;
  /** Replaces the current icon. */
  icon?: File | null | undefined;
  name?: string | null | undefined;
  removeIcon?: boolean | null | undefined;
};

export type CompanyProfileInput = {
  accountHolder: string;
  activityCode: string;
  address?: unknown;
  bankName: string;
  bic: string;
  capital: string;
  email: string;
  iban: string;
  lateInterest: string;
  legalForm: string;
  name: string;
  otherMentions: string;
  paymentDays: number;
  paymentMethods: string;
  paymentTerms: string;
  phone: string;
  quoteValidityDays: number;
  referenceLabel: string;
  registration: string;
  siren: string;
  siret: string;
  vatApplicable: boolean;
  vatExemptionText: string;
  vatNumber: string;
  website: string;
};

export type ContributorInput = {
  avatar?: File | null | undefined;
  handle: string;
  name: string;
  /** Projects the contributor is directly attached to. */
  projectIds?: Array<string | number> | null | undefined;
};

export type ContributorUpdateInput = {
  avatar?: File | null | undefined;
  handle?: string | null | undefined;
  name?: string | null | undefined;
  /** Projects the contributor is directly attached to. */
  projectIds?: Array<string | number> | null | undefined;
  removeAvatar?: boolean | null | undefined;
};

export type DashboardChartInput = {
  config: unknown;
  title: string;
  wide: boolean;
};

export type DiscountType =
  | 'AMOUNT'
  | 'PERCENT';

export type DocumentPaymentInput = {
  accountId: string | number;
  amount: number;
  date: string;
  method?: string | null | undefined;
};

export type DocumentStatusCategory =
  | 'ACCEPTED'
  | 'PAID'
  | 'REFUSED'
  | 'SENT'
  | 'TO_SEND';

export type DocumentStatusScope =
  | 'INVOICE'
  | 'QUOTE';

export type ImportedDocumentInput = {
  clientId?: string | number | null | undefined;
  clientName?: string | null | undefined;
  currency: string;
  dueDate?: string | null | undefined;
  issueDate: string;
  note?: string | null | undefined;
  number: string;
  projectId?: string | number | null | undefined;
  settled: boolean;
  title?: string | null | undefined;
  totalGross: number;
  totalNet: number;
  totalVat: number;
  type: AccountingDocumentType;
};

/** Empty passwords keep the saved ones on edition. */
export type MailAccountInput = {
  displayName: string;
  email: string;
  imapHost: string;
  imapPassword: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  name: string;
  saveSent: boolean;
  smtpHost: string;
  smtpPassword: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
};

/** Files of another message to attach again (forward, or files kept from a draft). */
export type MailAttachmentsFromInput = {
  accountId: string | number;
  folder: string;
  /** Attachment numbers; omitted: every file that is not an inline image. */
  indexes?: Array<number> | null | undefined;
  uid: number;
};

export type MailLocationInput = {
  accountId: string | number;
  folder: string;
  uid: number;
};

export type MilestoneInput = {
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  projectId: string | number;
  title: string;
};

/** Omitted fields are left unchanged; null clears a field. */
export type MilestoneUpdateInput = {
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  title?: string | null | undefined;
};

export type ProjectCategoryInput = {
  color: string;
  name: string;
};

export type ProjectCategoryUpdateInput = {
  color?: string | null | undefined;
  name?: string | null | undefined;
};

export type ProjectInput = {
  categoryIds?: Array<string | number> | null | undefined;
  /** Client of a root project; a sub-project inherits the client of its parent. */
  clientId?: string | number | null | undefined;
  color?: string | null | undefined;
  description?: string | null | undefined;
  endDate?: string | null | undefined;
  icon?: File | null | undefined;
  parentId?: string | number | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  title: string;
};

export type ProjectResourceKind =
  | 'FILE'
  | 'LINK';

export type ProjectStatusInput = {
  color: string;
  name: string;
};

export type ProjectStatusUpdateInput = {
  color?: string | null | undefined;
  name?: string | null | undefined;
};

export type ProjectUpdateInput = {
  categoryIds?: Array<string | number> | null | undefined;
  /** null detaches the project from its client; omitted leaves it unchanged. */
  clientId?: string | number | null | undefined;
  color?: string | null | undefined;
  description?: string | null | undefined;
  endDate?: string | null | undefined;
  /** Replaces the current icon. */
  icon?: File | null | undefined;
  /** null makes it a root project; omitted leaves it unchanged. */
  parentId?: string | number | null | undefined;
  removeIcon?: boolean | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  title?: string | null | undefined;
};

export type RecurringInvoiceInput = {
  active: boolean;
  autoFinalize: boolean;
  name: string;
  recurrence: unknown;
  startDate: string;
};

export type SaveMailDraftInput = {
  accountId: string | number;
  attachments?: Array<File> | null | undefined;
  attachmentsFrom?: MailAttachmentsFromInput | null | undefined;
  bcc?: Array<string> | null | undefined;
  cc?: Array<string> | null | undefined;
  html: string;
  inReplyTo?: string | null | undefined;
  projectId?: string | number | null | undefined;
  references?: Array<string> | null | undefined;
  /** Previous version of the draft, replaced. */
  replace?: MailLocationInput | null | undefined;
  subject: string;
  to: Array<string>;
};

export type SendMailInput = {
  accountId: string | number;
  attachments?: Array<File> | null | undefined;
  attachmentsFrom?: MailAttachmentsFromInput | null | undefined;
  bcc?: Array<string> | null | undefined;
  cc?: Array<string> | null | undefined;
  /** Draft the mail comes from, deleted once sent. */
  draft?: MailLocationInput | null | undefined;
  /** Body, signature and quote included. */
  html: string;
  inReplyTo?: string | null | undefined;
  /** Project the mail is written from: the sent mail is linked to it. */
  projectId?: string | number | null | undefined;
  references?: Array<string> | null | undefined;
  subject: string;
  to: Array<string>;
};

export type SprintInput = {
  endDate: string;
  goal?: string | null | undefined;
  name: string;
  startDate: string;
};

export type TaskInput = {
  assigneeIds?: Array<string | number> | null | undefined;
  description?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  milestoneId?: string | number | null | undefined;
  parentId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  projectId: string | number;
  sprintId?: string | number | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  title: string;
  typeId?: string | number | null | undefined;
};

export type TaskLabelInput = {
  /** Statuses only; defaults to TODO. */
  category?: TaskStatusCategory | null | undefined;
  color: string;
  name: string;
};

export type TaskLabelUpdateInput = {
  /** Statuses only. */
  category?: TaskStatusCategory | null | undefined;
  color?: string | null | undefined;
  name?: string | null | undefined;
};

export type TaskQueryInput = {
  /** Filter tree (and / or groups of conditions). */
  filter: unknown;
  includeArchived?: boolean | null | undefined;
  /** Quick search: number, title or description. */
  search?: string | null | undefined;
  /** User's current day, for relative dates. */
  today: string;
  /** User's offset from UTC, in minutes. */
  utcOffset: number;
};

/** Fixed meaning of a status: open (TODO, IN_PROGRESS) or closed (DONE, CANCELLED). */
export type TaskStatusCategory =
  | 'CANCELLED'
  | 'DONE'
  | 'IN_PROGRESS'
  | 'TODO';

/** Omitted fields are left unchanged; null clears a field. Use transferTask to change the project. */
export type TaskUpdateInput = {
  assigneeIds?: Array<string | number> | null | undefined;
  description?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  milestoneId?: string | number | null | undefined;
  parentId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  sprintId?: string | number | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  title?: string | null | undefined;
  typeId?: string | number | null | undefined;
};

export type TaskViewInput = {
  config: unknown;
  name: string;
  /** Project of the view; omitted or null for the home page. */
  projectId?: string | number | null | undefined;
};

export type TaskViewUpdateInput = {
  config?: unknown;
  name?: string | null | undefined;
};

export type TimeEntryInput = {
  description?: string | null | undefined;
  /** Seconds. */
  duration: number;
  projectId: string | number;
  startedAt: string;
  taskIds: Array<string | number>;
};

/** Omitted fields are left unchanged. The duration of the running timer cannot be changed. */
export type TimeEntryUpdateInput = {
  description?: string | null | undefined;
  /** Seconds. */
  duration?: number | null | undefined;
  projectId?: string | number | null | undefined;
  startedAt?: string | null | undefined;
  taskIds?: Array<string | number> | null | undefined;
};

export type TimerInput = {
  description?: string | null | undefined;
  projectId: string | number;
  taskIds: Array<string | number>;
};

export type TreasuryAccountInput = {
  archived: boolean;
  name: string;
  openingBalance: number;
  openingDate: string;
};

export type TreasuryAllocationInput = {
  amount: number;
  documentId?: string | number | null | undefined;
  importedDocumentId?: string | number | null | undefined;
};

export type TreasuryEntryInput = {
  accountId: string | number;
  allocations: Array<TreasuryAllocationInput>;
  amount: number;
  category?: string | null | undefined;
  date: string;
  label: string;
  method?: string | null | undefined;
  note?: string | null | undefined;
  projectId?: string | number | null | undefined;
  recurrence?: unknown;
  status: TreasuryEntryStatus;
};

export type TreasuryEntryStatus =
  | 'ACTUAL'
  | 'FORECAST';

export type CompanyProfileFieldsFragment = { name: string, legalForm: string | null, capital: string | null, registration: string | null, siren: string | null, siret: string | null, activityCode: string | null, vatNumber: string | null, vatApplicable: boolean, vatExemptionText: string, address: unknown, email: string | null, phone: string | null, website: string | null, logoUrl: string | null, bankName: string | null, accountHolder: string | null, iban: string | null, bic: string | null, paymentTerms: string, paymentDays: number, paymentMethods: string, lateInterest: string, otherMentions: string, referenceLabel: string, quoteValidityDays: number };

export type CompanyProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type CompanyProfileQuery = { companyProfile: { name: string, legalForm: string | null, capital: string | null, registration: string | null, siren: string | null, siret: string | null, activityCode: string | null, vatNumber: string | null, vatApplicable: boolean, vatExemptionText: string, address: unknown, email: string | null, phone: string | null, website: string | null, logoUrl: string | null, bankName: string | null, accountHolder: string | null, iban: string | null, bic: string | null, paymentTerms: string, paymentDays: number, paymentMethods: string, lateInterest: string, otherMentions: string, referenceLabel: string, quoteValidityDays: number } };

export type DocumentSequencesQueryVariables = Exact<{
  year: number;
}>;


export type DocumentSequencesQuery = { documentSequences: Array<{ type: AccountingDocumentType, year: number, nextNumber: number, minimum: number }> };

export type ClientBillingQueryVariables = Exact<{
  id: string | number;
}>;


export type ClientBillingQuery = { client: { id: string, name: string, kind: ClientKind, firstName: string | null, lastName: string | null, address: unknown, email: string | null, phones: unknown, website: string | null, vatNumber: string | null, siren: string | null, siret: string | null, activityCode: string | null, services: Array<{ id: string, name: string, address: unknown, email: string | null, phones: unknown }>, contacts: Array<{ id: string, serviceId: string | null, firstName: string, lastName: string, email: string | null, jobTitle: string | null, phones: unknown }> } | null };

export type UpdateCompanyProfileMutationVariables = Exact<{
  input: CompanyProfileInput;
}>;


export type UpdateCompanyProfileMutation = { updateCompanyProfile: { name: string } };

export type SetCompanyLogoMutationVariables = Exact<{
  file?: File | null | undefined;
}>;


export type SetCompanyLogoMutation = { setCompanyLogo: { logoUrl: string | null } };

export type SetDocumentSequenceMutationVariables = Exact<{
  type: AccountingDocumentType;
  year: number;
  nextNumber: number;
}>;


export type SetDocumentSequenceMutation = { setDocumentSequence: boolean };

export type UpdateClientDetailsMutationVariables = Exact<{
  id: string | number;
  input: ClientDetailsInput;
}>;


export type UpdateClientDetailsMutation = { updateClientDetails: { id: string } };

export type CreateClientServiceMutationVariables = Exact<{
  clientId: string | number;
  input: ClientServiceInput;
}>;


export type CreateClientServiceMutation = { createClientService: { id: string } };

export type UpdateClientServiceMutationVariables = Exact<{
  id: string | number;
  input: ClientServiceInput;
}>;


export type UpdateClientServiceMutation = { updateClientService: { id: string } };

export type DeleteClientServiceMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteClientServiceMutation = { deleteClientService: boolean };

export type CreateClientContactMutationVariables = Exact<{
  clientId: string | number;
  input: ClientContactInput;
}>;


export type CreateClientContactMutation = { createClientContact: { id: string } };

export type UpdateClientContactMutationVariables = Exact<{
  id: string | number;
  input: ClientContactInput;
}>;


export type UpdateClientContactMutation = { updateClientContact: { id: string } };

export type DeleteClientContactMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteClientContactMutation = { deleteClientContact: boolean };

export type CatalogItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type CatalogItemsQuery = { catalogItems: Array<{ id: string, kind: AccountingLineKind, title: string, description: string | null, unit: AccountingUnit, unitPrice: number, vatRate: number, archived: boolean }> };

export type CreateCatalogItemMutationVariables = Exact<{
  input: CatalogItemInput;
}>;


export type CreateCatalogItemMutation = { createCatalogItem: string };

export type UpdateCatalogItemMutationVariables = Exact<{
  id: string | number;
  input: CatalogItemInput;
}>;


export type UpdateCatalogItemMutation = { updateCatalogItem: boolean };

export type DeleteCatalogItemMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteCatalogItemMutation = { deleteCatalogItem: boolean };

export type AccountingDocumentListFieldsFragment = { id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null };

export type AccountingDocumentFieldsFragment = { serviceStart: string | null, serviceEnd: string | null, serviceId: string | null, contactId: string | null, sourceId: string | null, seller: unknown, buyer: unknown, introduction: string | null, referenceLabel: string | null, referenceValue: string | null, conclusion: string | null, paymentTerms: string | null, paymentMethods: string | null, lateInterest: string | null, depositType: DiscountType | null, depositValue: number | null, billingSchedule: string | null, otherMentions: string | null, showBankDetails: boolean, vatApplicable: boolean, vatExemptionText: string | null, globalDiscountType: DiscountType | null, globalDiscountValue: number | null, totalVat: number, finalizedAt: string | null, updatedAt: string, sentAt: string | null, acceptedAt: string | null, signedFileUrl: string | null, signedFileName: string | null, paid: number | null, credited: number | null, id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, derived: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, totalGross: number }>, timeEntries: Array<{ id: string, projectId: string, description: string | null, startedAt: string, duration: number | null }>, reminders: Array<{ id: string, date: string, note: string | null }>, payments: Array<{ id: string, amount: number, entry: { id: string, date: string, accountName: string, method: string | null } }>, lines: Array<{ id: string, kind: AccountingLineKind, title: string, description: string | null, quantity: number, unit: AccountingUnit, unitPrice: number, vatRate: number, discountType: DiscountType | null, discountValue: number | null }>, attachments: Array<{ id: string, name: string, size: number, url: string }>, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null };

export type AccountingDocumentsQueryVariables = Exact<{
  clientId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
}>;


export type AccountingDocumentsQuery = { accountingDocuments: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null }> };

export type AccountingDocumentQueryVariables = Exact<{
  id: string | number;
}>;


export type AccountingDocumentQuery = { accountingDocument: { serviceStart: string | null, serviceEnd: string | null, serviceId: string | null, contactId: string | null, sourceId: string | null, seller: unknown, buyer: unknown, introduction: string | null, referenceLabel: string | null, referenceValue: string | null, conclusion: string | null, paymentTerms: string | null, paymentMethods: string | null, lateInterest: string | null, depositType: DiscountType | null, depositValue: number | null, billingSchedule: string | null, otherMentions: string | null, showBankDetails: boolean, vatApplicable: boolean, vatExemptionText: string | null, globalDiscountType: DiscountType | null, globalDiscountValue: number | null, totalVat: number, finalizedAt: string | null, updatedAt: string, sentAt: string | null, acceptedAt: string | null, signedFileUrl: string | null, signedFileName: string | null, paid: number | null, credited: number | null, id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, derived: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, totalGross: number }>, timeEntries: Array<{ id: string, projectId: string, description: string | null, startedAt: string, duration: number | null }>, reminders: Array<{ id: string, date: string, note: string | null }>, payments: Array<{ id: string, amount: number, entry: { id: string, date: string, accountName: string, method: string | null } }>, lines: Array<{ id: string, kind: AccountingLineKind, title: string, description: string | null, quantity: number, unit: AccountingUnit, unitPrice: number, vatRate: number, discountType: DiscountType | null, discountValue: number | null }>, attachments: Array<{ id: string, name: string, size: number, url: string }>, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null } | null };

export type NewDocumentDefaultsQueryVariables = Exact<{
  type: AccountingDocumentType;
  clientId: string | number;
  issueDate: string;
}>;


export type NewDocumentDefaultsQuery = { newDocumentDefaults: unknown };

export type RecurringInvoicesQueryVariables = Exact<{ [key: string]: never; }>;


export type RecurringInvoicesQuery = { recurringInvoices: Array<{ id: string, name: string, templateId: string, recurrence: unknown, startDate: string, nextDate: string | null, autoFinalize: boolean, active: boolean, issuedCount: number, template: { clientName: string, totalGross: number, currency: string } }> };

export type ProjectResourcesQueryVariables = Exact<{
  projectId: string | number;
}>;


export type ProjectResourcesQuery = { projectResources: Array<{ id: string, kind: ProjectResourceKind, title: string, note: string | null, url: string, size: number | null, createdAt: string }> };

export type CreateAccountingDocumentMutationVariables = Exact<{
  type: AccountingDocumentType;
  input: AccountingDocumentInput;
}>;


export type CreateAccountingDocumentMutation = { createAccountingDocument: string };

export type UpdateAccountingDocumentMutationVariables = Exact<{
  id: string | number;
  input: AccountingDocumentInput;
}>;


export type UpdateAccountingDocumentMutation = { updateAccountingDocument: string };

export type DeleteAccountingDocumentMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteAccountingDocumentMutation = { deleteAccountingDocument: boolean };

export type FinalizeAccountingDocumentMutationVariables = Exact<{
  id: string | number;
}>;


export type FinalizeAccountingDocumentMutation = { finalizeAccountingDocument: string };

export type CreateDocumentFromMutationVariables = Exact<{
  sourceId: string | number;
  type: AccountingDocumentType;
  depositPercent?: number | null | undefined;
  issueDate: string;
}>;


export type CreateDocumentFromMutation = { createDocumentFrom: string };

export type DuplicateAccountingDocumentMutationVariables = Exact<{
  id: string | number;
  issueDate: string;
}>;


export type DuplicateAccountingDocumentMutation = { duplicateAccountingDocument: string };

export type AddAccountingAttachmentsMutationVariables = Exact<{
  id: string | number;
  files: Array<File> | File;
}>;


export type AddAccountingAttachmentsMutation = { addAccountingAttachments: boolean };

export type RemoveAccountingAttachmentMutationVariables = Exact<{
  attachmentId: string | number;
}>;


export type RemoveAccountingAttachmentMutation = { removeAccountingAttachment: boolean };

export type CreateRecurringInvoiceMutationVariables = Exact<{
  documentId: string | number;
  input: RecurringInvoiceInput;
}>;


export type CreateRecurringInvoiceMutation = { createRecurringInvoice: string };

export type UpdateRecurringInvoiceMutationVariables = Exact<{
  id: string | number;
  input: RecurringInvoiceInput;
}>;


export type UpdateRecurringInvoiceMutation = { updateRecurringInvoice: boolean };

export type DeleteRecurringInvoiceMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteRecurringInvoiceMutation = { deleteRecurringInvoice: boolean };

export type AddProjectLinkMutationVariables = Exact<{
  projectId: string | number;
  title: string;
  url: string;
  note?: string | null | undefined;
}>;


export type AddProjectLinkMutation = { addProjectLink: boolean };

export type AddProjectFilesMutationVariables = Exact<{
  projectId: string | number;
  files: Array<File> | File;
}>;


export type AddProjectFilesMutation = { addProjectFiles: boolean };

export type UpdateProjectResourceMutationVariables = Exact<{
  id: string | number;
  title: string;
  url?: string | null | undefined;
  note?: string | null | undefined;
}>;


export type UpdateProjectResourceMutation = { updateProjectResource: boolean };

export type DeleteProjectResourceMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectResourceMutation = { deleteProjectResource: boolean };

export type MoveProjectResourceMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveProjectResourceMutation = { moveProjectResource: boolean };

export type ImportedDocumentsQueryVariables = Exact<{
  clientId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
}>;


export type ImportedDocumentsQuery = { importedDocuments: Array<{ id: string, type: AccountingDocumentType, number: string, issueDate: string, dueDate: string | null, clientId: string | null, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalVat: number, totalGross: number, currency: string, note: string | null, fileUrl: string | null, fileName: string | null, settled: boolean, paid: number | null, balance: number | null }> };

export type ImportDocumentMutationVariables = Exact<{
  input: ImportedDocumentInput;
  file?: File | null | undefined;
}>;


export type ImportDocumentMutation = { importDocument: string };

export type UpdateImportedDocumentMutationVariables = Exact<{
  id: string | number;
  input: ImportedDocumentInput;
  file?: File | null | undefined;
}>;


export type UpdateImportedDocumentMutation = { updateImportedDocument: boolean };

export type DeleteImportedDocumentMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteImportedDocumentMutation = { deleteImportedDocument: boolean };

export type DocumentStatusesQueryVariables = Exact<{ [key: string]: never; }>;


export type DocumentStatusesQuery = { documentStatuses: Array<{ id: string, scope: DocumentStatusScope, name: string, color: string, category: DocumentStatusCategory, position: number, documentCount: number }> };

export type OverdueInvoicesQueryVariables = Exact<{
  today: string;
}>;


export type OverdueInvoicesQuery = { overdueInvoices: Array<{ id: string, type: AccountingDocumentType, number: string | null, clientId: string, clientName: string, projectId: string | null, contactId: string | null, serviceId: string | null, issueDate: string, dueDate: string | null, totalGross: number, currency: string, balance: number | null, billingEmail: string | null, reminderCount: number, lastReminderAt: string | null }> };

export type SendDocumentRemindersMutationVariables = Exact<{
  accountId: string | number;
  documentIds: Array<string | number> | string | number;
}>;


export type SendDocumentRemindersMutation = { sendDocumentReminders: Array<{ documentId: string, number: string, error: string | null }> };

export type CreateDocumentStatusMutationVariables = Exact<{
  scope: DocumentStatusScope;
  name: string;
  color: string;
  category: DocumentStatusCategory;
}>;


export type CreateDocumentStatusMutation = { createDocumentStatus: string };

export type UpdateDocumentStatusMutationVariables = Exact<{
  id: string | number;
  name?: string | null | undefined;
  color?: string | null | undefined;
  category?: DocumentStatusCategory | null | undefined;
}>;


export type UpdateDocumentStatusMutation = { updateDocumentStatus: boolean };

export type DeleteDocumentStatusMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteDocumentStatusMutation = { deleteDocumentStatus: boolean };

export type MoveDocumentStatusMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveDocumentStatusMutation = { moveDocumentStatus: boolean };

export type SetDocumentTrackingStatusMutationVariables = Exact<{
  id: string | number;
  statusId: string | number;
}>;


export type SetDocumentTrackingStatusMutation = { setDocumentTrackingStatus: boolean };

export type MarkDocumentSentMutationVariables = Exact<{
  id: string | number;
}>;


export type MarkDocumentSentMutation = { markDocumentSent: boolean };

export type AcceptQuoteMutationVariables = Exact<{
  id: string | number;
  date: string;
  file?: File | null | undefined;
}>;


export type AcceptQuoteMutation = { acceptQuote: boolean };

export type RemoveSignedQuoteMutationVariables = Exact<{
  id: string | number;
}>;


export type RemoveSignedQuoteMutation = { removeSignedQuote: boolean };

export type AddDocumentReminderMutationVariables = Exact<{
  id: string | number;
  note?: string | null | undefined;
}>;


export type AddDocumentReminderMutation = { addDocumentReminder: boolean };

export type DeleteDocumentReminderMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteDocumentReminderMutation = { deleteDocumentReminder: boolean };

export type RecordDocumentPaymentMutationVariables = Exact<{
  id: string | number;
  input: DocumentPaymentInput;
}>;


export type RecordDocumentPaymentMutation = { recordDocumentPayment: boolean };

export type AlarmFieldsFragment = { id: string, title: string, note: string | null, type: AlarmType, startDate: string | null, time: string | null, frequency: AlarmFrequency, interval: number, weekdays: Array<number>, endDate: string | null, minutes: number | null, projectId: string | null, taskId: string | null, enabled: boolean, lastFiredAt: string | null, createdAt: string };

export type AlarmsQueryVariables = Exact<{ [key: string]: never; }>;


export type AlarmsQuery = { alarms: Array<{ id: string, title: string, note: string | null, type: AlarmType, startDate: string | null, time: string | null, frequency: AlarmFrequency, interval: number, weekdays: Array<number>, endDate: string | null, minutes: number | null, projectId: string | null, taskId: string | null, enabled: boolean, lastFiredAt: string | null, createdAt: string }> };

export type CreateAlarmMutationVariables = Exact<{
  input: AlarmInput;
}>;


export type CreateAlarmMutation = { createAlarm: { id: string } };

export type UpdateAlarmMutationVariables = Exact<{
  id: string | number;
  input: AlarmInput;
}>;


export type UpdateAlarmMutation = { updateAlarm: { id: string } };

export type DeleteAlarmMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteAlarmMutation = { deleteAlarm: boolean };

export type MarkAlarmFiredMutationVariables = Exact<{
  id: string | number;
  at: string;
}>;


export type MarkAlarmFiredMutation = { markAlarmFired: boolean };

export type AccountUserFragment = { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null } | null };

export type LoginMutationVariables = Exact<{
  identifier: string;
  password: string;
}>;


export type LoginMutation = { login: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { logout: boolean };

export type RequestPasswordResetMutationVariables = Exact<{
  identifier: string;
}>;


export type RequestPasswordResetMutation = { requestPasswordReset: boolean };

export type ResetPasswordMutationVariables = Exact<{
  token: string;
  password: string;
}>;


export type ResetPasswordMutation = { resetPassword: boolean };

export type ConfirmEmailChangeMutationVariables = Exact<{
  token: string;
}>;


export type ConfirmEmailChangeMutation = { confirmEmailChange: boolean };

export type ChangePasswordMutationVariables = Exact<{
  currentPassword: string;
  password: string;
}>;


export type ChangePasswordMutation = { changePassword: boolean };

export type ChangeUsernameMutationVariables = Exact<{
  currentPassword: string;
  username: string;
}>;


export type ChangeUsernameMutation = { changeUsername: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null } };

export type RequestEmailChangeMutationVariables = Exact<{
  currentPassword: string;
  email: string;
}>;


export type RequestEmailChangeMutation = { requestEmailChange: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null } };

export type CancelEmailChangeMutationVariables = Exact<{ [key: string]: never; }>;


export type CancelEmailChangeMutation = { cancelEmailChange: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null } };

export type CalendarEventOccurrenceFieldsFragment = { key: string, eventId: string, occurrenceDate: string | null, modified: boolean, title: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, timeZone: string, start: string, end: string, recurrence: unknown, seriesStartDate: string, reminders: Array<number>, projectId: string | null, contributorIds: Array<string>, categoryIds: Array<string>, links: Array<{ url: string, label: string }> };

export type CalendarCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type CalendarCategoriesQuery = { calendarCategories: Array<{ id: string, name: string, color: string, parentId: string | null, position: number }> };

export type CalendarEventsQueryVariables = Exact<{
  from: string;
  to: string;
}>;


export type CalendarEventsQuery = { calendarEvents: Array<{ key: string, eventId: string, occurrenceDate: string | null, modified: boolean, title: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, timeZone: string, start: string, end: string, recurrence: unknown, seriesStartDate: string, reminders: Array<number>, projectId: string | null, contributorIds: Array<string>, categoryIds: Array<string>, links: Array<{ url: string, label: string }> }> };

export type CreateCalendarCategoryMutationVariables = Exact<{
  input: CalendarCategoryInput;
}>;


export type CreateCalendarCategoryMutation = { createCalendarCategory: { id: string } };

export type UpdateCalendarCategoryMutationVariables = Exact<{
  id: string | number;
  input: CalendarCategoryInput;
}>;


export type UpdateCalendarCategoryMutation = { updateCalendarCategory: { id: string } };

export type DeleteCalendarCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteCalendarCategoryMutation = { deleteCalendarCategory: boolean };

export type MoveCalendarCategoryMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveCalendarCategoryMutation = { moveCalendarCategory: boolean };

export type CreateCalendarEventMutationVariables = Exact<{
  input: CalendarEventInput;
}>;


export type CreateCalendarEventMutation = { createCalendarEvent: string };

export type UpdateCalendarEventMutationVariables = Exact<{
  id: string | number;
  input: CalendarEventInput;
  scope: CalendarEventScope;
  occurrenceDate?: string | null | undefined;
}>;


export type UpdateCalendarEventMutation = { updateCalendarEvent: string };

export type DeleteCalendarEventMutationVariables = Exact<{
  id: string | number;
  scope: CalendarEventScope;
  occurrenceDate?: string | null | undefined;
}>;


export type DeleteCalendarEventMutation = { deleteCalendarEvent: boolean };

export type MaterializeTaskOccurrencesMutationVariables = Exact<{
  from: string;
  to: string;
}>;


export type MaterializeTaskOccurrencesMutation = { materializeTaskOccurrences: number };

export type DashboardsQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
}>;


export type DashboardsQuery = { dashboards: Array<{ id: string, projectId: string | null, name: string, position: number, charts: Array<{ id: string, dashboardId: string, title: string, config: unknown, wide: boolean, position: number }> }> };

export type CreateDashboardMutationVariables = Exact<{
  name: string;
  projectId?: string | number | null | undefined;
}>;


export type CreateDashboardMutation = { createDashboard: string };

export type RenameDashboardMutationVariables = Exact<{
  id: string | number;
  name: string;
}>;


export type RenameDashboardMutation = { renameDashboard: boolean };

export type DeleteDashboardMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteDashboardMutation = { deleteDashboard: boolean };

export type MoveDashboardMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveDashboardMutation = { moveDashboard: boolean };

export type CreateDashboardChartMutationVariables = Exact<{
  dashboardId: string | number;
  input: DashboardChartInput;
}>;


export type CreateDashboardChartMutation = { createDashboardChart: string };

export type UpdateDashboardChartMutationVariables = Exact<{
  id: string | number;
  input: DashboardChartInput;
}>;


export type UpdateDashboardChartMutation = { updateDashboardChart: boolean };

export type DuplicateDashboardChartMutationVariables = Exact<{
  id: string | number;
}>;


export type DuplicateDashboardChartMutation = { duplicateDashboardChart: string };

export type DeleteDashboardChartMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteDashboardChartMutation = { deleteDashboardChart: boolean };

export type MoveDashboardChartMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveDashboardChartMutation = { moveDashboardChart: boolean };

export type MailAccountFieldsFragment = { id: string, name: string, email: string, displayName: string | null, imapHost: string, imapPort: number, imapSecure: boolean, imapUser: string, smtpHost: string, smtpPort: number, smtpSecure: boolean, smtpUser: string, saveSent: boolean, signature: string | null };

export type MailViewFieldsFragment = { accountId: string, folder: string, uid: number, messageId: string | null, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, linkedProjectIds: Array<string>, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, replyTo: Array<{ name: string | null, address: string }>, attachments: Array<{ index: number, filename: string, contentType: string, size: number, inline: boolean }> };

export type LinkedMailFieldsFragment = { id: string, projectId: string, accountId: string | null, messageId: string, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, sent: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, attachments: Array<{ id: string, name: string, size: number, inline: boolean, url: string }> };

export type MailAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type MailAccountsQuery = { mailAccounts: Array<{ id: string, name: string, email: string, displayName: string | null, imapHost: string, imapPort: number, imapSecure: boolean, imapUser: string, smtpHost: string, smtpPort: number, smtpSecure: boolean, smtpUser: string, saveSent: boolean, signature: string | null }> };

export type MailFoldersQueryVariables = Exact<{
  accountId: string | number;
}>;


export type MailFoldersQuery = { mailFolders: Array<{ path: string, name: string, specialUse: string | null, unseen: number, depth: number }> };

export type MailMessagesQueryVariables = Exact<{
  accountId: string | number;
  folder: string;
  page: number;
  search?: string | null | undefined;
}>;


export type MailMessagesQuery = { mailMessages: { total: number, pageSize: number, messages: Array<{ uid: number, subject: string, date: string, seen: boolean, flagged: boolean, hasAttachments: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }> }> } };

export type MailMessageQueryVariables = Exact<{
  accountId: string | number;
  folder: string;
  uid: number;
}>;


export type MailMessageQuery = { mailMessage: { accountId: string, folder: string, uid: number, messageId: string | null, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, linkedProjectIds: Array<string>, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, replyTo: Array<{ name: string | null, address: string }>, attachments: Array<{ index: number, filename: string, contentType: string, size: number, inline: boolean }> } };

export type UnreadMailCountQueryVariables = Exact<{ [key: string]: never; }>;


export type UnreadMailCountQuery = { unreadMailCount: number };

export type ProjectMailsQueryVariables = Exact<{
  projectId: string | number;
}>;


export type ProjectMailsQuery = { projectMails: Array<{ id: string, projectId: string, accountId: string | null, messageId: string, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, sent: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, attachments: Array<{ id: string, name: string, size: number, inline: boolean, url: string }> }> };

export type TestMailAccountMutationVariables = Exact<{
  input: MailAccountInput;
  id?: string | number | null | undefined;
}>;


export type TestMailAccountMutation = { testMailAccount: boolean };

export type CreateMailAccountMutationVariables = Exact<{
  input: MailAccountInput;
}>;


export type CreateMailAccountMutation = { createMailAccount: { id: string } };

export type UpdateMailAccountMutationVariables = Exact<{
  id: string | number;
  input: MailAccountInput;
}>;


export type UpdateMailAccountMutation = { updateMailAccount: { id: string } };

export type SetMailSignatureMutationVariables = Exact<{
  id: string | number;
  signature: string;
}>;


export type SetMailSignatureMutation = { setMailSignature: { id: string } };

export type DeleteMailAccountMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteMailAccountMutation = { deleteMailAccount: boolean };

export type MoveMailAccountMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveMailAccountMutation = { moveMailAccount: boolean };

export type SetMailSeenMutationVariables = Exact<{
  accountId: string | number;
  folder: string;
  uids: Array<number> | number;
  seen: boolean;
}>;


export type SetMailSeenMutation = { setMailSeen: boolean };

export type DeleteMailsMutationVariables = Exact<{
  accountId: string | number;
  folder: string;
  uids: Array<number> | number;
}>;


export type DeleteMailsMutation = { deleteMails: boolean };

export type LinkMailMutationVariables = Exact<{
  accountId: string | number;
  folder: string;
  uid: number;
  projectId: string | number;
}>;


export type LinkMailMutation = { linkMail: { id: string } };

export type UnlinkMailMutationVariables = Exact<{
  id: string | number;
}>;


export type UnlinkMailMutation = { unlinkMail: boolean };

export type MailDraftQueryVariables = Exact<{
  accountId: string | number;
  folder: string;
  uid: number;
}>;


export type MailDraftQuery = { mailDraft: { accountId: string, folder: string, uid: number, subject: string, html: string | null, text: string | null, inReplyTo: string | null, references: Array<string>, projectId: string | null, to: Array<{ address: string }>, cc: Array<{ address: string }>, bcc: Array<{ address: string }>, attachments: Array<{ index: number, filename: string, size: number, inline: boolean }> } };

export type SaveMailDraftMutationVariables = Exact<{
  input: SaveMailDraftInput;
}>;


export type SaveMailDraftMutation = { saveMailDraft: { accountId: string, folder: string, uid: number, attachments: Array<{ index: number, filename: string, size: number, inline: boolean }> } };

export type DeleteMailDraftMutationVariables = Exact<{
  location: MailLocationInput;
}>;


export type DeleteMailDraftMutation = { deleteMailDraft: boolean };

export type SendMailMutationVariables = Exact<{
  input: SendMailInput;
}>;


export type SendMailMutation = { sendMail: Array<string> };

export type ContributorFieldsFragment = { id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string> };

export type SprintFieldsFragment = { id: string, projectId: string, name: string, goal: string | null, startDate: string, endDate: string };

export type MilestoneFieldsFragment = { id: string, projectId: string, title: string, description: string | null, dueDate: string | null, position: number };

export type TaskLabelFieldsFragment = { id: string, name: string, color: string, position: number };

export type TaskFieldsFragment = { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null };

export type TaskCommentFieldsFragment = { id: string, body: string, createdAt: string };

export type TasksDataQueryVariables = Exact<{ [key: string]: never; }>;


export type TasksDataQuery = { tasks: Array<{ id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null }>, contributors: Array<{ id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string> }>, taskStatuses: Array<{ category: TaskStatusCategory, id: string, name: string, color: string, position: number }>, taskPriorities: Array<{ id: string, name: string, color: string, position: number }>, taskTypes: Array<{ id: string, name: string, color: string, position: number }>, milestones: Array<{ id: string, projectId: string, title: string, description: string | null, dueDate: string | null, position: number }>, sprints: Array<{ id: string, projectId: string, name: string, goal: string | null, startDate: string, endDate: string }> };

export type TaskCommentsQueryVariables = Exact<{
  number: number;
}>;


export type TaskCommentsQuery = { task: { id: string, comments: Array<{ id: string, body: string, createdAt: string }> } | null };

export type CreateTaskMutationVariables = Exact<{
  input: TaskInput;
}>;


export type CreateTaskMutation = { createTask: { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null } };

export type UpdateTaskMutationVariables = Exact<{
  id: string | number;
  input: TaskUpdateInput;
}>;


export type UpdateTaskMutation = { updateTask: { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null } };

export type SetTaskArchivedMutationVariables = Exact<{
  id: string | number;
  archived: boolean;
}>;


export type SetTaskArchivedMutation = { setTaskArchived: { id: string } };

export type DeleteTaskMutationVariables = Exact<{
  id: string | number;
  deleteSubtasks: boolean;
}>;


export type DeleteTaskMutation = { deleteTask: boolean };

export type TransferTaskMutationVariables = Exact<{
  id: string | number;
  projectId: string | number;
}>;


export type TransferTaskMutation = { transferTask: { removedLinks: number } };

export type CloneTaskMutationVariables = Exact<{
  id: string | number;
  includeSubtasks: boolean;
}>;


export type CloneTaskMutation = { cloneTask: { id: string, number: number } };

export type SetTaskRecurrenceMutationVariables = Exact<{
  id: string | number;
  recurrence?: unknown;
}>;


export type SetTaskRecurrenceMutation = { setTaskRecurrence: { id: string } };

export type MoveTaskMutationVariables = Exact<{
  id: string | number;
  beforeId?: string | number | null | undefined;
  parentId?: string | number | null | undefined;
}>;


export type MoveTaskMutation = { moveTask: boolean };

export type AddTaskBlockMutationVariables = Exact<{
  blockerId: string | number;
  blockedId: string | number;
}>;


export type AddTaskBlockMutation = { addTaskBlock: boolean };

export type RemoveTaskBlockMutationVariables = Exact<{
  blockerId: string | number;
  blockedId: string | number;
}>;


export type RemoveTaskBlockMutation = { removeTaskBlock: boolean };

export type AddTaskRelationMutationVariables = Exact<{
  taskId: string | number;
  otherId: string | number;
}>;


export type AddTaskRelationMutation = { addTaskRelation: boolean };

export type RemoveTaskRelationMutationVariables = Exact<{
  taskId: string | number;
  otherId: string | number;
}>;


export type RemoveTaskRelationMutation = { removeTaskRelation: boolean };

export type AddTaskCommentMutationVariables = Exact<{
  taskId: string | number;
  body: string;
}>;


export type AddTaskCommentMutation = { addTaskComment: { id: string, body: string, createdAt: string } };

export type UpdateTaskCommentMutationVariables = Exact<{
  id: string | number;
  body: string;
}>;


export type UpdateTaskCommentMutation = { updateTaskComment: { id: string, body: string, createdAt: string } };

export type DeleteTaskCommentMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTaskCommentMutation = { deleteTaskComment: boolean };

export type CreateContributorMutationVariables = Exact<{
  input: ContributorInput;
}>;


export type CreateContributorMutation = { createContributor: { id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string> } };

export type UpdateContributorMutationVariables = Exact<{
  id: string | number;
  input: ContributorUpdateInput;
}>;


export type UpdateContributorMutation = { updateContributor: { id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string> } };

export type SetProjectContributorsMutationVariables = Exact<{
  projectId: string | number;
  contributorIds: Array<string | number> | string | number;
}>;


export type SetProjectContributorsMutation = { setProjectContributors: boolean };

export type DeleteContributorMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteContributorMutation = { deleteContributor: boolean };

export type CreateTaskStatusMutationVariables = Exact<{
  input: TaskLabelInput;
}>;


export type CreateTaskStatusMutation = { createTaskStatus: { id: string } };

export type UpdateTaskStatusMutationVariables = Exact<{
  id: string | number;
  input: TaskLabelUpdateInput;
}>;


export type UpdateTaskStatusMutation = { updateTaskStatus: { id: string } };

export type DeleteTaskStatusMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTaskStatusMutation = { deleteTaskStatus: boolean };

export type MoveTaskStatusMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveTaskStatusMutation = { moveTaskStatus: boolean };

export type CreateTaskPriorityMutationVariables = Exact<{
  input: TaskLabelInput;
}>;


export type CreateTaskPriorityMutation = { createTaskPriority: { id: string } };

export type UpdateTaskPriorityMutationVariables = Exact<{
  id: string | number;
  input: TaskLabelUpdateInput;
}>;


export type UpdateTaskPriorityMutation = { updateTaskPriority: { id: string } };

export type DeleteTaskPriorityMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTaskPriorityMutation = { deleteTaskPriority: boolean };

export type MoveTaskPriorityMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveTaskPriorityMutation = { moveTaskPriority: boolean };

export type CreateTaskTypeMutationVariables = Exact<{
  input: TaskLabelInput;
}>;


export type CreateTaskTypeMutation = { createTaskType: { id: string } };

export type UpdateTaskTypeMutationVariables = Exact<{
  id: string | number;
  input: TaskLabelUpdateInput;
}>;


export type UpdateTaskTypeMutation = { updateTaskType: { id: string } };

export type DeleteTaskTypeMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTaskTypeMutation = { deleteTaskType: boolean };

export type MoveTaskTypeMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveTaskTypeMutation = { moveTaskType: boolean };

export type SetTasksClosedMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  closed: boolean;
}>;


export type SetTasksClosedMutation = { setTasksClosed: boolean };

export type TaskViewsQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
}>;


export type TaskViewsQuery = { taskViews: Array<{ id: string, name: string, config: unknown, isDefault: boolean, position: number }> };

export type MatchingTaskIdsQueryVariables = Exact<{
  query: TaskQueryInput;
}>;


export type MatchingTaskIdsQuery = { matchingTaskIds: Array<string> };

export type CreateTaskViewMutationVariables = Exact<{
  input: TaskViewInput;
}>;


export type CreateTaskViewMutation = { createTaskView: { id: string } };

export type UpdateTaskViewMutationVariables = Exact<{
  id: string | number;
  input: TaskViewUpdateInput;
}>;


export type UpdateTaskViewMutation = { updateTaskView: { id: string } };

export type DuplicateTaskViewMutationVariables = Exact<{
  id: string | number;
  name: string;
}>;


export type DuplicateTaskViewMutation = { duplicateTaskView: { id: string } };

export type DeleteTaskViewMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTaskViewMutation = { deleteTaskView: boolean };

export type SetDefaultTaskViewMutationVariables = Exact<{
  id: string | number;
}>;


export type SetDefaultTaskViewMutation = { setDefaultTaskView: boolean };

export type MoveTaskViewMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveTaskViewMutation = { moveTaskView: boolean };

export type BulkUpdateTasksMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  changes: BulkTaskInput;
}>;


export type BulkUpdateTasksMutation = { bulkUpdateTasks: boolean };

export type BulkTransferTasksMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  projectId: string | number;
}>;


export type BulkTransferTasksMutation = { bulkTransferTasks: { removedLinks: number } };

export type BulkSetTasksArchivedMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  archived: boolean;
}>;


export type BulkSetTasksArchivedMutation = { bulkSetTasksArchived: boolean };

export type BulkDeleteTasksMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  deleteSubtasks: boolean;
}>;


export type BulkDeleteTasksMutation = { bulkDeleteTasks: boolean };

export type CreateMilestoneMutationVariables = Exact<{
  input: MilestoneInput;
}>;


export type CreateMilestoneMutation = { createMilestone: { id: string } };

export type UpdateMilestoneMutationVariables = Exact<{
  id: string | number;
  input: MilestoneUpdateInput;
}>;


export type UpdateMilestoneMutation = { updateMilestone: { id: string } };

export type DeleteMilestoneMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteMilestoneMutation = { deleteMilestone: boolean };

export type MoveMilestoneMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveMilestoneMutation = { moveMilestone: boolean };

export type CreateSprintMutationVariables = Exact<{
  projectId: string | number;
  input: SprintInput;
}>;


export type CreateSprintMutation = { createSprint: string };

export type UpdateSprintMutationVariables = Exact<{
  id: string | number;
  input: SprintInput;
}>;


export type UpdateSprintMutation = { updateSprint: boolean };

export type DeleteSprintMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteSprintMutation = { deleteSprint: boolean };

export type TimeEntryFieldsFragment = { id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null };

export type TimeEntriesQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
}>;


export type TimeEntriesQuery = { timeEntries: Array<{ id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null }> };

export type RunningTimeEntryQueryVariables = Exact<{ [key: string]: never; }>;


export type RunningTimeEntryQuery = { runningTimeEntry: { id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null } | null };

export type StartTimerMutationVariables = Exact<{
  input: TimerInput;
}>;


export type StartTimerMutation = { startTimer: { id: string } };

export type SetTimerPausedMutationVariables = Exact<{
  paused: boolean;
}>;


export type SetTimerPausedMutation = { setTimerPaused: { id: string } };

export type StopTimerMutationVariables = Exact<{ [key: string]: never; }>;


export type StopTimerMutation = { stopTimer: { id: string } | null };

export type CreateTimeEntryMutationVariables = Exact<{
  input: TimeEntryInput;
}>;


export type CreateTimeEntryMutation = { createTimeEntry: { id: string } };

export type UpdateTimeEntryMutationVariables = Exact<{
  id: string | number;
  input: TimeEntryUpdateInput;
}>;


export type UpdateTimeEntryMutation = { updateTimeEntry: { id: string } };

export type DeleteTimeEntryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTimeEntryMutation = { deleteTimeEntry: boolean };

export type TreasuryEntryFieldsFragment = { id: string, accountId: string, accountName: string, status: TreasuryEntryStatus, date: string, label: string, amount: number, category: string | null, method: string | null, projectId: string | null, note: string | null, recurrence: unknown, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }> };

export type TreasuryAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type TreasuryAccountsQuery = { treasuryAccounts: Array<{ id: string, name: string, openingBalance: number, openingDate: string, archived: boolean, entryCount: number, balance: number }> };

export type TreasuryEntriesQueryVariables = Exact<{
  from: string;
  to: string;
  accountId?: string | number | null | undefined;
}>;


export type TreasuryEntriesQuery = { treasuryEntries: Array<{ id: string, accountId: string, accountName: string, status: TreasuryEntryStatus, date: string, label: string, amount: number, category: string | null, method: string | null, projectId: string | null, note: string | null, recurrence: unknown, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }> }> };

export type ForecastEntriesQueryVariables = Exact<{ [key: string]: never; }>;


export type ForecastEntriesQuery = { forecastEntries: Array<{ id: string, accountId: string, accountName: string, status: TreasuryEntryStatus, date: string, label: string, amount: number, category: string | null, method: string | null, projectId: string | null, note: string | null, recurrence: unknown, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }> }> };

export type TreasuryProjectionQueryVariables = Exact<{
  today: string;
  from: string;
  until: string;
}>;


export type TreasuryProjectionQuery = { treasuryProjection: { balance: number, series: Array<{ date: string, balance: number, forecast: boolean }>, items: Array<{ date: string, dueDate: string, label: string, amount: number, kind: string, overdue: boolean, entryId: string | null, documentId: string | null, importedDocumentId: string | null, recurringInvoiceId: string | null, accountId: string | null }> } };

export type CreateTreasuryAccountMutationVariables = Exact<{
  input: TreasuryAccountInput;
}>;


export type CreateTreasuryAccountMutation = { createTreasuryAccount: string };

export type UpdateTreasuryAccountMutationVariables = Exact<{
  id: string | number;
  input: TreasuryAccountInput;
}>;


export type UpdateTreasuryAccountMutation = { updateTreasuryAccount: boolean };

export type DeleteTreasuryAccountMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryAccountMutation = { deleteTreasuryAccount: boolean };

export type CreateTreasuryEntryMutationVariables = Exact<{
  input: TreasuryEntryInput;
}>;


export type CreateTreasuryEntryMutation = { createTreasuryEntry: string };

export type UpdateTreasuryEntryMutationVariables = Exact<{
  id: string | number;
  input: TreasuryEntryInput;
}>;


export type UpdateTreasuryEntryMutation = { updateTreasuryEntry: boolean };

export type DeleteTreasuryEntryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryEntryMutation = { deleteTreasuryEntry: boolean };

export type RealizeTreasuryForecastMutationVariables = Exact<{
  id: string | number;
  occurrence: string;
  date: string;
  amount: number;
}>;


export type RealizeTreasuryForecastMutation = { realizeTreasuryForecast: string };

export type ClientFieldsFragment = { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean };

export type LabelFieldsFragment = { id: string, name: string, color: string };

export type ProjectStatusFieldsFragment = { id: string, name: string, color: string, position: number };

export type ProjectFieldsFragment = { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> };

export type WorkspaceQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkspaceQuery = { clients: Array<{ id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean }>, projects: Array<{ id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> }>, projectCategories: Array<{ id: string, name: string, color: string }>, projectStatuses: Array<{ id: string, name: string, color: string, position: number }> };

export type CreateClientMutationVariables = Exact<{
  input: ClientInput;
}>;


export type CreateClientMutation = { createClient: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type UpdateClientMutationVariables = Exact<{
  id: string | number;
  input: ClientUpdateInput;
}>;


export type UpdateClientMutation = { updateClient: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type SetClientFavoriteMutationVariables = Exact<{
  id: string | number;
  favorite: boolean;
}>;


export type SetClientFavoriteMutation = { setClientFavorite: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type SetClientArchivedMutationVariables = Exact<{
  id: string | number;
  archived: boolean;
}>;


export type SetClientArchivedMutation = { setClientArchived: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type DeleteClientMutationVariables = Exact<{
  id: string | number;
  deleteProjects: boolean;
}>;


export type DeleteClientMutation = { deleteClient: boolean };

export type MoveClientMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveClientMutation = { moveClient: boolean };

export type CreateProjectMutationVariables = Exact<{
  input: ProjectInput;
}>;


export type CreateProjectMutation = { createProject: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type UpdateProjectMutationVariables = Exact<{
  id: string | number;
  input: ProjectUpdateInput;
}>;


export type UpdateProjectMutation = { updateProject: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type SetProjectFavoriteMutationVariables = Exact<{
  id: string | number;
  favorite: boolean;
}>;


export type SetProjectFavoriteMutation = { setProjectFavorite: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type SetProjectArchivedMutationVariables = Exact<{
  id: string | number;
  archived: boolean;
}>;


export type SetProjectArchivedMutation = { setProjectArchived: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type DeleteProjectMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectMutation = { deleteProject: boolean };

export type MoveProjectMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  clientId?: string | number | null | undefined;
  index: number;
}>;


export type MoveProjectMutation = { moveProject: boolean };

export type CreateProjectCategoryMutationVariables = Exact<{
  input: ProjectCategoryInput;
}>;


export type CreateProjectCategoryMutation = { createProjectCategory: { id: string, name: string, color: string } };

export type UpdateProjectCategoryMutationVariables = Exact<{
  id: string | number;
  input: ProjectCategoryUpdateInput;
}>;


export type UpdateProjectCategoryMutation = { updateProjectCategory: { id: string, name: string, color: string } };

export type DeleteProjectCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectCategoryMutation = { deleteProjectCategory: boolean };

export type CreateProjectStatusMutationVariables = Exact<{
  input: ProjectStatusInput;
}>;


export type CreateProjectStatusMutation = { createProjectStatus: { id: string, name: string, color: string, position: number } };

export type UpdateProjectStatusMutationVariables = Exact<{
  id: string | number;
  input: ProjectStatusUpdateInput;
}>;


export type UpdateProjectStatusMutation = { updateProjectStatus: { id: string, name: string, color: string, position: number } };

export type DeleteProjectStatusMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectStatusMutation = { deleteProjectStatus: boolean };

export type MoveProjectStatusMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveProjectStatusMutation = { moveProjectStatus: boolean };

export type UploadAttachmentMutationVariables = Exact<{
  file: File;
}>;


export type UploadAttachmentMutation = { uploadAttachment: { id: string, name: string, url: string, isImage: boolean } };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const CompanyProfileFieldsFragmentDoc = new TypedDocumentString(`
    fragment CompanyProfileFields on CompanyProfile {
  name
  legalForm
  capital
  registration
  siren
  siret
  activityCode
  vatNumber
  vatApplicable
  vatExemptionText
  address
  email
  phone
  website
  logoUrl
  bankName
  accountHolder
  iban
  bic
  paymentTerms
  paymentDays
  paymentMethods
  lateInterest
  otherMentions
  referenceLabel
  quoteValidityDays
}
    `, {"fragmentName":"CompanyProfileFields"}) as unknown as TypedDocumentString<CompanyProfileFieldsFragment, unknown>;
export const AccountingDocumentListFieldsFragmentDoc = new TypedDocumentString(`
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
    `, {"fragmentName":"AccountingDocumentListFields"}) as unknown as TypedDocumentString<AccountingDocumentListFieldsFragment, unknown>;
export const AccountingDocumentFieldsFragmentDoc = new TypedDocumentString(`
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
  depositType
  depositValue
  billingSchedule
  otherMentions
  timeEntries {
    id
    projectId
    description
    startedAt
    duration
  }
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
}`, {"fragmentName":"AccountingDocumentFields"}) as unknown as TypedDocumentString<AccountingDocumentFieldsFragment, unknown>;
export const AlarmFieldsFragmentDoc = new TypedDocumentString(`
    fragment AlarmFields on Alarm {
  id
  title
  note
  type
  startDate
  time
  frequency
  interval
  weekdays
  endDate
  minutes
  projectId
  taskId
  enabled
  lastFiredAt
  createdAt
}
    `, {"fragmentName":"AlarmFields"}) as unknown as TypedDocumentString<AlarmFieldsFragment, unknown>;
export const AccountUserFragmentDoc = new TypedDocumentString(`
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
  contributorId
}
    `, {"fragmentName":"AccountUser"}) as unknown as TypedDocumentString<AccountUserFragment, unknown>;
export const CalendarEventOccurrenceFieldsFragmentDoc = new TypedDocumentString(`
    fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {
  key
  eventId
  occurrenceDate
  modified
  title
  description
  location
  links {
    url
    label
  }
  allDay
  startDate
  startTime
  endDate
  endTime
  timeZone
  start
  end
  recurrence
  seriesStartDate
  reminders
  projectId
  contributorIds
  categoryIds
}
    `, {"fragmentName":"CalendarEventOccurrenceFields"}) as unknown as TypedDocumentString<CalendarEventOccurrenceFieldsFragment, unknown>;
export const MailAccountFieldsFragmentDoc = new TypedDocumentString(`
    fragment MailAccountFields on MailAccount {
  id
  name
  email
  displayName
  imapHost
  imapPort
  imapSecure
  imapUser
  smtpHost
  smtpPort
  smtpSecure
  smtpUser
  saveSent
  signature
}
    `, {"fragmentName":"MailAccountFields"}) as unknown as TypedDocumentString<MailAccountFieldsFragment, unknown>;
export const MailViewFieldsFragmentDoc = new TypedDocumentString(`
    fragment MailViewFields on MailView {
  accountId
  folder
  uid
  messageId
  inReplyTo
  references
  subject
  from {
    name
    address
  }
  to {
    name
    address
  }
  cc {
    name
    address
  }
  replyTo {
    name
    address
  }
  date
  html
  text
  attachments {
    index
    filename
    contentType
    size
    inline
  }
  linkedProjectIds
}
    `, {"fragmentName":"MailViewFields"}) as unknown as TypedDocumentString<MailViewFieldsFragment, unknown>;
export const LinkedMailFieldsFragmentDoc = new TypedDocumentString(`
    fragment LinkedMailFields on LinkedMail {
  id
  projectId
  accountId
  messageId
  inReplyTo
  references
  subject
  from {
    name
    address
  }
  to {
    name
    address
  }
  cc {
    name
    address
  }
  date
  html
  text
  sent
  attachments {
    id
    name
    size
    inline
    url
  }
}
    `, {"fragmentName":"LinkedMailFields"}) as unknown as TypedDocumentString<LinkedMailFieldsFragment, unknown>;
export const ContributorFieldsFragmentDoc = new TypedDocumentString(`
    fragment ContributorFields on Contributor {
  id
  name
  handle
  avatarUrl
  isMe
  projectIds
}
    `, {"fragmentName":"ContributorFields"}) as unknown as TypedDocumentString<ContributorFieldsFragment, unknown>;
export const SprintFieldsFragmentDoc = new TypedDocumentString(`
    fragment SprintFields on Sprint {
  id
  projectId
  name
  goal
  startDate
  endDate
}
    `, {"fragmentName":"SprintFields"}) as unknown as TypedDocumentString<SprintFieldsFragment, unknown>;
export const MilestoneFieldsFragmentDoc = new TypedDocumentString(`
    fragment MilestoneFields on Milestone {
  id
  projectId
  title
  description
  dueDate
  position
}
    `, {"fragmentName":"MilestoneFields"}) as unknown as TypedDocumentString<MilestoneFieldsFragment, unknown>;
export const TaskLabelFieldsFragmentDoc = new TypedDocumentString(`
    fragment TaskLabelFields on TaskStatus {
  id
  name
  color
  position
}
    `, {"fragmentName":"TaskLabelFields"}) as unknown as TypedDocumentString<TaskLabelFieldsFragment, unknown>;
export const TaskFieldsFragmentDoc = new TypedDocumentString(`
    fragment TaskFields on Task {
  id
  number
  title
  description
  projectId
  statusId
  priorityId
  typeId
  effort
  startDate
  endDate
  parentId
  milestoneId
  sprintId
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  recurrence
  seriesId
  occurrenceDate
  closed
  closedAt
}
    `, {"fragmentName":"TaskFields"}) as unknown as TypedDocumentString<TaskFieldsFragment, unknown>;
export const TaskCommentFieldsFragmentDoc = new TypedDocumentString(`
    fragment TaskCommentFields on TaskComment {
  id
  body
  createdAt
}
    `, {"fragmentName":"TaskCommentFields"}) as unknown as TypedDocumentString<TaskCommentFieldsFragment, unknown>;
export const TimeEntryFieldsFragmentDoc = new TypedDocumentString(`
    fragment TimeEntryFields on TimeEntry {
  id
  projectId
  description
  startedAt
  endedAt
  pausedAt
  pausedSeconds
  duration
  taskIds
  documentId
  documentNumber
}
    `, {"fragmentName":"TimeEntryFields"}) as unknown as TypedDocumentString<TimeEntryFieldsFragment, unknown>;
export const TreasuryEntryFieldsFragmentDoc = new TypedDocumentString(`
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
    `, {"fragmentName":"TreasuryEntryFields"}) as unknown as TypedDocumentString<TreasuryEntryFieldsFragment, unknown>;
export const ClientFieldsFragmentDoc = new TypedDocumentString(`
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}
    `, {"fragmentName":"ClientFields"}) as unknown as TypedDocumentString<ClientFieldsFragment, unknown>;
export const ProjectStatusFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}
    `, {"fragmentName":"ProjectStatusFields"}) as unknown as TypedDocumentString<ProjectStatusFieldsFragment, unknown>;
export const LabelFieldsFragmentDoc = new TypedDocumentString(`
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
    `, {"fragmentName":"LabelFields"}) as unknown as TypedDocumentString<LabelFieldsFragment, unknown>;
export const ProjectFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}`, {"fragmentName":"ProjectFields"}) as unknown as TypedDocumentString<ProjectFieldsFragment, unknown>;
export const CompanyProfileDocument = new TypedDocumentString(`
    query CompanyProfile {
  companyProfile {
    ...CompanyProfileFields
  }
}
    fragment CompanyProfileFields on CompanyProfile {
  name
  legalForm
  capital
  registration
  siren
  siret
  activityCode
  vatNumber
  vatApplicable
  vatExemptionText
  address
  email
  phone
  website
  logoUrl
  bankName
  accountHolder
  iban
  bic
  paymentTerms
  paymentDays
  paymentMethods
  lateInterest
  otherMentions
  referenceLabel
  quoteValidityDays
}`) as unknown as TypedDocumentString<CompanyProfileQuery, CompanyProfileQueryVariables>;
export const DocumentSequencesDocument = new TypedDocumentString(`
    query DocumentSequences($year: Int!) {
  documentSequences(year: $year) {
    type
    year
    nextNumber
    minimum
  }
}
    `) as unknown as TypedDocumentString<DocumentSequencesQuery, DocumentSequencesQueryVariables>;
export const ClientBillingDocument = new TypedDocumentString(`
    query ClientBilling($id: ID!) {
  client(id: $id) {
    id
    name
    kind
    firstName
    lastName
    address
    email
    phones
    website
    vatNumber
    siren
    siret
    activityCode
    services {
      id
      name
      address
      email
      phones
    }
    contacts {
      id
      serviceId
      firstName
      lastName
      email
      jobTitle
      phones
    }
  }
}
    `) as unknown as TypedDocumentString<ClientBillingQuery, ClientBillingQueryVariables>;
export const UpdateCompanyProfileDocument = new TypedDocumentString(`
    mutation UpdateCompanyProfile($input: CompanyProfileInput!) {
  updateCompanyProfile(input: $input) {
    name
  }
}
    `) as unknown as TypedDocumentString<UpdateCompanyProfileMutation, UpdateCompanyProfileMutationVariables>;
export const SetCompanyLogoDocument = new TypedDocumentString(`
    mutation SetCompanyLogo($file: File) {
  setCompanyLogo(file: $file) {
    logoUrl
  }
}
    `) as unknown as TypedDocumentString<SetCompanyLogoMutation, SetCompanyLogoMutationVariables>;
export const SetDocumentSequenceDocument = new TypedDocumentString(`
    mutation SetDocumentSequence($type: AccountingDocumentType!, $year: Int!, $nextNumber: Int!) {
  setDocumentSequence(type: $type, year: $year, nextNumber: $nextNumber)
}
    `) as unknown as TypedDocumentString<SetDocumentSequenceMutation, SetDocumentSequenceMutationVariables>;
export const UpdateClientDetailsDocument = new TypedDocumentString(`
    mutation UpdateClientDetails($id: ID!, $input: ClientDetailsInput!) {
  updateClientDetails(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateClientDetailsMutation, UpdateClientDetailsMutationVariables>;
export const CreateClientServiceDocument = new TypedDocumentString(`
    mutation CreateClientService($clientId: ID!, $input: ClientServiceInput!) {
  createClientService(clientId: $clientId, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateClientServiceMutation, CreateClientServiceMutationVariables>;
export const UpdateClientServiceDocument = new TypedDocumentString(`
    mutation UpdateClientService($id: ID!, $input: ClientServiceInput!) {
  updateClientService(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateClientServiceMutation, UpdateClientServiceMutationVariables>;
export const DeleteClientServiceDocument = new TypedDocumentString(`
    mutation DeleteClientService($id: ID!) {
  deleteClientService(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteClientServiceMutation, DeleteClientServiceMutationVariables>;
export const CreateClientContactDocument = new TypedDocumentString(`
    mutation CreateClientContact($clientId: ID!, $input: ClientContactInput!) {
  createClientContact(clientId: $clientId, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateClientContactMutation, CreateClientContactMutationVariables>;
export const UpdateClientContactDocument = new TypedDocumentString(`
    mutation UpdateClientContact($id: ID!, $input: ClientContactInput!) {
  updateClientContact(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateClientContactMutation, UpdateClientContactMutationVariables>;
export const DeleteClientContactDocument = new TypedDocumentString(`
    mutation DeleteClientContact($id: ID!) {
  deleteClientContact(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteClientContactMutation, DeleteClientContactMutationVariables>;
export const CatalogItemsDocument = new TypedDocumentString(`
    query CatalogItems {
  catalogItems {
    id
    kind
    title
    description
    unit
    unitPrice
    vatRate
    archived
  }
}
    `) as unknown as TypedDocumentString<CatalogItemsQuery, CatalogItemsQueryVariables>;
export const CreateCatalogItemDocument = new TypedDocumentString(`
    mutation CreateCatalogItem($input: CatalogItemInput!) {
  createCatalogItem(input: $input)
}
    `) as unknown as TypedDocumentString<CreateCatalogItemMutation, CreateCatalogItemMutationVariables>;
export const UpdateCatalogItemDocument = new TypedDocumentString(`
    mutation UpdateCatalogItem($id: ID!, $input: CatalogItemInput!) {
  updateCatalogItem(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateCatalogItemMutation, UpdateCatalogItemMutationVariables>;
export const DeleteCatalogItemDocument = new TypedDocumentString(`
    mutation DeleteCatalogItem($id: ID!) {
  deleteCatalogItem(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteCatalogItemMutation, DeleteCatalogItemMutationVariables>;
export const AccountingDocumentsDocument = new TypedDocumentString(`
    query AccountingDocuments($clientId: ID, $projectId: ID) {
  accountingDocuments(clientId: $clientId, projectId: $projectId) {
    ...AccountingDocumentListFields
  }
}
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
}`) as unknown as TypedDocumentString<AccountingDocumentsQuery, AccountingDocumentsQueryVariables>;
export const AccountingDocumentDocument = new TypedDocumentString(`
    query AccountingDocument($id: ID!) {
  accountingDocument(id: $id) {
    ...AccountingDocumentFields
  }
}
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
  depositType
  depositValue
  billingSchedule
  otherMentions
  timeEntries {
    id
    projectId
    description
    startedAt
    duration
  }
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
}`) as unknown as TypedDocumentString<AccountingDocumentQuery, AccountingDocumentQueryVariables>;
export const NewDocumentDefaultsDocument = new TypedDocumentString(`
    query NewDocumentDefaults($type: AccountingDocumentType!, $clientId: ID!, $issueDate: Date!) {
  newDocumentDefaults(type: $type, clientId: $clientId, issueDate: $issueDate)
}
    `) as unknown as TypedDocumentString<NewDocumentDefaultsQuery, NewDocumentDefaultsQueryVariables>;
export const RecurringInvoicesDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<RecurringInvoicesQuery, RecurringInvoicesQueryVariables>;
export const ProjectResourcesDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<ProjectResourcesQuery, ProjectResourcesQueryVariables>;
export const CreateAccountingDocumentDocument = new TypedDocumentString(`
    mutation CreateAccountingDocument($type: AccountingDocumentType!, $input: AccountingDocumentInput!) {
  createAccountingDocument(type: $type, input: $input)
}
    `) as unknown as TypedDocumentString<CreateAccountingDocumentMutation, CreateAccountingDocumentMutationVariables>;
export const UpdateAccountingDocumentDocument = new TypedDocumentString(`
    mutation UpdateAccountingDocument($id: ID!, $input: AccountingDocumentInput!) {
  updateAccountingDocument(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateAccountingDocumentMutation, UpdateAccountingDocumentMutationVariables>;
export const DeleteAccountingDocumentDocument = new TypedDocumentString(`
    mutation DeleteAccountingDocument($id: ID!) {
  deleteAccountingDocument(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteAccountingDocumentMutation, DeleteAccountingDocumentMutationVariables>;
export const FinalizeAccountingDocumentDocument = new TypedDocumentString(`
    mutation FinalizeAccountingDocument($id: ID!) {
  finalizeAccountingDocument(id: $id)
}
    `) as unknown as TypedDocumentString<FinalizeAccountingDocumentMutation, FinalizeAccountingDocumentMutationVariables>;
export const CreateDocumentFromDocument = new TypedDocumentString(`
    mutation CreateDocumentFrom($sourceId: ID!, $type: AccountingDocumentType!, $depositPercent: Float, $issueDate: Date!) {
  createDocumentFrom(
    sourceId: $sourceId
    type: $type
    depositPercent: $depositPercent
    issueDate: $issueDate
  )
}
    `) as unknown as TypedDocumentString<CreateDocumentFromMutation, CreateDocumentFromMutationVariables>;
export const DuplicateAccountingDocumentDocument = new TypedDocumentString(`
    mutation DuplicateAccountingDocument($id: ID!, $issueDate: Date!) {
  duplicateAccountingDocument(id: $id, issueDate: $issueDate)
}
    `) as unknown as TypedDocumentString<DuplicateAccountingDocumentMutation, DuplicateAccountingDocumentMutationVariables>;
export const AddAccountingAttachmentsDocument = new TypedDocumentString(`
    mutation AddAccountingAttachments($id: ID!, $files: [File!]!) {
  addAccountingAttachments(id: $id, files: $files)
}
    `) as unknown as TypedDocumentString<AddAccountingAttachmentsMutation, AddAccountingAttachmentsMutationVariables>;
export const RemoveAccountingAttachmentDocument = new TypedDocumentString(`
    mutation RemoveAccountingAttachment($attachmentId: ID!) {
  removeAccountingAttachment(attachmentId: $attachmentId)
}
    `) as unknown as TypedDocumentString<RemoveAccountingAttachmentMutation, RemoveAccountingAttachmentMutationVariables>;
export const CreateRecurringInvoiceDocument = new TypedDocumentString(`
    mutation CreateRecurringInvoice($documentId: ID!, $input: RecurringInvoiceInput!) {
  createRecurringInvoice(documentId: $documentId, input: $input)
}
    `) as unknown as TypedDocumentString<CreateRecurringInvoiceMutation, CreateRecurringInvoiceMutationVariables>;
export const UpdateRecurringInvoiceDocument = new TypedDocumentString(`
    mutation UpdateRecurringInvoice($id: ID!, $input: RecurringInvoiceInput!) {
  updateRecurringInvoice(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateRecurringInvoiceMutation, UpdateRecurringInvoiceMutationVariables>;
export const DeleteRecurringInvoiceDocument = new TypedDocumentString(`
    mutation DeleteRecurringInvoice($id: ID!) {
  deleteRecurringInvoice(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteRecurringInvoiceMutation, DeleteRecurringInvoiceMutationVariables>;
export const AddProjectLinkDocument = new TypedDocumentString(`
    mutation AddProjectLink($projectId: ID!, $title: String!, $url: String!, $note: String) {
  addProjectLink(projectId: $projectId, title: $title, url: $url, note: $note)
}
    `) as unknown as TypedDocumentString<AddProjectLinkMutation, AddProjectLinkMutationVariables>;
export const AddProjectFilesDocument = new TypedDocumentString(`
    mutation AddProjectFiles($projectId: ID!, $files: [File!]!) {
  addProjectFiles(projectId: $projectId, files: $files)
}
    `) as unknown as TypedDocumentString<AddProjectFilesMutation, AddProjectFilesMutationVariables>;
export const UpdateProjectResourceDocument = new TypedDocumentString(`
    mutation UpdateProjectResource($id: ID!, $title: String!, $url: String, $note: String) {
  updateProjectResource(id: $id, title: $title, url: $url, note: $note)
}
    `) as unknown as TypedDocumentString<UpdateProjectResourceMutation, UpdateProjectResourceMutationVariables>;
export const DeleteProjectResourceDocument = new TypedDocumentString(`
    mutation DeleteProjectResource($id: ID!) {
  deleteProjectResource(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectResourceMutation, DeleteProjectResourceMutationVariables>;
export const MoveProjectResourceDocument = new TypedDocumentString(`
    mutation MoveProjectResource($id: ID!, $index: Int!) {
  moveProjectResource(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveProjectResourceMutation, MoveProjectResourceMutationVariables>;
export const ImportedDocumentsDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<ImportedDocumentsQuery, ImportedDocumentsQueryVariables>;
export const ImportDocumentDocument = new TypedDocumentString(`
    mutation ImportDocument($input: ImportedDocumentInput!, $file: File) {
  importDocument(input: $input, file: $file)
}
    `) as unknown as TypedDocumentString<ImportDocumentMutation, ImportDocumentMutationVariables>;
export const UpdateImportedDocumentDocument = new TypedDocumentString(`
    mutation UpdateImportedDocument($id: ID!, $input: ImportedDocumentInput!, $file: File) {
  updateImportedDocument(id: $id, input: $input, file: $file)
}
    `) as unknown as TypedDocumentString<UpdateImportedDocumentMutation, UpdateImportedDocumentMutationVariables>;
export const DeleteImportedDocumentDocument = new TypedDocumentString(`
    mutation DeleteImportedDocument($id: ID!) {
  deleteImportedDocument(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteImportedDocumentMutation, DeleteImportedDocumentMutationVariables>;
export const DocumentStatusesDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<DocumentStatusesQuery, DocumentStatusesQueryVariables>;
export const OverdueInvoicesDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<OverdueInvoicesQuery, OverdueInvoicesQueryVariables>;
export const SendDocumentRemindersDocument = new TypedDocumentString(`
    mutation SendDocumentReminders($accountId: ID!, $documentIds: [ID!]!) {
  sendDocumentReminders(accountId: $accountId, documentIds: $documentIds) {
    documentId
    number
    error
  }
}
    `) as unknown as TypedDocumentString<SendDocumentRemindersMutation, SendDocumentRemindersMutationVariables>;
export const CreateDocumentStatusDocument = new TypedDocumentString(`
    mutation CreateDocumentStatus($scope: DocumentStatusScope!, $name: String!, $color: String!, $category: DocumentStatusCategory!) {
  createDocumentStatus(
    scope: $scope
    name: $name
    color: $color
    category: $category
  )
}
    `) as unknown as TypedDocumentString<CreateDocumentStatusMutation, CreateDocumentStatusMutationVariables>;
export const UpdateDocumentStatusDocument = new TypedDocumentString(`
    mutation UpdateDocumentStatus($id: ID!, $name: String, $color: String, $category: DocumentStatusCategory) {
  updateDocumentStatus(id: $id, name: $name, color: $color, category: $category)
}
    `) as unknown as TypedDocumentString<UpdateDocumentStatusMutation, UpdateDocumentStatusMutationVariables>;
export const DeleteDocumentStatusDocument = new TypedDocumentString(`
    mutation DeleteDocumentStatus($id: ID!) {
  deleteDocumentStatus(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteDocumentStatusMutation, DeleteDocumentStatusMutationVariables>;
export const MoveDocumentStatusDocument = new TypedDocumentString(`
    mutation MoveDocumentStatus($id: ID!, $index: Int!) {
  moveDocumentStatus(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveDocumentStatusMutation, MoveDocumentStatusMutationVariables>;
export const SetDocumentTrackingStatusDocument = new TypedDocumentString(`
    mutation SetDocumentTrackingStatus($id: ID!, $statusId: ID!) {
  setDocumentTrackingStatus(id: $id, statusId: $statusId)
}
    `) as unknown as TypedDocumentString<SetDocumentTrackingStatusMutation, SetDocumentTrackingStatusMutationVariables>;
export const MarkDocumentSentDocument = new TypedDocumentString(`
    mutation MarkDocumentSent($id: ID!) {
  markDocumentSent(id: $id)
}
    `) as unknown as TypedDocumentString<MarkDocumentSentMutation, MarkDocumentSentMutationVariables>;
export const AcceptQuoteDocument = new TypedDocumentString(`
    mutation AcceptQuote($id: ID!, $date: Date!, $file: File) {
  acceptQuote(id: $id, date: $date, file: $file)
}
    `) as unknown as TypedDocumentString<AcceptQuoteMutation, AcceptQuoteMutationVariables>;
export const RemoveSignedQuoteDocument = new TypedDocumentString(`
    mutation RemoveSignedQuote($id: ID!) {
  removeSignedQuote(id: $id)
}
    `) as unknown as TypedDocumentString<RemoveSignedQuoteMutation, RemoveSignedQuoteMutationVariables>;
export const AddDocumentReminderDocument = new TypedDocumentString(`
    mutation AddDocumentReminder($id: ID!, $note: String) {
  addDocumentReminder(id: $id, note: $note)
}
    `) as unknown as TypedDocumentString<AddDocumentReminderMutation, AddDocumentReminderMutationVariables>;
export const DeleteDocumentReminderDocument = new TypedDocumentString(`
    mutation DeleteDocumentReminder($id: ID!) {
  deleteDocumentReminder(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteDocumentReminderMutation, DeleteDocumentReminderMutationVariables>;
export const RecordDocumentPaymentDocument = new TypedDocumentString(`
    mutation RecordDocumentPayment($id: ID!, $input: DocumentPaymentInput!) {
  recordDocumentPayment(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<RecordDocumentPaymentMutation, RecordDocumentPaymentMutationVariables>;
export const AlarmsDocument = new TypedDocumentString(`
    query Alarms {
  alarms {
    ...AlarmFields
  }
}
    fragment AlarmFields on Alarm {
  id
  title
  note
  type
  startDate
  time
  frequency
  interval
  weekdays
  endDate
  minutes
  projectId
  taskId
  enabled
  lastFiredAt
  createdAt
}`) as unknown as TypedDocumentString<AlarmsQuery, AlarmsQueryVariables>;
export const CreateAlarmDocument = new TypedDocumentString(`
    mutation CreateAlarm($input: AlarmInput!) {
  createAlarm(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateAlarmMutation, CreateAlarmMutationVariables>;
export const UpdateAlarmDocument = new TypedDocumentString(`
    mutation UpdateAlarm($id: ID!, $input: AlarmInput!) {
  updateAlarm(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateAlarmMutation, UpdateAlarmMutationVariables>;
export const DeleteAlarmDocument = new TypedDocumentString(`
    mutation DeleteAlarm($id: ID!) {
  deleteAlarm(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteAlarmMutation, DeleteAlarmMutationVariables>;
export const MarkAlarmFiredDocument = new TypedDocumentString(`
    mutation MarkAlarmFired($id: ID!, $at: DateTime!) {
  markAlarmFired(id: $id, at: $at)
}
    `) as unknown as TypedDocumentString<MarkAlarmFiredMutation, MarkAlarmFiredMutationVariables>;
export const MeDocument = new TypedDocumentString(`
    query Me {
  me {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
  contributorId
}`) as unknown as TypedDocumentString<MeQuery, MeQueryVariables>;
export const LoginDocument = new TypedDocumentString(`
    mutation Login($identifier: String!, $password: String!) {
  login(identifier: $identifier, password: $password) {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
  contributorId
}`) as unknown as TypedDocumentString<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = new TypedDocumentString(`
    mutation Logout {
  logout
}
    `) as unknown as TypedDocumentString<LogoutMutation, LogoutMutationVariables>;
export const RequestPasswordResetDocument = new TypedDocumentString(`
    mutation RequestPasswordReset($identifier: String!) {
  requestPasswordReset(identifier: $identifier)
}
    `) as unknown as TypedDocumentString<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;
export const ResetPasswordDocument = new TypedDocumentString(`
    mutation ResetPassword($token: String!, $password: String!) {
  resetPassword(token: $token, password: $password)
}
    `) as unknown as TypedDocumentString<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const ConfirmEmailChangeDocument = new TypedDocumentString(`
    mutation ConfirmEmailChange($token: String!) {
  confirmEmailChange(token: $token)
}
    `) as unknown as TypedDocumentString<ConfirmEmailChangeMutation, ConfirmEmailChangeMutationVariables>;
export const ChangePasswordDocument = new TypedDocumentString(`
    mutation ChangePassword($currentPassword: String!, $password: String!) {
  changePassword(currentPassword: $currentPassword, password: $password)
}
    `) as unknown as TypedDocumentString<ChangePasswordMutation, ChangePasswordMutationVariables>;
export const ChangeUsernameDocument = new TypedDocumentString(`
    mutation ChangeUsername($currentPassword: String!, $username: String!) {
  changeUsername(currentPassword: $currentPassword, username: $username) {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
  contributorId
}`) as unknown as TypedDocumentString<ChangeUsernameMutation, ChangeUsernameMutationVariables>;
export const RequestEmailChangeDocument = new TypedDocumentString(`
    mutation RequestEmailChange($currentPassword: String!, $email: String!) {
  requestEmailChange(currentPassword: $currentPassword, email: $email) {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
  contributorId
}`) as unknown as TypedDocumentString<RequestEmailChangeMutation, RequestEmailChangeMutationVariables>;
export const CancelEmailChangeDocument = new TypedDocumentString(`
    mutation CancelEmailChange {
  cancelEmailChange {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
  contributorId
}`) as unknown as TypedDocumentString<CancelEmailChangeMutation, CancelEmailChangeMutationVariables>;
export const CalendarCategoriesDocument = new TypedDocumentString(`
    query CalendarCategories {
  calendarCategories {
    id
    name
    color
    parentId
    position
  }
}
    `) as unknown as TypedDocumentString<CalendarCategoriesQuery, CalendarCategoriesQueryVariables>;
export const CalendarEventsDocument = new TypedDocumentString(`
    query CalendarEvents($from: Date!, $to: Date!) {
  calendarEvents(from: $from, to: $to) {
    ...CalendarEventOccurrenceFields
  }
}
    fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {
  key
  eventId
  occurrenceDate
  modified
  title
  description
  location
  links {
    url
    label
  }
  allDay
  startDate
  startTime
  endDate
  endTime
  timeZone
  start
  end
  recurrence
  seriesStartDate
  reminders
  projectId
  contributorIds
  categoryIds
}`) as unknown as TypedDocumentString<CalendarEventsQuery, CalendarEventsQueryVariables>;
export const CreateCalendarCategoryDocument = new TypedDocumentString(`
    mutation CreateCalendarCategory($input: CalendarCategoryInput!) {
  createCalendarCategory(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateCalendarCategoryMutation, CreateCalendarCategoryMutationVariables>;
export const UpdateCalendarCategoryDocument = new TypedDocumentString(`
    mutation UpdateCalendarCategory($id: ID!, $input: CalendarCategoryInput!) {
  updateCalendarCategory(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateCalendarCategoryMutation, UpdateCalendarCategoryMutationVariables>;
export const DeleteCalendarCategoryDocument = new TypedDocumentString(`
    mutation DeleteCalendarCategory($id: ID!) {
  deleteCalendarCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteCalendarCategoryMutation, DeleteCalendarCategoryMutationVariables>;
export const MoveCalendarCategoryDocument = new TypedDocumentString(`
    mutation MoveCalendarCategory($id: ID!, $index: Int!) {
  moveCalendarCategory(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveCalendarCategoryMutation, MoveCalendarCategoryMutationVariables>;
export const CreateCalendarEventDocument = new TypedDocumentString(`
    mutation CreateCalendarEvent($input: CalendarEventInput!) {
  createCalendarEvent(input: $input)
}
    `) as unknown as TypedDocumentString<CreateCalendarEventMutation, CreateCalendarEventMutationVariables>;
export const UpdateCalendarEventDocument = new TypedDocumentString(`
    mutation UpdateCalendarEvent($id: ID!, $input: CalendarEventInput!, $scope: CalendarEventScope!, $occurrenceDate: Date) {
  updateCalendarEvent(
    id: $id
    input: $input
    scope: $scope
    occurrenceDate: $occurrenceDate
  )
}
    `) as unknown as TypedDocumentString<UpdateCalendarEventMutation, UpdateCalendarEventMutationVariables>;
export const DeleteCalendarEventDocument = new TypedDocumentString(`
    mutation DeleteCalendarEvent($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date) {
  deleteCalendarEvent(id: $id, scope: $scope, occurrenceDate: $occurrenceDate)
}
    `) as unknown as TypedDocumentString<DeleteCalendarEventMutation, DeleteCalendarEventMutationVariables>;
export const MaterializeTaskOccurrencesDocument = new TypedDocumentString(`
    mutation MaterializeTaskOccurrences($from: Date!, $to: Date!) {
  materializeTaskOccurrences(from: $from, to: $to)
}
    `) as unknown as TypedDocumentString<MaterializeTaskOccurrencesMutation, MaterializeTaskOccurrencesMutationVariables>;
export const DashboardsDocument = new TypedDocumentString(`
    query Dashboards($projectId: ID) {
  dashboards(projectId: $projectId) {
    id
    projectId
    name
    position
    charts {
      id
      dashboardId
      title
      config
      wide
      position
    }
  }
}
    `) as unknown as TypedDocumentString<DashboardsQuery, DashboardsQueryVariables>;
export const CreateDashboardDocument = new TypedDocumentString(`
    mutation CreateDashboard($name: String!, $projectId: ID) {
  createDashboard(name: $name, projectId: $projectId)
}
    `) as unknown as TypedDocumentString<CreateDashboardMutation, CreateDashboardMutationVariables>;
export const RenameDashboardDocument = new TypedDocumentString(`
    mutation RenameDashboard($id: ID!, $name: String!) {
  renameDashboard(id: $id, name: $name)
}
    `) as unknown as TypedDocumentString<RenameDashboardMutation, RenameDashboardMutationVariables>;
export const DeleteDashboardDocument = new TypedDocumentString(`
    mutation DeleteDashboard($id: ID!) {
  deleteDashboard(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteDashboardMutation, DeleteDashboardMutationVariables>;
export const MoveDashboardDocument = new TypedDocumentString(`
    mutation MoveDashboard($id: ID!, $index: Int!) {
  moveDashboard(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveDashboardMutation, MoveDashboardMutationVariables>;
export const CreateDashboardChartDocument = new TypedDocumentString(`
    mutation CreateDashboardChart($dashboardId: ID!, $input: DashboardChartInput!) {
  createDashboardChart(dashboardId: $dashboardId, input: $input)
}
    `) as unknown as TypedDocumentString<CreateDashboardChartMutation, CreateDashboardChartMutationVariables>;
export const UpdateDashboardChartDocument = new TypedDocumentString(`
    mutation UpdateDashboardChart($id: ID!, $input: DashboardChartInput!) {
  updateDashboardChart(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateDashboardChartMutation, UpdateDashboardChartMutationVariables>;
export const DuplicateDashboardChartDocument = new TypedDocumentString(`
    mutation DuplicateDashboardChart($id: ID!) {
  duplicateDashboardChart(id: $id)
}
    `) as unknown as TypedDocumentString<DuplicateDashboardChartMutation, DuplicateDashboardChartMutationVariables>;
export const DeleteDashboardChartDocument = new TypedDocumentString(`
    mutation DeleteDashboardChart($id: ID!) {
  deleteDashboardChart(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteDashboardChartMutation, DeleteDashboardChartMutationVariables>;
export const MoveDashboardChartDocument = new TypedDocumentString(`
    mutation MoveDashboardChart($id: ID!, $index: Int!) {
  moveDashboardChart(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveDashboardChartMutation, MoveDashboardChartMutationVariables>;
export const MailAccountsDocument = new TypedDocumentString(`
    query MailAccounts {
  mailAccounts {
    ...MailAccountFields
  }
}
    fragment MailAccountFields on MailAccount {
  id
  name
  email
  displayName
  imapHost
  imapPort
  imapSecure
  imapUser
  smtpHost
  smtpPort
  smtpSecure
  smtpUser
  saveSent
  signature
}`) as unknown as TypedDocumentString<MailAccountsQuery, MailAccountsQueryVariables>;
export const MailFoldersDocument = new TypedDocumentString(`
    query MailFolders($accountId: ID!) {
  mailFolders(accountId: $accountId) {
    path
    name
    specialUse
    unseen
    depth
  }
}
    `) as unknown as TypedDocumentString<MailFoldersQuery, MailFoldersQueryVariables>;
export const MailMessagesDocument = new TypedDocumentString(`
    query MailMessages($accountId: ID!, $folder: String!, $page: Int!, $search: String) {
  mailMessages(
    accountId: $accountId
    folder: $folder
    page: $page
    search: $search
  ) {
    total
    pageSize
    messages {
      uid
      subject
      from {
        name
        address
      }
      to {
        name
        address
      }
      date
      seen
      flagged
      hasAttachments
    }
  }
}
    `) as unknown as TypedDocumentString<MailMessagesQuery, MailMessagesQueryVariables>;
export const MailMessageDocument = new TypedDocumentString(`
    query MailMessage($accountId: ID!, $folder: String!, $uid: Int!) {
  mailMessage(accountId: $accountId, folder: $folder, uid: $uid) {
    ...MailViewFields
  }
}
    fragment MailViewFields on MailView {
  accountId
  folder
  uid
  messageId
  inReplyTo
  references
  subject
  from {
    name
    address
  }
  to {
    name
    address
  }
  cc {
    name
    address
  }
  replyTo {
    name
    address
  }
  date
  html
  text
  attachments {
    index
    filename
    contentType
    size
    inline
  }
  linkedProjectIds
}`) as unknown as TypedDocumentString<MailMessageQuery, MailMessageQueryVariables>;
export const UnreadMailCountDocument = new TypedDocumentString(`
    query UnreadMailCount {
  unreadMailCount
}
    `) as unknown as TypedDocumentString<UnreadMailCountQuery, UnreadMailCountQueryVariables>;
export const ProjectMailsDocument = new TypedDocumentString(`
    query ProjectMails($projectId: ID!) {
  projectMails(projectId: $projectId) {
    ...LinkedMailFields
  }
}
    fragment LinkedMailFields on LinkedMail {
  id
  projectId
  accountId
  messageId
  inReplyTo
  references
  subject
  from {
    name
    address
  }
  to {
    name
    address
  }
  cc {
    name
    address
  }
  date
  html
  text
  sent
  attachments {
    id
    name
    size
    inline
    url
  }
}`) as unknown as TypedDocumentString<ProjectMailsQuery, ProjectMailsQueryVariables>;
export const TestMailAccountDocument = new TypedDocumentString(`
    mutation TestMailAccount($input: MailAccountInput!, $id: ID) {
  testMailAccount(input: $input, id: $id)
}
    `) as unknown as TypedDocumentString<TestMailAccountMutation, TestMailAccountMutationVariables>;
export const CreateMailAccountDocument = new TypedDocumentString(`
    mutation CreateMailAccount($input: MailAccountInput!) {
  createMailAccount(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateMailAccountMutation, CreateMailAccountMutationVariables>;
export const UpdateMailAccountDocument = new TypedDocumentString(`
    mutation UpdateMailAccount($id: ID!, $input: MailAccountInput!) {
  updateMailAccount(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateMailAccountMutation, UpdateMailAccountMutationVariables>;
export const SetMailSignatureDocument = new TypedDocumentString(`
    mutation SetMailSignature($id: ID!, $signature: String!) {
  setMailSignature(id: $id, signature: $signature) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetMailSignatureMutation, SetMailSignatureMutationVariables>;
export const DeleteMailAccountDocument = new TypedDocumentString(`
    mutation DeleteMailAccount($id: ID!) {
  deleteMailAccount(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteMailAccountMutation, DeleteMailAccountMutationVariables>;
export const MoveMailAccountDocument = new TypedDocumentString(`
    mutation MoveMailAccount($id: ID!, $index: Int!) {
  moveMailAccount(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveMailAccountMutation, MoveMailAccountMutationVariables>;
export const SetMailSeenDocument = new TypedDocumentString(`
    mutation SetMailSeen($accountId: ID!, $folder: String!, $uids: [Int!]!, $seen: Boolean!) {
  setMailSeen(accountId: $accountId, folder: $folder, uids: $uids, seen: $seen)
}
    `) as unknown as TypedDocumentString<SetMailSeenMutation, SetMailSeenMutationVariables>;
export const DeleteMailsDocument = new TypedDocumentString(`
    mutation DeleteMails($accountId: ID!, $folder: String!, $uids: [Int!]!) {
  deleteMails(accountId: $accountId, folder: $folder, uids: $uids)
}
    `) as unknown as TypedDocumentString<DeleteMailsMutation, DeleteMailsMutationVariables>;
export const LinkMailDocument = new TypedDocumentString(`
    mutation LinkMail($accountId: ID!, $folder: String!, $uid: Int!, $projectId: ID!) {
  linkMail(
    accountId: $accountId
    folder: $folder
    uid: $uid
    projectId: $projectId
  ) {
    id
  }
}
    `) as unknown as TypedDocumentString<LinkMailMutation, LinkMailMutationVariables>;
export const UnlinkMailDocument = new TypedDocumentString(`
    mutation UnlinkMail($id: ID!) {
  unlinkMail(id: $id)
}
    `) as unknown as TypedDocumentString<UnlinkMailMutation, UnlinkMailMutationVariables>;
export const MailDraftDocument = new TypedDocumentString(`
    query MailDraft($accountId: ID!, $folder: String!, $uid: Int!) {
  mailDraft(accountId: $accountId, folder: $folder, uid: $uid) {
    accountId
    folder
    uid
    to {
      address
    }
    cc {
      address
    }
    bcc {
      address
    }
    subject
    html
    text
    inReplyTo
    references
    projectId
    attachments {
      index
      filename
      size
      inline
    }
  }
}
    `) as unknown as TypedDocumentString<MailDraftQuery, MailDraftQueryVariables>;
export const SaveMailDraftDocument = new TypedDocumentString(`
    mutation SaveMailDraft($input: SaveMailDraftInput!) {
  saveMailDraft(input: $input) {
    accountId
    folder
    uid
    attachments {
      index
      filename
      size
      inline
    }
  }
}
    `) as unknown as TypedDocumentString<SaveMailDraftMutation, SaveMailDraftMutationVariables>;
export const DeleteMailDraftDocument = new TypedDocumentString(`
    mutation DeleteMailDraft($location: MailLocationInput!) {
  deleteMailDraft(location: $location)
}
    `) as unknown as TypedDocumentString<DeleteMailDraftMutation, DeleteMailDraftMutationVariables>;
export const SendMailDocument = new TypedDocumentString(`
    mutation SendMail($input: SendMailInput!) {
  sendMail(input: $input)
}
    `) as unknown as TypedDocumentString<SendMailMutation, SendMailMutationVariables>;
export const TasksDataDocument = new TypedDocumentString(`
    query TasksData {
  tasks {
    ...TaskFields
  }
  contributors {
    ...ContributorFields
  }
  taskStatuses {
    ...TaskLabelFields
    category
  }
  taskPriorities {
    id
    name
    color
    position
  }
  taskTypes {
    id
    name
    color
    position
  }
  milestones {
    ...MilestoneFields
  }
  sprints {
    ...SprintFields
  }
}
    fragment ContributorFields on Contributor {
  id
  name
  handle
  avatarUrl
  isMe
  projectIds
}
fragment SprintFields on Sprint {
  id
  projectId
  name
  goal
  startDate
  endDate
}
fragment MilestoneFields on Milestone {
  id
  projectId
  title
  description
  dueDate
  position
}
fragment TaskLabelFields on TaskStatus {
  id
  name
  color
  position
}
fragment TaskFields on Task {
  id
  number
  title
  description
  projectId
  statusId
  priorityId
  typeId
  effort
  startDate
  endDate
  parentId
  milestoneId
  sprintId
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  recurrence
  seriesId
  occurrenceDate
  closed
  closedAt
}`) as unknown as TypedDocumentString<TasksDataQuery, TasksDataQueryVariables>;
export const TaskCommentsDocument = new TypedDocumentString(`
    query TaskComments($number: Int!) {
  task(number: $number) {
    id
    comments {
      ...TaskCommentFields
    }
  }
}
    fragment TaskCommentFields on TaskComment {
  id
  body
  createdAt
}`) as unknown as TypedDocumentString<TaskCommentsQuery, TaskCommentsQueryVariables>;
export const CreateTaskDocument = new TypedDocumentString(`
    mutation CreateTask($input: TaskInput!) {
  createTask(input: $input) {
    ...TaskFields
  }
}
    fragment TaskFields on Task {
  id
  number
  title
  description
  projectId
  statusId
  priorityId
  typeId
  effort
  startDate
  endDate
  parentId
  milestoneId
  sprintId
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  recurrence
  seriesId
  occurrenceDate
  closed
  closedAt
}`) as unknown as TypedDocumentString<CreateTaskMutation, CreateTaskMutationVariables>;
export const UpdateTaskDocument = new TypedDocumentString(`
    mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {
  updateTask(id: $id, input: $input) {
    ...TaskFields
  }
}
    fragment TaskFields on Task {
  id
  number
  title
  description
  projectId
  statusId
  priorityId
  typeId
  effort
  startDate
  endDate
  parentId
  milestoneId
  sprintId
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  recurrence
  seriesId
  occurrenceDate
  closed
  closedAt
}`) as unknown as TypedDocumentString<UpdateTaskMutation, UpdateTaskMutationVariables>;
export const SetTaskArchivedDocument = new TypedDocumentString(`
    mutation SetTaskArchived($id: ID!, $archived: Boolean!) {
  setTaskArchived(id: $id, archived: $archived) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetTaskArchivedMutation, SetTaskArchivedMutationVariables>;
export const DeleteTaskDocument = new TypedDocumentString(`
    mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {
  deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)
}
    `) as unknown as TypedDocumentString<DeleteTaskMutation, DeleteTaskMutationVariables>;
export const TransferTaskDocument = new TypedDocumentString(`
    mutation TransferTask($id: ID!, $projectId: ID!) {
  transferTask(id: $id, projectId: $projectId) {
    removedLinks
  }
}
    `) as unknown as TypedDocumentString<TransferTaskMutation, TransferTaskMutationVariables>;
export const CloneTaskDocument = new TypedDocumentString(`
    mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {
  cloneTask(id: $id, includeSubtasks: $includeSubtasks) {
    id
    number
  }
}
    `) as unknown as TypedDocumentString<CloneTaskMutation, CloneTaskMutationVariables>;
export const SetTaskRecurrenceDocument = new TypedDocumentString(`
    mutation SetTaskRecurrence($id: ID!, $recurrence: JSON) {
  setTaskRecurrence(id: $id, recurrence: $recurrence) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetTaskRecurrenceMutation, SetTaskRecurrenceMutationVariables>;
export const MoveTaskDocument = new TypedDocumentString(`
    mutation MoveTask($id: ID!, $beforeId: ID, $parentId: ID) {
  moveTask(id: $id, beforeId: $beforeId, parentId: $parentId)
}
    `) as unknown as TypedDocumentString<MoveTaskMutation, MoveTaskMutationVariables>;
export const AddTaskBlockDocument = new TypedDocumentString(`
    mutation AddTaskBlock($blockerId: ID!, $blockedId: ID!) {
  addTaskBlock(blockerId: $blockerId, blockedId: $blockedId)
}
    `) as unknown as TypedDocumentString<AddTaskBlockMutation, AddTaskBlockMutationVariables>;
export const RemoveTaskBlockDocument = new TypedDocumentString(`
    mutation RemoveTaskBlock($blockerId: ID!, $blockedId: ID!) {
  removeTaskBlock(blockerId: $blockerId, blockedId: $blockedId)
}
    `) as unknown as TypedDocumentString<RemoveTaskBlockMutation, RemoveTaskBlockMutationVariables>;
export const AddTaskRelationDocument = new TypedDocumentString(`
    mutation AddTaskRelation($taskId: ID!, $otherId: ID!) {
  addTaskRelation(taskId: $taskId, otherId: $otherId)
}
    `) as unknown as TypedDocumentString<AddTaskRelationMutation, AddTaskRelationMutationVariables>;
export const RemoveTaskRelationDocument = new TypedDocumentString(`
    mutation RemoveTaskRelation($taskId: ID!, $otherId: ID!) {
  removeTaskRelation(taskId: $taskId, otherId: $otherId)
}
    `) as unknown as TypedDocumentString<RemoveTaskRelationMutation, RemoveTaskRelationMutationVariables>;
export const AddTaskCommentDocument = new TypedDocumentString(`
    mutation AddTaskComment($taskId: ID!, $body: String!) {
  addTaskComment(taskId: $taskId, body: $body) {
    ...TaskCommentFields
  }
}
    fragment TaskCommentFields on TaskComment {
  id
  body
  createdAt
}`) as unknown as TypedDocumentString<AddTaskCommentMutation, AddTaskCommentMutationVariables>;
export const UpdateTaskCommentDocument = new TypedDocumentString(`
    mutation UpdateTaskComment($id: ID!, $body: String!) {
  updateTaskComment(id: $id, body: $body) {
    ...TaskCommentFields
  }
}
    fragment TaskCommentFields on TaskComment {
  id
  body
  createdAt
}`) as unknown as TypedDocumentString<UpdateTaskCommentMutation, UpdateTaskCommentMutationVariables>;
export const DeleteTaskCommentDocument = new TypedDocumentString(`
    mutation DeleteTaskComment($id: ID!) {
  deleteTaskComment(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTaskCommentMutation, DeleteTaskCommentMutationVariables>;
export const CreateContributorDocument = new TypedDocumentString(`
    mutation CreateContributor($input: ContributorInput!) {
  createContributor(input: $input) {
    ...ContributorFields
  }
}
    fragment ContributorFields on Contributor {
  id
  name
  handle
  avatarUrl
  isMe
  projectIds
}`) as unknown as TypedDocumentString<CreateContributorMutation, CreateContributorMutationVariables>;
export const UpdateContributorDocument = new TypedDocumentString(`
    mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!) {
  updateContributor(id: $id, input: $input) {
    ...ContributorFields
  }
}
    fragment ContributorFields on Contributor {
  id
  name
  handle
  avatarUrl
  isMe
  projectIds
}`) as unknown as TypedDocumentString<UpdateContributorMutation, UpdateContributorMutationVariables>;
export const SetProjectContributorsDocument = new TypedDocumentString(`
    mutation SetProjectContributors($projectId: ID!, $contributorIds: [ID!]!) {
  setProjectContributors(projectId: $projectId, contributorIds: $contributorIds)
}
    `) as unknown as TypedDocumentString<SetProjectContributorsMutation, SetProjectContributorsMutationVariables>;
export const DeleteContributorDocument = new TypedDocumentString(`
    mutation DeleteContributor($id: ID!) {
  deleteContributor(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteContributorMutation, DeleteContributorMutationVariables>;
export const CreateTaskStatusDocument = new TypedDocumentString(`
    mutation CreateTaskStatus($input: TaskLabelInput!) {
  createTaskStatus(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateTaskStatusMutation, CreateTaskStatusMutationVariables>;
export const UpdateTaskStatusDocument = new TypedDocumentString(`
    mutation UpdateTaskStatus($id: ID!, $input: TaskLabelUpdateInput!) {
  updateTaskStatus(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTaskStatusMutation, UpdateTaskStatusMutationVariables>;
export const DeleteTaskStatusDocument = new TypedDocumentString(`
    mutation DeleteTaskStatus($id: ID!) {
  deleteTaskStatus(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTaskStatusMutation, DeleteTaskStatusMutationVariables>;
export const MoveTaskStatusDocument = new TypedDocumentString(`
    mutation MoveTaskStatus($id: ID!, $index: Int!) {
  moveTaskStatus(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveTaskStatusMutation, MoveTaskStatusMutationVariables>;
export const CreateTaskPriorityDocument = new TypedDocumentString(`
    mutation CreateTaskPriority($input: TaskLabelInput!) {
  createTaskPriority(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateTaskPriorityMutation, CreateTaskPriorityMutationVariables>;
export const UpdateTaskPriorityDocument = new TypedDocumentString(`
    mutation UpdateTaskPriority($id: ID!, $input: TaskLabelUpdateInput!) {
  updateTaskPriority(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTaskPriorityMutation, UpdateTaskPriorityMutationVariables>;
export const DeleteTaskPriorityDocument = new TypedDocumentString(`
    mutation DeleteTaskPriority($id: ID!) {
  deleteTaskPriority(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTaskPriorityMutation, DeleteTaskPriorityMutationVariables>;
export const MoveTaskPriorityDocument = new TypedDocumentString(`
    mutation MoveTaskPriority($id: ID!, $index: Int!) {
  moveTaskPriority(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveTaskPriorityMutation, MoveTaskPriorityMutationVariables>;
export const CreateTaskTypeDocument = new TypedDocumentString(`
    mutation CreateTaskType($input: TaskLabelInput!) {
  createTaskType(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateTaskTypeMutation, CreateTaskTypeMutationVariables>;
export const UpdateTaskTypeDocument = new TypedDocumentString(`
    mutation UpdateTaskType($id: ID!, $input: TaskLabelUpdateInput!) {
  updateTaskType(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTaskTypeMutation, UpdateTaskTypeMutationVariables>;
export const DeleteTaskTypeDocument = new TypedDocumentString(`
    mutation DeleteTaskType($id: ID!) {
  deleteTaskType(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTaskTypeMutation, DeleteTaskTypeMutationVariables>;
export const MoveTaskTypeDocument = new TypedDocumentString(`
    mutation MoveTaskType($id: ID!, $index: Int!) {
  moveTaskType(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveTaskTypeMutation, MoveTaskTypeMutationVariables>;
export const SetTasksClosedDocument = new TypedDocumentString(`
    mutation SetTasksClosed($ids: [ID!]!, $closed: Boolean!) {
  setTasksClosed(ids: $ids, closed: $closed)
}
    `) as unknown as TypedDocumentString<SetTasksClosedMutation, SetTasksClosedMutationVariables>;
export const TaskViewsDocument = new TypedDocumentString(`
    query TaskViews($projectId: ID) {
  taskViews(projectId: $projectId) {
    id
    name
    config
    isDefault
    position
  }
}
    `) as unknown as TypedDocumentString<TaskViewsQuery, TaskViewsQueryVariables>;
export const MatchingTaskIdsDocument = new TypedDocumentString(`
    query MatchingTaskIds($query: TaskQueryInput!) {
  matchingTaskIds(query: $query)
}
    `) as unknown as TypedDocumentString<MatchingTaskIdsQuery, MatchingTaskIdsQueryVariables>;
export const CreateTaskViewDocument = new TypedDocumentString(`
    mutation CreateTaskView($input: TaskViewInput!) {
  createTaskView(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateTaskViewMutation, CreateTaskViewMutationVariables>;
export const UpdateTaskViewDocument = new TypedDocumentString(`
    mutation UpdateTaskView($id: ID!, $input: TaskViewUpdateInput!) {
  updateTaskView(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTaskViewMutation, UpdateTaskViewMutationVariables>;
export const DuplicateTaskViewDocument = new TypedDocumentString(`
    mutation DuplicateTaskView($id: ID!, $name: String!) {
  duplicateTaskView(id: $id, name: $name) {
    id
  }
}
    `) as unknown as TypedDocumentString<DuplicateTaskViewMutation, DuplicateTaskViewMutationVariables>;
export const DeleteTaskViewDocument = new TypedDocumentString(`
    mutation DeleteTaskView($id: ID!) {
  deleteTaskView(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTaskViewMutation, DeleteTaskViewMutationVariables>;
export const SetDefaultTaskViewDocument = new TypedDocumentString(`
    mutation SetDefaultTaskView($id: ID!) {
  setDefaultTaskView(id: $id)
}
    `) as unknown as TypedDocumentString<SetDefaultTaskViewMutation, SetDefaultTaskViewMutationVariables>;
export const MoveTaskViewDocument = new TypedDocumentString(`
    mutation MoveTaskView($id: ID!, $index: Int!) {
  moveTaskView(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveTaskViewMutation, MoveTaskViewMutationVariables>;
export const BulkUpdateTasksDocument = new TypedDocumentString(`
    mutation BulkUpdateTasks($ids: [ID!]!, $changes: BulkTaskInput!) {
  bulkUpdateTasks(ids: $ids, changes: $changes)
}
    `) as unknown as TypedDocumentString<BulkUpdateTasksMutation, BulkUpdateTasksMutationVariables>;
export const BulkTransferTasksDocument = new TypedDocumentString(`
    mutation BulkTransferTasks($ids: [ID!]!, $projectId: ID!) {
  bulkTransferTasks(ids: $ids, projectId: $projectId) {
    removedLinks
  }
}
    `) as unknown as TypedDocumentString<BulkTransferTasksMutation, BulkTransferTasksMutationVariables>;
export const BulkSetTasksArchivedDocument = new TypedDocumentString(`
    mutation BulkSetTasksArchived($ids: [ID!]!, $archived: Boolean!) {
  bulkSetTasksArchived(ids: $ids, archived: $archived)
}
    `) as unknown as TypedDocumentString<BulkSetTasksArchivedMutation, BulkSetTasksArchivedMutationVariables>;
export const BulkDeleteTasksDocument = new TypedDocumentString(`
    mutation BulkDeleteTasks($ids: [ID!]!, $deleteSubtasks: Boolean!) {
  bulkDeleteTasks(ids: $ids, deleteSubtasks: $deleteSubtasks)
}
    `) as unknown as TypedDocumentString<BulkDeleteTasksMutation, BulkDeleteTasksMutationVariables>;
export const CreateMilestoneDocument = new TypedDocumentString(`
    mutation CreateMilestone($input: MilestoneInput!) {
  createMilestone(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateMilestoneMutation, CreateMilestoneMutationVariables>;
export const UpdateMilestoneDocument = new TypedDocumentString(`
    mutation UpdateMilestone($id: ID!, $input: MilestoneUpdateInput!) {
  updateMilestone(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateMilestoneMutation, UpdateMilestoneMutationVariables>;
export const DeleteMilestoneDocument = new TypedDocumentString(`
    mutation DeleteMilestone($id: ID!) {
  deleteMilestone(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteMilestoneMutation, DeleteMilestoneMutationVariables>;
export const MoveMilestoneDocument = new TypedDocumentString(`
    mutation MoveMilestone($id: ID!, $index: Int!) {
  moveMilestone(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveMilestoneMutation, MoveMilestoneMutationVariables>;
export const CreateSprintDocument = new TypedDocumentString(`
    mutation CreateSprint($projectId: ID!, $input: SprintInput!) {
  createSprint(projectId: $projectId, input: $input)
}
    `) as unknown as TypedDocumentString<CreateSprintMutation, CreateSprintMutationVariables>;
export const UpdateSprintDocument = new TypedDocumentString(`
    mutation UpdateSprint($id: ID!, $input: SprintInput!) {
  updateSprint(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateSprintMutation, UpdateSprintMutationVariables>;
export const DeleteSprintDocument = new TypedDocumentString(`
    mutation DeleteSprint($id: ID!) {
  deleteSprint(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteSprintMutation, DeleteSprintMutationVariables>;
export const TimeEntriesDocument = new TypedDocumentString(`
    query TimeEntries($projectId: ID) {
  timeEntries(projectId: $projectId) {
    ...TimeEntryFields
  }
}
    fragment TimeEntryFields on TimeEntry {
  id
  projectId
  description
  startedAt
  endedAt
  pausedAt
  pausedSeconds
  duration
  taskIds
  documentId
  documentNumber
}`) as unknown as TypedDocumentString<TimeEntriesQuery, TimeEntriesQueryVariables>;
export const RunningTimeEntryDocument = new TypedDocumentString(`
    query RunningTimeEntry {
  runningTimeEntry {
    ...TimeEntryFields
  }
}
    fragment TimeEntryFields on TimeEntry {
  id
  projectId
  description
  startedAt
  endedAt
  pausedAt
  pausedSeconds
  duration
  taskIds
  documentId
  documentNumber
}`) as unknown as TypedDocumentString<RunningTimeEntryQuery, RunningTimeEntryQueryVariables>;
export const StartTimerDocument = new TypedDocumentString(`
    mutation StartTimer($input: TimerInput!) {
  startTimer(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<StartTimerMutation, StartTimerMutationVariables>;
export const SetTimerPausedDocument = new TypedDocumentString(`
    mutation SetTimerPaused($paused: Boolean!) {
  setTimerPaused(paused: $paused) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetTimerPausedMutation, SetTimerPausedMutationVariables>;
export const StopTimerDocument = new TypedDocumentString(`
    mutation StopTimer {
  stopTimer {
    id
  }
}
    `) as unknown as TypedDocumentString<StopTimerMutation, StopTimerMutationVariables>;
export const CreateTimeEntryDocument = new TypedDocumentString(`
    mutation CreateTimeEntry($input: TimeEntryInput!) {
  createTimeEntry(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateTimeEntryMutation, CreateTimeEntryMutationVariables>;
export const UpdateTimeEntryDocument = new TypedDocumentString(`
    mutation UpdateTimeEntry($id: ID!, $input: TimeEntryUpdateInput!) {
  updateTimeEntry(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTimeEntryMutation, UpdateTimeEntryMutationVariables>;
export const DeleteTimeEntryDocument = new TypedDocumentString(`
    mutation DeleteTimeEntry($id: ID!) {
  deleteTimeEntry(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTimeEntryMutation, DeleteTimeEntryMutationVariables>;
export const TreasuryAccountsDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<TreasuryAccountsQuery, TreasuryAccountsQueryVariables>;
export const TreasuryEntriesDocument = new TypedDocumentString(`
    query TreasuryEntries($from: Date!, $to: Date!, $accountId: ID) {
  treasuryEntries(from: $from, to: $to, accountId: $accountId) {
    ...TreasuryEntryFields
  }
}
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
}`) as unknown as TypedDocumentString<TreasuryEntriesQuery, TreasuryEntriesQueryVariables>;
export const ForecastEntriesDocument = new TypedDocumentString(`
    query ForecastEntries {
  forecastEntries {
    ...TreasuryEntryFields
  }
}
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
}`) as unknown as TypedDocumentString<ForecastEntriesQuery, ForecastEntriesQueryVariables>;
export const TreasuryProjectionDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<TreasuryProjectionQuery, TreasuryProjectionQueryVariables>;
export const CreateTreasuryAccountDocument = new TypedDocumentString(`
    mutation CreateTreasuryAccount($input: TreasuryAccountInput!) {
  createTreasuryAccount(input: $input)
}
    `) as unknown as TypedDocumentString<CreateTreasuryAccountMutation, CreateTreasuryAccountMutationVariables>;
export const UpdateTreasuryAccountDocument = new TypedDocumentString(`
    mutation UpdateTreasuryAccount($id: ID!, $input: TreasuryAccountInput!) {
  updateTreasuryAccount(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateTreasuryAccountMutation, UpdateTreasuryAccountMutationVariables>;
export const DeleteTreasuryAccountDocument = new TypedDocumentString(`
    mutation DeleteTreasuryAccount($id: ID!) {
  deleteTreasuryAccount(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryAccountMutation, DeleteTreasuryAccountMutationVariables>;
export const CreateTreasuryEntryDocument = new TypedDocumentString(`
    mutation CreateTreasuryEntry($input: TreasuryEntryInput!) {
  createTreasuryEntry(input: $input)
}
    `) as unknown as TypedDocumentString<CreateTreasuryEntryMutation, CreateTreasuryEntryMutationVariables>;
export const UpdateTreasuryEntryDocument = new TypedDocumentString(`
    mutation UpdateTreasuryEntry($id: ID!, $input: TreasuryEntryInput!) {
  updateTreasuryEntry(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateTreasuryEntryMutation, UpdateTreasuryEntryMutationVariables>;
export const DeleteTreasuryEntryDocument = new TypedDocumentString(`
    mutation DeleteTreasuryEntry($id: ID!) {
  deleteTreasuryEntry(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryEntryMutation, DeleteTreasuryEntryMutationVariables>;
export const RealizeTreasuryForecastDocument = new TypedDocumentString(`
    mutation RealizeTreasuryForecast($id: ID!, $occurrence: Date!, $date: Date!, $amount: Float!) {
  realizeTreasuryForecast(
    id: $id
    occurrence: $occurrence
    date: $date
    amount: $amount
  )
}
    `) as unknown as TypedDocumentString<RealizeTreasuryForecastMutation, RealizeTreasuryForecastMutationVariables>;
export const WorkspaceDocument = new TypedDocumentString(`
    query Workspace {
  clients {
    ...ClientFields
  }
  projects {
    ...ProjectFields
  }
  projectCategories {
    ...LabelFields
  }
  projectStatuses {
    ...ProjectStatusFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}
fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<WorkspaceQuery, WorkspaceQueryVariables>;
export const CreateClientDocument = new TypedDocumentString(`
    mutation CreateClient($input: ClientInput!) {
  createClient(input: $input) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<CreateClientMutation, CreateClientMutationVariables>;
export const UpdateClientDocument = new TypedDocumentString(`
    mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {
  updateClient(id: $id, input: $input) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<UpdateClientMutation, UpdateClientMutationVariables>;
export const SetClientFavoriteDocument = new TypedDocumentString(`
    mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {
  setClientFavorite(id: $id, favorite: $favorite) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<SetClientFavoriteMutation, SetClientFavoriteMutationVariables>;
export const SetClientArchivedDocument = new TypedDocumentString(`
    mutation SetClientArchived($id: ID!, $archived: Boolean!) {
  setClientArchived(id: $id, archived: $archived) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<SetClientArchivedMutation, SetClientArchivedMutationVariables>;
export const DeleteClientDocument = new TypedDocumentString(`
    mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {
  deleteClient(id: $id, deleteProjects: $deleteProjects)
}
    `) as unknown as TypedDocumentString<DeleteClientMutation, DeleteClientMutationVariables>;
export const MoveClientDocument = new TypedDocumentString(`
    mutation MoveClient($id: ID!, $index: Int!) {
  moveClient(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveClientMutation, MoveClientMutationVariables>;
export const CreateProjectDocument = new TypedDocumentString(`
    mutation CreateProject($input: ProjectInput!) {
  createProject(input: $input) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<CreateProjectMutation, CreateProjectMutationVariables>;
export const UpdateProjectDocument = new TypedDocumentString(`
    mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {
  updateProject(id: $id, input: $input) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<UpdateProjectMutation, UpdateProjectMutationVariables>;
export const SetProjectFavoriteDocument = new TypedDocumentString(`
    mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {
  setProjectFavorite(id: $id, favorite: $favorite) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<SetProjectFavoriteMutation, SetProjectFavoriteMutationVariables>;
export const SetProjectArchivedDocument = new TypedDocumentString(`
    mutation SetProjectArchived($id: ID!, $archived: Boolean!) {
  setProjectArchived(id: $id, archived: $archived) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<SetProjectArchivedMutation, SetProjectArchivedMutationVariables>;
export const DeleteProjectDocument = new TypedDocumentString(`
    mutation DeleteProject($id: ID!) {
  deleteProject(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectMutation, DeleteProjectMutationVariables>;
export const MoveProjectDocument = new TypedDocumentString(`
    mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {
  moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)
}
    `) as unknown as TypedDocumentString<MoveProjectMutation, MoveProjectMutationVariables>;
export const CreateProjectCategoryDocument = new TypedDocumentString(`
    mutation CreateProjectCategory($input: ProjectCategoryInput!) {
  createProjectCategory(input: $input) {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}`) as unknown as TypedDocumentString<CreateProjectCategoryMutation, CreateProjectCategoryMutationVariables>;
export const UpdateProjectCategoryDocument = new TypedDocumentString(`
    mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {
  updateProjectCategory(id: $id, input: $input) {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}`) as unknown as TypedDocumentString<UpdateProjectCategoryMutation, UpdateProjectCategoryMutationVariables>;
export const DeleteProjectCategoryDocument = new TypedDocumentString(`
    mutation DeleteProjectCategory($id: ID!) {
  deleteProjectCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectCategoryMutation, DeleteProjectCategoryMutationVariables>;
export const CreateProjectStatusDocument = new TypedDocumentString(`
    mutation CreateProjectStatus($input: ProjectStatusInput!) {
  createProjectStatus(input: $input) {
    ...ProjectStatusFields
  }
}
    fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}`) as unknown as TypedDocumentString<CreateProjectStatusMutation, CreateProjectStatusMutationVariables>;
export const UpdateProjectStatusDocument = new TypedDocumentString(`
    mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {
  updateProjectStatus(id: $id, input: $input) {
    ...ProjectStatusFields
  }
}
    fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}`) as unknown as TypedDocumentString<UpdateProjectStatusMutation, UpdateProjectStatusMutationVariables>;
export const DeleteProjectStatusDocument = new TypedDocumentString(`
    mutation DeleteProjectStatus($id: ID!) {
  deleteProjectStatus(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectStatusMutation, DeleteProjectStatusMutationVariables>;
export const MoveProjectStatusDocument = new TypedDocumentString(`
    mutation MoveProjectStatus($id: ID!, $index: Int!) {
  moveProjectStatus(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveProjectStatusMutation, MoveProjectStatusMutationVariables>;
export const UploadAttachmentDocument = new TypedDocumentString(`
    mutation UploadAttachment($file: File!) {
  uploadAttachment(file: $file) {
    id
    name
    url
    isImage
  }
}
    `) as unknown as TypedDocumentString<UploadAttachmentMutation, UploadAttachmentMutationVariables>;