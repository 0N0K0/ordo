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
  /** Deductions: deposit invoice whose amount the line takes off. */
  deductedDocumentId?: string | number | null | undefined;
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
  addSprintIds?: Array<string | number> | null | undefined;
  addTagIds?: Array<string | number> | null | undefined;
  deadline?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  milestoneId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  removeAssigneeIds?: Array<string | number> | null | undefined;
  removeSprintIds?: Array<string | number> | null | undefined;
  removeTagIds?: Array<string | number> | null | undefined;
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
  /** Calendar; the first one of the workspace when omitted. */
  calendarId?: string | number | null | undefined;
  categoryIds: Array<string | number>;
  contributorIds: Array<string | number>;
  description?: string | null | undefined;
  endDate: string;
  endTime?: string | null | undefined;
  links: Array<CalendarLinkInput>;
  location?: string | null | undefined;
  /** Point of the location; none: unknown. */
  locationLat?: number | null | undefined;
  locationLon?: number | null | undefined;
  projectId?: string | number | null | undefined;
  recurrence?: unknown;
  /** Relations without contributor taking part; none: none. */
  relationIds?: Array<string | number> | null | undefined;
  /** Minutes before the start. */
  reminders: Array<number>;
  startDate: string;
  startTime?: string | null | undefined;
  /** Tasks the event is about (none when omitted). */
  taskIds?: Array<string | number> | null | undefined;
  timeZone: string;
  title: string;
  /** Travel time back from the event, in minutes; none: 0. */
  travelAfter?: number | null | undefined;
  /** Travel time to the event, in minutes; none: 0. */
  travelBefore?: number | null | undefined;
};

/** Scope of a change to a recurring event. */
export type CalendarEventScope =
  | 'ALL'
  | 'FOLLOWING'
  | 'THIS';

export type CalendarInput = {
  color: string;
  name: string;
};

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
  contact?: string | null | undefined;
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

export type DefaultScheduleKindInput = {
  color?: string | null | undefined;
  dayBar: boolean;
  dayDisplay: string;
  monthDisplay: string;
  /** Empty: "Travail". */
  name: string;
};

export type DiscountType =
  | 'AMOUNT'
  | 'PERCENT';

export type DocumentPaymentInput = {
  accountId: string | number;
  amount: number;
  date: string;
  methodId?: string | number | null | undefined;
};

export type DocumentStatusCategory =
  | 'ACCEPTED'
  | 'CREDIT_DUE'
  | 'PAID'
  | 'REFUSED'
  | 'SENT'
  | 'TO_SEND';

export type DocumentStatusScope =
  | 'INVOICE'
  | 'QUOTE';

export type GeoPointInput = {
  lat: number;
  lon: number;
};

export type GithubLinkInput = {
  effortFieldId?: string | null | undefined;
  enabled: boolean;
  endFieldId?: string | null | undefined;
  iterationFieldId?: string | null | undefined;
  priorityFieldId?: string | null | undefined;
  /** { [ordoPriorityId]: optionId } */
  priorityOptions: unknown;
  pushExisting: boolean;
  /** owner/name: new tasks become issues of it; drafts without it. */
  repositoryName?: string | null | undefined;
  startFieldId?: string | null | undefined;
  statusFieldId?: string | null | undefined;
  /** { [ordoStatusId]: optionId } */
  statusOptions: unknown;
  url: string;
};

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

export type MailSearchInput = {
  accountIds: Array<string | number>;
  attachments?: boolean | null | undefined;
  body?: string | null | undefined;
  /** Folder path, with the folder scope. */
  folder?: string | null | undefined;
  from?: string | null | undefined;
  labelIds: Array<string | number>;
  name: string;
  /** inbox, all or folder. */
  scope: string;
  since?: string | null | undefined;
  /** all, todo or done. */
  state: string;
  subject?: string | null | undefined;
  text: string;
  to?: string | null | undefined;
  unread: boolean;
  until?: string | null | undefined;
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

/** Kind of notification a workspace can give while another one is open. */
export type NotificationSource =
  | 'ALARMS'
  | 'CALENDAR'
  | 'MAILS';

export type PlaceInput = {
  address: string;
  lat: number;
  lon: number;
  name: string;
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

/** Color and display of a kind of schedules subscribed to, in this workspace; null: those of the kind. */
export type ScheduleSubscriptionLookInput = {
  color?: string | null | undefined;
  dayBar?: boolean | null | undefined;
  dayDisplay?: string | null | undefined;
  monthDisplay?: string | null | undefined;
};

export type ScheduleTypeInput = {
  color: string;
  dayBar: boolean;
  dayDisplay: string;
  monthDisplay: string;
  name: string;
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
  deadline?: string | null | undefined;
  description?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  milestoneId?: string | number | null | undefined;
  parentId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  projectId: string | number;
  sprintIds?: Array<string | number> | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  tagIds?: Array<string | number> | null | undefined;
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
  deadline?: string | null | undefined;
  description?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  milestoneId?: string | number | null | undefined;
  parentId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  sprintIds?: Array<string | number> | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  tagIds?: Array<string | number> | null | undefined;
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
  event?: TimeEventInput | null | undefined;
  projectId: string | number;
  startedAt: string;
  taskIds: Array<string | number>;
};

/** Omitted fields are left unchanged. The duration of the running timer cannot be changed. */
export type TimeEntryUpdateInput = {
  description?: string | null | undefined;
  /** Seconds. */
  duration?: number | null | undefined;
  /** Null: no event; omitted: unchanged. */
  event?: TimeEventInput | null | undefined;
  projectId?: string | number | null | undefined;
  startedAt?: string | null | undefined;
  taskIds?: Array<string | number> | null | undefined;
};

/** Calendar event a time is spent on (its occurrence for a recurring one). */
export type TimeEventInput = {
  eventId: string | number;
  occurrenceDate?: string | null | undefined;
};

export type TimerInput = {
  description?: string | null | undefined;
  event?: TimeEventInput | null | undefined;
  projectId: string | number;
  taskIds: Array<string | number>;
};

export type TravelMode =
  | 'BIKE'
  | 'CAR'
  | 'FOOT';

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

export type TreasuryBudgetInput = {
  amount: number;
  categoryId: string | number;
  contextId?: string | number | null | undefined;
  memberId?: string | number | null | undefined;
  /** YYYY-MM. */
  month: string;
  relationId?: string | number | null | undefined;
  repeatEvery?: number | null | undefined;
  /** YYYY-MM. */
  repeatUntil?: string | null | undefined;
};

export type TreasuryCategoryInput = {
  direction: TreasuryDirection;
  name: string;
  parentId?: string | number | null | undefined;
};

export type TreasuryContextInput = {
  color: string;
  name: string;
};

export type TreasuryContextPeriodInput = {
  contextId: string | number;
  endDate: string;
  note?: string | null | undefined;
  startDate: string;
};

export type TreasuryCounterpartyInput = {
  archived: boolean;
  name: string;
  note?: string | null | undefined;
};

export type TreasuryDirection =
  | 'IN'
  | 'OUT';

export type TreasuryEntryInput = {
  accountId: string | number;
  allocations: Array<TreasuryAllocationInput>;
  amount: number;
  categoryId?: string | number | null | undefined;
  clientId?: string | number | null | undefined;
  counterpartyId?: string | number | null | undefined;
  date: string;
  label: string;
  libraryDocumentIds?: Array<string | number> | null | undefined;
  /** Split of the amount (none when omitted). */
  lines?: Array<TreasuryEntryLineInput> | null | undefined;
  linkedEntryIds?: Array<string | number> | null | undefined;
  methodId?: string | number | null | undefined;
  note?: string | null | undefined;
  projectId?: string | number | null | undefined;
  projectResourceIds?: Array<string | number> | null | undefined;
  recurrence?: unknown;
  status: TreasuryEntryStatus;
  /** The execution date when omitted. */
  valueDate?: string | null | undefined;
};

export type TreasuryEntryLineInput = {
  categoryId?: string | number | null | undefined;
  contextId?: string | number | null | undefined;
  date?: string | null | undefined;
  /** Line kept (its links from other entries stay); none for a new line. */
  id?: string | number | null | undefined;
  label?: string | null | undefined;
  libraryDocumentIds?: Array<string | number> | null | undefined;
  /** Other entries, without lines. */
  linkedEntryIds?: Array<string | number> | null | undefined;
  /** Lines of other entries. */
  linkedLineIds?: Array<string | number> | null | undefined;
  loan?: boolean | null | undefined;
  memberId?: string | number | null | undefined;
  mode: TreasuryLineMode;
  projectId?: string | number | null | undefined;
  projectResourceIds?: Array<string | number> | null | undefined;
  /** Relation it is for, instead of a member. */
  relationId?: string | number | null | undefined;
  value: number;
};

export type TreasuryEntryStatus =
  | 'ACTUAL'
  | 'FORECAST';

export type TreasuryLineMode =
  | 'AMOUNT'
  | 'PERCENT';

export type TreasuryPaymentMethodInput = {
  incoming: boolean;
  name: string;
  outgoing: boolean;
};

export type TreasuryRelationInput = {
  contributorId?: string | number | null | undefined;
  name: string;
  note?: string | null | undefined;
};

export type TreasuryStatementRowInput = {
  amount: number;
  date: string;
  /** Forecast it realizes. */
  forecastId?: string | number | null | undefined;
  label: string;
  /** Occurrence of a repeated forecast it realizes. */
  occurrence?: string | null | undefined;
};

export type WorkScheduleInput = {
  /** Cases (shared schedule case shape). */
  cases: unknown;
  endDate?: string | null | undefined;
  /** Exceptions: { from, to, label, cases }. */
  exceptions: unknown;
  name: string;
  startDate: string;
  /** Kind of time it plans; none: working hours. */
  typeId?: string | number | null | undefined;
};

export type WorkspaceInput = {
  kind: WorkspaceKind;
  name: string;
};

/** Professional (invoicing, clients, company) or personal workspace. */
export type WorkspaceKind =
  | 'PERSO'
  | 'PRO';

export type CompanyProfileFieldsFragment = { name: string, contact: string | null, legalForm: string | null, capital: string | null, registration: string | null, siren: string | null, siret: string | null, activityCode: string | null, vatNumber: string | null, vatApplicable: boolean, vatExemptionText: string, address: unknown, email: string | null, phone: string | null, website: string | null, logoUrl: string | null, bankName: string | null, accountHolder: string | null, iban: string | null, bic: string | null, paymentTerms: string, paymentDays: number, paymentMethods: string, lateInterest: string, otherMentions: string, referenceLabel: string, quoteValidityDays: number };

export type CompanyProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type CompanyProfileQuery = { companyProfile: { name: string, contact: string | null, legalForm: string | null, capital: string | null, registration: string | null, siren: string | null, siret: string | null, activityCode: string | null, vatNumber: string | null, vatApplicable: boolean, vatExemptionText: string, address: unknown, email: string | null, phone: string | null, website: string | null, logoUrl: string | null, bankName: string | null, accountHolder: string | null, iban: string | null, bic: string | null, paymentTerms: string, paymentDays: number, paymentMethods: string, lateInterest: string, otherMentions: string, referenceLabel: string, quoteValidityDays: number } };

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

export type AccountingDocumentListFieldsFragment = { id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, paid: number | null, overdue: boolean, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, depositType: DiscountType | null, depositValue: number | null, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null };

export type AccountingDocumentFieldsFragment = { serviceStart: string | null, serviceEnd: string | null, serviceId: string | null, contactId: string | null, sourceId: string | null, importedSourceId: string | null, importedSourceNumber: string | null, seller: unknown, buyer: unknown, introduction: string | null, referenceLabel: string | null, referenceValue: string | null, conclusion: string | null, paymentTerms: string | null, paymentMethods: string | null, lateInterest: string | null, depositType: DiscountType | null, depositValue: number | null, billingSchedule: string | null, otherMentions: string | null, showBankDetails: boolean, vatApplicable: boolean, vatExemptionText: string | null, globalDiscountType: DiscountType | null, globalDiscountValue: number | null, totalVat: number, finalizedAt: string | null, updatedAt: string, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, signedFileUrl: string | null, signedFileName: string | null, paid: number | null, credited: number | null, id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, derived: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, totalGross: number }>, timeEntries: Array<{ id: string, projectId: string, description: string | null, startedAt: string, duration: number | null }>, reminders: Array<{ id: string, date: string, note: string | null }>, payments: Array<{ id: string, amount: number, entry: { id: string, date: string, accountName: string, methodName: string | null } }>, lines: Array<{ id: string, kind: AccountingLineKind, title: string, description: string | null, quantity: number, unit: AccountingUnit, unitPrice: number, vatRate: number, discountType: DiscountType | null, discountValue: number | null, deductedDocumentId: string | null }>, attachments: Array<{ id: string, name: string, size: number, url: string }>, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null };

export type AccountingDocumentsQueryVariables = Exact<{
  clientId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
}>;


export type AccountingDocumentsQuery = { accountingDocuments: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, paid: number | null, overdue: boolean, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, depositType: DiscountType | null, depositValue: number | null, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null }> };

export type AccountingDocumentQueryVariables = Exact<{
  id: string | number;
}>;


export type AccountingDocumentQuery = { accountingDocument: { serviceStart: string | null, serviceEnd: string | null, serviceId: string | null, contactId: string | null, sourceId: string | null, importedSourceId: string | null, importedSourceNumber: string | null, seller: unknown, buyer: unknown, introduction: string | null, referenceLabel: string | null, referenceValue: string | null, conclusion: string | null, paymentTerms: string | null, paymentMethods: string | null, lateInterest: string | null, depositType: DiscountType | null, depositValue: number | null, billingSchedule: string | null, otherMentions: string | null, showBankDetails: boolean, vatApplicable: boolean, vatExemptionText: string | null, globalDiscountType: DiscountType | null, globalDiscountValue: number | null, totalVat: number, finalizedAt: string | null, updatedAt: string, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, signedFileUrl: string | null, signedFileName: string | null, paid: number | null, credited: number | null, id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, derived: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, totalGross: number }>, timeEntries: Array<{ id: string, projectId: string, description: string | null, startedAt: string, duration: number | null }>, reminders: Array<{ id: string, date: string, note: string | null }>, payments: Array<{ id: string, amount: number, entry: { id: string, date: string, accountName: string, methodName: string | null } }>, lines: Array<{ id: string, kind: AccountingLineKind, title: string, description: string | null, quantity: number, unit: AccountingUnit, unitPrice: number, vatRate: number, discountType: DiscountType | null, discountValue: number | null, deductedDocumentId: string | null }>, attachments: Array<{ id: string, name: string, size: number, url: string }>, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null } | null };

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

export type DeductibleDepositsQueryVariables = Exact<{
  clientId: string | number;
  documentId?: string | number | null | undefined;
}>;


export type DeductibleDepositsQuery = { deductibleDeposits: Array<{ id: string, number: string, issueDate: string, totalGross: number, remaining: Array<{ rate: number, amount: number }> }> };

export type LatestDocumentDateQueryVariables = Exact<{
  type: AccountingDocumentType;
  documentId?: string | number | null | undefined;
}>;


export type LatestDocumentDateQuery = { latestDocumentDate: string | null };

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

export type CreateDepositInvoiceMutationVariables = Exact<{
  quoteId?: string | number | null | undefined;
  importedQuoteId?: string | number | null | undefined;
  percent: number;
  issueDate: string;
}>;


export type CreateDepositInvoiceMutation = { createDepositInvoice: string };

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

export type ImportedDocumentFieldsFragment = { id: string, type: AccountingDocumentType, number: string, issueDate: string, dueDate: string | null, clientId: string | null, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalVat: number, totalGross: number, currency: string, note: string | null, fileUrl: string | null, fileName: string | null, settled: boolean, paid: number | null, balance: number | null, fileMimeType: string | null, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null };

export type ImportedDocumentsQueryVariables = Exact<{
  clientId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
}>;


export type ImportedDocumentsQuery = { importedDocuments: Array<{ id: string, type: AccountingDocumentType, number: string, issueDate: string, dueDate: string | null, clientId: string | null, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalVat: number, totalGross: number, currency: string, note: string | null, fileUrl: string | null, fileName: string | null, settled: boolean, paid: number | null, balance: number | null, fileMimeType: string | null, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null }> };

export type ImportedDocumentQueryVariables = Exact<{
  id: string | number;
}>;


export type ImportedDocumentQuery = { importedDocument: { id: string, type: AccountingDocumentType, number: string, issueDate: string, dueDate: string | null, clientId: string | null, clientName: string, projectId: string | null, title: string | null, totalNet: number, totalVat: number, totalGross: number, currency: string, note: string | null, fileUrl: string | null, fileName: string | null, settled: boolean, paid: number | null, balance: number | null, fileMimeType: string | null, trackingStatus: { id: string, name: string, color: string, category: DocumentStatusCategory } | null } | null };

export type SetImportedDocumentTrackingStatusMutationVariables = Exact<{
  id: string | number;
  statusId?: string | number | null | undefined;
}>;


export type SetImportedDocumentTrackingStatusMutation = { setImportedDocumentTrackingStatus: boolean };

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
  date?: string | null | undefined;
  via?: string | null | undefined;
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

export type CalendarEventOccurrenceFieldsFragment = { key: string, eventId: string, occurrenceDate: string | null, modified: boolean, title: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, timeZone: string, start: string, end: string, recurrence: unknown, seriesStartDate: string, reminders: Array<number>, travelBefore: number, travelAfter: number, projectId: string | null, calendarId: string, contributorIds: Array<string>, relationIds: Array<string>, categoryIds: Array<string>, taskIds: Array<string>, calledOff: boolean, trackedSeconds: number, links: Array<{ url: string, label: string }>, postponedFrom: { eventId: string, date: string | null, title: string } | null, postponedTo: Array<{ eventId: string, title: string, startDate: string, startTime: string | null }> };

export type WorkSchedulesQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkSchedulesQuery = { workSchedules: Array<{ id: string, name: string, startDate: string, endDate: string | null, typeId: string | null, cases: unknown, exceptions: unknown }>, scheduleTypes: Array<{ id: string, name: string, color: string, dayDisplay: string, dayBar: boolean, monthDisplay: string, position: number }>, defaultScheduleKind: { name: string, color: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string } };

export type ForeignScheduleKindsQueryVariables = Exact<{ [key: string]: never; }>;


export type ForeignScheduleKindsQuery = { foreignScheduleKinds: Array<{ workspaceId: string, workspaceName: string, typeId: string | null, name: string, color: string | null, sourceColor: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string, customized: boolean, scheduleCount: number, subscribed: boolean }> };

export type SubscribedWorkSchedulesQueryVariables = Exact<{ [key: string]: never; }>;


export type SubscribedWorkSchedulesQuery = { subscribedWorkSchedules: Array<{ id: string, name: string, startDate: string, endDate: string | null, cases: unknown, exceptions: unknown, typeName: string | null, color: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string, workspaceId: string, workspaceName: string }> };

export type SaveScheduleTypeMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: ScheduleTypeInput;
}>;


export type SaveScheduleTypeMutation = { saveScheduleType: string };

export type DeleteScheduleTypeMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteScheduleTypeMutation = { deleteScheduleType: boolean };

export type SubscribeScheduleKindMutationVariables = Exact<{
  workspaceId: string | number;
  typeId?: string | number | null | undefined;
}>;


export type SubscribeScheduleKindMutation = { subscribeScheduleKind: boolean };

export type SaveDefaultScheduleKindMutationVariables = Exact<{
  input: DefaultScheduleKindInput;
}>;


export type SaveDefaultScheduleKindMutation = { saveDefaultScheduleKind: { name: string } };

export type SetScheduleSubscriptionLookMutationVariables = Exact<{
  workspaceId: string | number;
  typeId?: string | number | null | undefined;
  input: ScheduleSubscriptionLookInput;
}>;


export type SetScheduleSubscriptionLookMutation = { setScheduleSubscriptionLook: boolean };

export type UnsubscribeScheduleKindMutationVariables = Exact<{
  workspaceId: string | number;
  typeId?: string | number | null | undefined;
}>;


export type UnsubscribeScheduleKindMutation = { unsubscribeScheduleKind: boolean };

export type CreateWorkScheduleMutationVariables = Exact<{
  input: WorkScheduleInput;
}>;


export type CreateWorkScheduleMutation = { createWorkSchedule: string };

export type UpdateWorkScheduleMutationVariables = Exact<{
  id: string | number;
  input: WorkScheduleInput;
}>;


export type UpdateWorkScheduleMutation = { updateWorkSchedule: boolean };

export type DeleteWorkScheduleMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteWorkScheduleMutation = { deleteWorkSchedule: boolean };

export type SetCalendarEventCalledOffMutationVariables = Exact<{
  id: string | number;
  scope: CalendarEventScope;
  occurrenceDate?: string | null | undefined;
  calledOff: boolean;
}>;


export type SetCalendarEventCalledOffMutation = { setCalendarEventCalledOff: boolean };

export type PostponeCalendarEventMutationVariables = Exact<{
  id: string | number;
  occurrenceDate?: string | null | undefined;
  input: CalendarEventInput;
}>;


export type PostponeCalendarEventMutation = { postponeCalendarEvent: string };

export type CalendarCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type CalendarCategoriesQuery = { calendarCategories: Array<{ id: string, name: string, color: string, parentId: string | null, position: number }> };

export type CalendarEventsQueryVariables = Exact<{
  from: string;
  to: string;
}>;


export type CalendarEventsQuery = { calendarEvents: Array<{ key: string, eventId: string, occurrenceDate: string | null, modified: boolean, title: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, timeZone: string, start: string, end: string, recurrence: unknown, seriesStartDate: string, reminders: Array<number>, travelBefore: number, travelAfter: number, projectId: string | null, calendarId: string, contributorIds: Array<string>, relationIds: Array<string>, categoryIds: Array<string>, taskIds: Array<string>, calledOff: boolean, trackedSeconds: number, links: Array<{ url: string, label: string }>, postponedFrom: { eventId: string, date: string | null, title: string } | null, postponedTo: Array<{ eventId: string, title: string, startDate: string, startTime: string | null }> }> };

export type CalendarsQueryVariables = Exact<{ [key: string]: never; }>;


export type CalendarsQuery = { calendars: Array<{ id: string, name: string, color: string, position: number }>, calendarSubscriptions: Array<{ id: string, calendarId: string, name: string, color: string, workspace: { id: string, name: string, kind: string } }> };

export type SubscribableCalendarsQueryVariables = Exact<{ [key: string]: never; }>;


export type SubscribableCalendarsQuery = { subscribableCalendars: Array<{ id: string, name: string, color: string, subscribed: boolean, workspace: { id: string, name: string, kind: string } }> };

export type SubscribedCalendarEventsQueryVariables = Exact<{
  from: string;
  to: string;
}>;


export type SubscribedCalendarEventsQuery = { subscribedCalendarEvents: Array<{ key: string, eventId: string, occurrenceDate: string | null, modified: boolean, title: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, timeZone: string, start: string, end: string, recurrence: unknown, seriesStartDate: string, reminders: Array<number>, travelBefore: number, travelAfter: number, projectId: string | null, calendarId: string, contributorIds: Array<string>, relationIds: Array<string>, categoryIds: Array<string>, taskIds: Array<string>, calledOff: boolean, trackedSeconds: number, links: Array<{ url: string, label: string }>, postponedFrom: { eventId: string, date: string | null, title: string } | null, postponedTo: Array<{ eventId: string, title: string, startDate: string, startTime: string | null }> }> };

export type CreateCalendarMutationVariables = Exact<{
  input: CalendarInput;
}>;


export type CreateCalendarMutation = { createCalendar: { id: string } };

export type UpdateCalendarMutationVariables = Exact<{
  id: string | number;
  input: CalendarInput;
}>;


export type UpdateCalendarMutation = { updateCalendar: { id: string } };

export type MoveCalendarMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveCalendarMutation = { moveCalendar: boolean };

export type DeleteCalendarMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteCalendarMutation = { deleteCalendar: boolean };

export type SubscribeCalendarMutationVariables = Exact<{
  calendarId: string | number;
}>;


export type SubscribeCalendarMutation = { subscribeCalendar: boolean };

export type UnsubscribeCalendarMutationVariables = Exact<{
  calendarId: string | number;
}>;


export type UnsubscribeCalendarMutation = { unsubscribeCalendar: boolean };

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

export type SprintTaskStatusesQueryVariables = Exact<{
  today: string;
}>;


export type SprintTaskStatusesQuery = { sprintTaskStatuses: Array<{ sprintId: string, taskId: string, statusId: string | null, closed: boolean }> };

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

export type TransferDashboardChartMutationVariables = Exact<{
  id: string | number;
  dashboardId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
}>;


export type TransferDashboardChartMutation = { transferDashboardChart: string };

export type DeleteDashboardChartMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteDashboardChartMutation = { deleteDashboardChart: boolean };

export type MoveDashboardChartMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveDashboardChartMutation = { moveDashboardChart: boolean };

export type PlacesQueryVariables = Exact<{ [key: string]: never; }>;


export type PlacesQuery = { places: Array<{ id: string, name: string, address: string, lat: number, lon: number }> };

export type SearchAddressesQueryVariables = Exact<{
  text: string;
  near?: GeoPointInput | null | undefined;
}>;


export type SearchAddressesQuery = { searchAddresses: Array<{ label: string, name: string | null, lat: number, lon: number }> };

export type ReverseAddressQueryVariables = Exact<{
  point: GeoPointInput;
}>;


export type ReverseAddressQuery = { reverseAddress: { label: string, name: string | null, lat: number, lon: number } | null };

export type TravelTimeQueryVariables = Exact<{
  from: GeoPointInput;
  to: GeoPointInput;
  mode: TravelMode;
}>;


export type TravelTimeQuery = { travelTime: { seconds: number, meters: number } };

export type SavePlaceMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: PlaceInput;
}>;


export type SavePlaceMutation = { savePlace: string };

export type DeletePlaceMutationVariables = Exact<{
  id: string | number;
}>;


export type DeletePlaceMutation = { deletePlace: boolean };

export type GithubLoginQueryVariables = Exact<{ [key: string]: never; }>;


export type GithubLoginQuery = { githubLogin: string | null };

export type GithubContributorsQueryVariables = Exact<{ [key: string]: never; }>;


export type GithubContributorsQuery = { githubContributors: Array<{ id: string, name: string, githubLogin: string | null }> };

export type GithubBoardQueryVariables = Exact<{
  url: string;
}>;


export type GithubBoardQuery = { githubBoard: { id: string, title: string, url: string, fields: Array<{ id: string, name: string, dataType: string, iterationCount: number, options: Array<{ id: string, name: string }> }> } };

export type GithubProjectLinkQueryVariables = Exact<{
  projectId: string | number;
}>;


export type GithubProjectLinkQuery = { githubProjectLink: { id: string, projectId: string, url: string, title: string, statusFieldId: string | null, priorityFieldId: string | null, iterationFieldId: string | null, startFieldId: string | null, endFieldId: string | null, effortFieldId: string | null, statusOptions: unknown, priorityOptions: unknown, repositoryName: string | null, pushExisting: boolean, enabled: boolean, lastSyncAt: string | null, lastSyncError: string | null, lastSyncSummary: unknown, linkedTaskCount: number } | null };

export type SetGithubTokenMutationVariables = Exact<{
  token: string;
}>;


export type SetGithubTokenMutation = { setGithubToken: string };

export type RemoveGithubTokenMutationVariables = Exact<{ [key: string]: never; }>;


export type RemoveGithubTokenMutation = { removeGithubToken: boolean };

export type SaveGithubLinkMutationVariables = Exact<{
  projectId: string | number;
  input: GithubLinkInput;
}>;


export type SaveGithubLinkMutation = { saveGithubLink: boolean };

export type UnlinkGithubProjectMutationVariables = Exact<{
  projectId: string | number;
}>;


export type UnlinkGithubProjectMutation = { unlinkGithubProject: boolean };

export type SyncGithubProjectMutationVariables = Exact<{
  projectId: string | number;
}>;


export type SyncGithubProjectMutation = { syncGithubProject: { pulledNew: number, pushedNew: number, pulled: number, pushed: number, unlinked: number, sprints: number, comments: number } };

export type SetContributorGithubLoginMutationVariables = Exact<{
  id: string | number;
  login?: string | null | undefined;
}>;


export type SetContributorGithubLoginMutation = { setContributorGithubLogin: boolean };

export type LibraryQueryVariables = Exact<{ [key: string]: never; }>;


export type LibraryQuery = { documentFolders: Array<{ id: string, name: string, parentId: string | null }>, libraryDocuments: Array<{ id: string, folderId: string | null, kind: string, title: string, note: string | null, url: string, fileName: string | null, mimeType: string | null, size: number | null, updatedAt: string }> };

export type CreateDocumentFolderMutationVariables = Exact<{
  name: string;
  parentId?: string | number | null | undefined;
}>;


export type CreateDocumentFolderMutation = { createDocumentFolder: string };

export type RenameDocumentFolderMutationVariables = Exact<{
  id: string | number;
  name: string;
}>;


export type RenameDocumentFolderMutation = { renameDocumentFolder: boolean };

export type MoveDocumentFolderMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
}>;


export type MoveDocumentFolderMutation = { moveDocumentFolder: boolean };

export type DeleteDocumentFolderMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteDocumentFolderMutation = { deleteDocumentFolder: boolean };

export type AddLibraryFilesMutationVariables = Exact<{
  folderId?: string | number | null | undefined;
  files: Array<File> | File;
}>;


export type AddLibraryFilesMutation = { addLibraryFiles: Array<string> };

export type AddLibraryLinkMutationVariables = Exact<{
  folderId?: string | number | null | undefined;
  title: string;
  url: string;
  note?: string | null | undefined;
}>;


export type AddLibraryLinkMutation = { addLibraryLink: string };

export type UpdateLibraryDocumentMutationVariables = Exact<{
  id: string | number;
  title: string;
  url?: string | null | undefined;
  note?: string | null | undefined;
  file?: File | null | undefined;
}>;


export type UpdateLibraryDocumentMutation = { updateLibraryDocument: boolean };

export type MoveLibraryDocumentsMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  folderId?: string | number | null | undefined;
}>;


export type MoveLibraryDocumentsMutation = { moveLibraryDocuments: boolean };

export type DeleteLibraryDocumentsMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
}>;


export type DeleteLibraryDocumentsMutation = { deleteLibraryDocuments: boolean };

export type WatchedMailAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type WatchedMailAccountsQuery = { mailAccounts: Array<{ id: string }> };

export type WatchedUnreadMailsQueryVariables = Exact<{
  accountId: string | number;
}>;


export type WatchedUnreadMailsQuery = { mailMessages: { messages: Array<{ uid: number, subject: string, from: Array<{ name: string | null, address: string }> }> } };

export type MailAccountFieldsFragment = { id: string, name: string, email: string, displayName: string | null, imapHost: string, imapPort: number, imapSecure: boolean, imapUser: string, smtpHost: string, smtpPort: number, smtpSecure: boolean, smtpUser: string, saveSent: boolean, signature: string | null };

export type MailViewFieldsFragment = { accountId: string, folder: string, uid: number, labelIds: Array<string>, done: boolean, messageId: string | null, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, linkedProjectIds: Array<string>, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, replyTo: Array<{ name: string | null, address: string }>, attachments: Array<{ index: number, filename: string, contentType: string, size: number, inline: boolean }> };

export type LinkedMailFieldsFragment = { id: string, projectId: string, accountId: string | null, messageId: string, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, sent: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, attachments: Array<{ id: string, name: string, size: number, inline: boolean, url: string }> };

export type MailAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type MailAccountsQuery = { mailAccounts: Array<{ id: string, name: string, email: string, displayName: string | null, imapHost: string, imapPort: number, imapSecure: boolean, imapUser: string, smtpHost: string, smtpPort: number, smtpSecure: boolean, smtpUser: string, saveSent: boolean, signature: string | null }> };

export type MailFoldersQueryVariables = Exact<{
  accountId: string | number;
}>;


export type MailFoldersQuery = { mailFolders: Array<{ path: string, name: string, specialUse: string | null, unseen: number, depth: number, parent: string | null, todo: number | null }> };

export type MailMessagesQueryVariables = Exact<{
  accountId: string | number;
  folder: string;
  page: number;
  search?: string | null | undefined;
  unread?: boolean | null | undefined;
  state?: string | null | undefined;
  sort?: string | null | undefined;
  ascending?: boolean | null | undefined;
}>;


export type MailMessagesQuery = { mailMessages: { total: number, pageSize: number, messages: Array<{ uid: number, subject: string, date: string, seen: boolean, flagged: boolean, hasAttachments: boolean, labelIds: Array<string>, done: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }> }> } };

export type MailMessageQueryVariables = Exact<{
  accountId: string | number;
  folder: string;
  uid: number;
}>;


export type MailMessageQuery = { mailMessage: { accountId: string, folder: string, uid: number, labelIds: Array<string>, done: boolean, messageId: string | null, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, linkedProjectIds: Array<string>, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, replyTo: Array<{ name: string | null, address: string }>, attachments: Array<{ index: number, filename: string, contentType: string, size: number, inline: boolean }> } };

export type UnreadMailCountQueryVariables = Exact<{ [key: string]: never; }>;


export type UnreadMailCountQuery = { unreadMailCount: number };

export type TodoMailCountQueryVariables = Exact<{ [key: string]: never; }>;


export type TodoMailCountQuery = { todoMailCount: number };

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

export type MailLabelsQueryVariables = Exact<{ [key: string]: never; }>;


export type MailLabelsQuery = { mailLabels: Array<{ id: string, name: string, color: string, position: number }> };

export type ScheduledMailsQueryVariables = Exact<{ [key: string]: never; }>;


export type ScheduledMailsQuery = { scheduledMails: Array<{ id: string, accountId: string, sendAt: string, subject: string, to: Array<string>, status: string, error: string | null }> };

export type MarkMailsMutationVariables = Exact<{
  accountId: string | number;
  folder: string;
  uids: Array<number> | number;
  labelId?: string | number | null | undefined;
  on?: boolean | null | undefined;
  done?: boolean | null | undefined;
}>;


export type MarkMailsMutation = { markMails: boolean };

export type ReportMailSpamMutationVariables = Exact<{
  accountId: string | number;
  folder: string;
  uids: Array<number> | number;
  spam: boolean;
}>;


export type ReportMailSpamMutation = { reportMailSpam: string };

export type MoveMailsMutationVariables = Exact<{
  accountId: string | number;
  folder: string;
  uids: Array<number> | number;
  target: string;
}>;


export type MoveMailsMutation = { moveMails: boolean };

export type CreateMailFolderMutationVariables = Exact<{
  accountId: string | number;
  parent?: string | null | undefined;
  name: string;
}>;


export type CreateMailFolderMutation = { createMailFolder: string };

export type RenameMailFolderMutationVariables = Exact<{
  accountId: string | number;
  path: string;
  name: string;
}>;


export type RenameMailFolderMutation = { renameMailFolder: string };

export type DeleteMailFolderMutationVariables = Exact<{
  accountId: string | number;
  path: string;
}>;


export type DeleteMailFolderMutation = { deleteMailFolder: boolean };

export type CreateMailLabelMutationVariables = Exact<{
  name: string;
  color: string;
}>;


export type CreateMailLabelMutation = { createMailLabel: string };

export type UpdateMailLabelMutationVariables = Exact<{
  id: string | number;
  name: string;
  color: string;
}>;


export type UpdateMailLabelMutation = { updateMailLabel: boolean };

export type DeleteMailLabelMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteMailLabelMutation = { deleteMailLabel: boolean };

export type ScheduleMailMutationVariables = Exact<{
  input: SendMailInput;
  sendAt: string;
}>;


export type ScheduleMailMutation = { scheduleMail: string };

export type SendScheduledMailMutationVariables = Exact<{
  id: string | number;
}>;


export type SendScheduledMailMutation = { sendScheduledMail: boolean };

export type CancelScheduledMailMutationVariables = Exact<{
  id: string | number;
}>;


export type CancelScheduledMailMutation = { cancelScheduledMail: boolean };

export type MailSearchesQueryVariables = Exact<{ [key: string]: never; }>;


export type MailSearchesQuery = { mailSearches: Array<{ id: string, name: string, criteria: unknown, position: number }> };

export type MailSearchResultsQueryVariables = Exact<{
  id: string | number;
  page: number;
}>;


export type MailSearchResultsQuery = { mailSearchResults: { total: number, pageSize: number, messages: Array<{ accountId: string, folder: string, folderName: string, uid: number, subject: string, date: string, seen: boolean, flagged: boolean, hasAttachments: boolean, labelIds: Array<string>, done: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }> }> } };

export type MailAdvancedSearchQueryVariables = Exact<{
  criteria: unknown;
  page: number;
}>;


export type MailAdvancedSearchQuery = { mailAdvancedSearch: { total: number, pageSize: number, messages: Array<{ accountId: string, folder: string, folderName: string, uid: number, subject: string, date: string, seen: boolean, flagged: boolean, hasAttachments: boolean, labelIds: Array<string>, done: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }> }> } };

export type MoveMailFolderMutationVariables = Exact<{
  accountId: string | number;
  path: string;
  parent?: string | null | undefined;
}>;


export type MoveMailFolderMutation = { moveMailFolder: string };

export type CreateMailSearchMutationVariables = Exact<{
  input: MailSearchInput;
}>;


export type CreateMailSearchMutation = { createMailSearch: string };

export type UpdateMailSearchMutationVariables = Exact<{
  id: string | number;
  input: MailSearchInput;
}>;


export type UpdateMailSearchMutation = { updateMailSearch: boolean };

export type DeleteMailSearchMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteMailSearchMutation = { deleteMailSearch: boolean };

export type ContributorFieldsFragment = { id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string> };

export type SprintFieldsFragment = { id: string, projectId: string, name: string, goal: string | null, startDate: string, endDate: string };

export type MilestoneFieldsFragment = { id: string, projectId: string, title: string, description: string | null, dueDate: string | null, position: number };

export type TaskLabelFieldsFragment = { id: string, name: string, color: string, position: number };

export type TaskFieldsFragment = { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null };

export type TaskCommentFieldsFragment = { id: string, body: string, createdAt: string, githubAuthor: string | null };

export type TasksDataQueryVariables = Exact<{ [key: string]: never; }>;


export type TasksDataQuery = { tasks: Array<{ id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null }>, contributors: Array<{ id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string> }>, taskStatuses: Array<{ category: TaskStatusCategory, id: string, name: string, color: string, position: number }>, taskPriorities: Array<{ id: string, name: string, color: string, position: number }>, taskTypes: Array<{ id: string, name: string, color: string, position: number }>, taskTags: Array<{ id: string, name: string, color: string, position: number }>, milestones: Array<{ id: string, projectId: string, title: string, description: string | null, dueDate: string | null, position: number }>, sprints: Array<{ id: string, projectId: string, name: string, goal: string | null, startDate: string, endDate: string }> };

export type TaskCommentsQueryVariables = Exact<{
  id: string | number;
}>;


export type TaskCommentsQuery = { task: { id: string, comments: Array<{ id: string, body: string, createdAt: string, githubAuthor: string | null }> } | null };

export type CreateTaskMutationVariables = Exact<{
  input: TaskInput;
}>;


export type CreateTaskMutation = { createTask: { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null } };

export type UpdateTaskMutationVariables = Exact<{
  id: string | number;
  input: TaskUpdateInput;
}>;


export type UpdateTaskMutation = { updateTask: { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean, closedAt: string | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null } };

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


export type AddTaskCommentMutation = { addTaskComment: { id: string, body: string, createdAt: string, githubAuthor: string | null } };

export type UpdateTaskCommentMutationVariables = Exact<{
  id: string | number;
  body: string;
}>;


export type UpdateTaskCommentMutation = { updateTaskComment: { id: string, body: string, createdAt: string, githubAuthor: string | null } };

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

export type CreateTaskTagMutationVariables = Exact<{
  input: TaskLabelInput;
}>;


export type CreateTaskTagMutation = { createTaskTag: { id: string } };

export type UpdateTaskTagMutationVariables = Exact<{
  id: string | number;
  input: TaskLabelUpdateInput;
}>;


export type UpdateTaskTagMutation = { updateTaskTag: { id: string } };

export type DeleteTaskTagMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTaskTagMutation = { deleteTaskTag: boolean };

export type MoveTaskTagMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveTaskTagMutation = { moveTaskTag: boolean };

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

export type MatchingTaskIdsBySprintQueryVariables = Exact<{
  query: TaskQueryInput;
}>;


export type MatchingTaskIdsBySprintQuery = { matchingTaskIdsBySprint: Array<{ sprintId: string, taskIds: Array<string> }> };

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

export type TimeEntryFieldsFragment = { id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null, calendarEventId: string | null, calendarOccurrenceDate: string | null, calendarEventTitle: string | null };

export type TimeEntriesQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
  since?: string | null | undefined;
}>;


export type TimeEntriesQuery = { timeEntries: Array<{ id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null, calendarEventId: string | null, calendarOccurrenceDate: string | null, calendarEventTitle: string | null }> };

export type RunningTimeEntryQueryVariables = Exact<{ [key: string]: never; }>;


export type RunningTimeEntryQuery = { runningTimeEntry: { id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null, calendarEventId: string | null, calendarOccurrenceDate: string | null, calendarEventTitle: string | null } | null };

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

export type TreasuryEntryFieldsFragment = { id: string, accountId: string, accountName: string, status: TreasuryEntryStatus, date: string, valueDate: string, label: string, amount: number, categoryId: string | null, methodId: string | null, methodName: string | null, clientId: string | null, counterpartyId: string | null, payerName: string | null, projectId: string | null, note: string | null, recurrence: unknown, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }>, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number, memberId: string | null, relationId: string | null, loan: boolean, date: string | null, categoryId: string | null, contextId: string | null, projectId: string | null, documents: Array<{ id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string }>, linkedLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }> }>, linkedByLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }>, documents: Array<{ id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string }> };

export type TreasuryEntryDocumentFieldsFragment = { id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string };

export type TreasuryDocumentOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type TreasuryDocumentOptionsQuery = { treasuryDocumentOptions: Array<{ id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string }> };

export type TreasuryAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type TreasuryAccountsQuery = { treasuryAccounts: Array<{ id: string, name: string, openingBalance: number, openingDate: string, archived: boolean, csvMapping: unknown, entryCount: number, balance: number }> };

export type TreasuryEntriesQueryVariables = Exact<{
  from: string;
  to: string;
  accountId?: string | number | null | undefined;
}>;


export type TreasuryEntriesQuery = { treasuryEntries: Array<{ id: string, accountId: string, accountName: string, status: TreasuryEntryStatus, date: string, valueDate: string, label: string, amount: number, categoryId: string | null, methodId: string | null, methodName: string | null, clientId: string | null, counterpartyId: string | null, payerName: string | null, projectId: string | null, note: string | null, recurrence: unknown, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }>, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number, memberId: string | null, relationId: string | null, loan: boolean, date: string | null, categoryId: string | null, contextId: string | null, projectId: string | null, documents: Array<{ id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string }>, linkedLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }> }>, linkedByLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }>, documents: Array<{ id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string }> }> };

export type ForecastEntriesQueryVariables = Exact<{ [key: string]: never; }>;


export type ForecastEntriesQuery = { forecastEntries: Array<{ id: string, accountId: string, accountName: string, status: TreasuryEntryStatus, date: string, valueDate: string, label: string, amount: number, categoryId: string | null, methodId: string | null, methodName: string | null, clientId: string | null, counterpartyId: string | null, payerName: string | null, projectId: string | null, note: string | null, recurrence: unknown, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }>, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number, memberId: string | null, relationId: string | null, loan: boolean, date: string | null, categoryId: string | null, contextId: string | null, projectId: string | null, documents: Array<{ id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string }>, linkedLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }> }>, linkedByLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }>, documents: Array<{ id: string, source: string, kind: string, title: string, url: string, projectId: string | null, place: string }> }> };

export type TreasuryProjectionQueryVariables = Exact<{
  today: string;
  from: string;
  until: string;
}>;


export type TreasuryProjectionQuery = { treasuryProjection: { balance: number, series: Array<{ date: string, balance: number, forecast: boolean }>, items: Array<{ date: string, dueDate: string, label: string, payerName: string | null, amount: number, kind: string, overdue: boolean, entryId: string | null, documentId: string | null, importedDocumentId: string | null, recurringInvoiceId: string | null, accountId: string | null }> } };

export type TreasurySettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type TreasurySettingsQuery = { treasuryCategories: Array<{ id: string, name: string, direction: TreasuryDirection, parentId: string | null, entryCount: number }>, treasuryPaymentMethods: Array<{ id: string, name: string, incoming: boolean, outgoing: boolean, entryCount: number }>, treasuryCounterparties: Array<{ id: string, name: string, note: string | null, archived: boolean, entryCount: number }>, treasuryMembers: Array<{ id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean }>, treasuryContexts: Array<{ id: string, name: string, color: string, position: number }>, treasuryRelations: Array<{ id: string, name: string, note: string | null, contributorId: string | null, lineCount: number, budgetCount: number }>, treasuryContextPeriods: Array<{ id: string, contextId: string, startDate: string, endDate: string, note: string | null }> };

export type TreasuryEntrySearchQueryVariables = Exact<{
  text: string;
}>;


export type TreasuryEntrySearchQuery = { treasuryEntrySearch: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus, accountName: string, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number }> }> };

export type CreateTreasuryCategoryMutationVariables = Exact<{
  input: TreasuryCategoryInput;
}>;


export type CreateTreasuryCategoryMutation = { createTreasuryCategory: string };

export type UpdateTreasuryCategoryMutationVariables = Exact<{
  id: string | number;
  input: TreasuryCategoryInput;
}>;


export type UpdateTreasuryCategoryMutation = { updateTreasuryCategory: boolean };

export type DeleteTreasuryCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryCategoryMutation = { deleteTreasuryCategory: boolean };

export type CreateTreasuryPaymentMethodMutationVariables = Exact<{
  input: TreasuryPaymentMethodInput;
}>;


export type CreateTreasuryPaymentMethodMutation = { createTreasuryPaymentMethod: string };

export type UpdateTreasuryPaymentMethodMutationVariables = Exact<{
  id: string | number;
  input: TreasuryPaymentMethodInput;
}>;


export type UpdateTreasuryPaymentMethodMutation = { updateTreasuryPaymentMethod: boolean };

export type DeleteTreasuryPaymentMethodMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryPaymentMethodMutation = { deleteTreasuryPaymentMethod: boolean };

export type CreateTreasuryCounterpartyMutationVariables = Exact<{
  input: TreasuryCounterpartyInput;
}>;


export type CreateTreasuryCounterpartyMutation = { createTreasuryCounterparty: string };

export type UpdateTreasuryCounterpartyMutationVariables = Exact<{
  id: string | number;
  input: TreasuryCounterpartyInput;
}>;


export type UpdateTreasuryCounterpartyMutation = { updateTreasuryCounterparty: boolean };

export type DeleteTreasuryCounterpartyMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryCounterpartyMutation = { deleteTreasuryCounterparty: boolean };

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

export type AddTreasuryMemberMutationVariables = Exact<{
  contributorId?: string | number | null | undefined;
  name?: string | null | undefined;
}>;


export type AddTreasuryMemberMutation = { addTreasuryMember: string };

export type RemoveTreasuryMemberMutationVariables = Exact<{
  contributorId: string | number;
}>;


export type RemoveTreasuryMemberMutation = { removeTreasuryMember: boolean };

export type SaveTreasuryRelationMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: TreasuryRelationInput;
}>;


export type SaveTreasuryRelationMutation = { saveTreasuryRelation: string };

export type DeleteTreasuryRelationMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryRelationMutation = { deleteTreasuryRelation: boolean };

export type SaveTreasuryContextMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: TreasuryContextInput;
}>;


export type SaveTreasuryContextMutation = { saveTreasuryContext: string };

export type DeleteTreasuryContextMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryContextMutation = { deleteTreasuryContext: boolean };

export type SaveTreasuryContextPeriodMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: TreasuryContextPeriodInput;
}>;


export type SaveTreasuryContextPeriodMutation = { saveTreasuryContextPeriod: string };

export type DeleteTreasuryContextPeriodMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryContextPeriodMutation = { deleteTreasuryContextPeriod: boolean };

export type TreasuryBudgetsQueryVariables = Exact<{
  from: string;
  to: string;
}>;


export type TreasuryBudgetsQuery = { treasuryBudgets: Array<{ id: string, month: string, memberId: string | null, relationId: string | null, contextId: string | null, categoryId: string, amount: number, repeatEvery: number | null, repeatUntil: string | null }>, treasuryBudgetReport: Array<{ month: string, memberId: string | null, relationId: string | null, contextId: string | null, categoryId: string | null, budget: number, actual: number, forecast: number, budgeted: boolean }> };

export type SaveTreasuryBudgetMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: TreasuryBudgetInput;
}>;


export type SaveTreasuryBudgetMutation = { saveTreasuryBudget: string };

export type DeleteTreasuryBudgetMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTreasuryBudgetMutation = { deleteTreasuryBudget: boolean };

export type TreasuryLoansQueryVariables = Exact<{ [key: string]: never; }>;


export type TreasuryLoansQuery = { treasuryLoans: Array<{ relationId: string, balance: number, out: number, in: number, items: Array<{ lineId: string, entryId: string, date: string, label: string, amount: number }> }> };

export type ImportTreasuryStatementMutationVariables = Exact<{
  accountId: string | number;
  mapping?: unknown;
  rows: Array<TreasuryStatementRowInput> | TreasuryStatementRowInput;
}>;


export type ImportTreasuryStatementMutation = { importTreasuryStatement: unknown };

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

export type ElsewhereAlarmsQueryVariables = Exact<{ [key: string]: never; }>;


export type ElsewhereAlarmsQuery = { alarms: Array<{ id: string, title: string, note: string | null, type: AlarmType, startDate: string | null, time: string | null, frequency: AlarmFrequency, interval: number, weekdays: Array<number>, endDate: string | null, minutes: number | null, projectId: string | null, taskId: string | null, enabled: boolean, lastFiredAt: string | null, createdAt: string, task: { id: string, number: number, title: string, projectId: string } | null, project: { id: string, title: string } | null }>, runningTimeEntry: { id: string, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null } | null };

export type ElsewhereMarkAlarmFiredMutationVariables = Exact<{
  id: string | number;
  at: string;
}>;


export type ElsewhereMarkAlarmFiredMutation = { markAlarmFired: boolean };

export type WorkspacesQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkspacesQuery = { currentWorkspaceId: string, workspaces: Array<{ id: string, name: string, kind: WorkspaceKind, position: number, notifyElsewhere: Array<NotificationSource> }> };

export type CreateWorkspaceMutationVariables = Exact<{
  input: WorkspaceInput;
}>;


export type CreateWorkspaceMutation = { createWorkspace: { id: string } };

export type UpdateWorkspaceMutationVariables = Exact<{
  id: string | number;
  input: WorkspaceInput;
}>;


export type UpdateWorkspaceMutation = { updateWorkspace: { id: string } };

export type SetWorkspaceNotificationsMutationVariables = Exact<{
  id: string | number;
  sources: Array<NotificationSource> | NotificationSource;
}>;


export type SetWorkspaceNotificationsMutation = { setWorkspaceNotifications: { id: string } };

export type MoveWorkspaceMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveWorkspaceMutation = { moveWorkspace: boolean };

export type DeleteWorkspaceMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteWorkspaceMutation = { deleteWorkspace: boolean };

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
  contact
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
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
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
  importedSourceId
  importedSourceNumber
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
  sentVia
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
      methodName
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
    deductedDocumentId
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
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
}`, {"fragmentName":"AccountingDocumentFields"}) as unknown as TypedDocumentString<AccountingDocumentFieldsFragment, unknown>;
export const ImportedDocumentFieldsFragmentDoc = new TypedDocumentString(`
    fragment ImportedDocumentFields on ImportedDocument {
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
  trackingStatus {
    id
    name
    color
    category
  }
  fileMimeType
}
    `, {"fragmentName":"ImportedDocumentFields"}) as unknown as TypedDocumentString<ImportedDocumentFieldsFragment, unknown>;
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
  travelBefore
  travelAfter
  projectId
  calendarId
  contributorIds
  relationIds
  categoryIds
  taskIds
  calledOff
  postponedFrom {
    eventId
    date
    title
  }
  postponedTo {
    eventId
    title
    startDate
    startTime
  }
  trackedSeconds
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
  labelIds
  done
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
  sprintIds
  deadline
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  tagIds
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
  githubLinked
  githubUrl
  githubNumber
}
    `, {"fragmentName":"TaskFields"}) as unknown as TypedDocumentString<TaskFieldsFragment, unknown>;
export const TaskCommentFieldsFragmentDoc = new TypedDocumentString(`
    fragment TaskCommentFields on TaskComment {
  id
  body
  createdAt
  githubAuthor
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
  calendarEventId
  calendarOccurrenceDate
  calendarEventTitle
}
    `, {"fragmentName":"TimeEntryFields"}) as unknown as TypedDocumentString<TimeEntryFieldsFragment, unknown>;
export const TreasuryEntryDocumentFieldsFragmentDoc = new TypedDocumentString(`
    fragment TreasuryEntryDocumentFields on TreasuryEntryDocument {
  id
  source
  kind
  title
  url
  projectId
  place
}
    `, {"fragmentName":"TreasuryEntryDocumentFields"}) as unknown as TypedDocumentString<TreasuryEntryDocumentFieldsFragment, unknown>;
export const TreasuryEntryFieldsFragmentDoc = new TypedDocumentString(`
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
    fragment TreasuryEntryDocumentFields on TreasuryEntryDocument {
  id
  source
  kind
  title
  url
  projectId
  place
}`, {"fragmentName":"TreasuryEntryFields"}) as unknown as TypedDocumentString<TreasuryEntryFieldsFragment, unknown>;
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
  contact
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
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
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
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
}
fragment AccountingDocumentFields on AccountingDocument {
  ...AccountingDocumentListFields
  serviceStart
  serviceEnd
  serviceId
  contactId
  sourceId
  importedSourceId
  importedSourceNumber
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
  sentVia
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
      methodName
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
    deductedDocumentId
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
export const DeductibleDepositsDocument = new TypedDocumentString(`
    query DeductibleDeposits($clientId: ID!, $documentId: ID) {
  deductibleDeposits(clientId: $clientId, documentId: $documentId) {
    id
    number
    issueDate
    totalGross
    remaining {
      rate
      amount
    }
  }
}
    `) as unknown as TypedDocumentString<DeductibleDepositsQuery, DeductibleDepositsQueryVariables>;
export const LatestDocumentDateDocument = new TypedDocumentString(`
    query LatestDocumentDate($type: AccountingDocumentType!, $documentId: ID) {
  latestDocumentDate(type: $type, documentId: $documentId)
}
    `) as unknown as TypedDocumentString<LatestDocumentDateQuery, LatestDocumentDateQueryVariables>;
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
export const CreateDepositInvoiceDocument = new TypedDocumentString(`
    mutation CreateDepositInvoice($quoteId: ID, $importedQuoteId: ID, $percent: Float!, $issueDate: Date!) {
  createDepositInvoice(
    quoteId: $quoteId
    importedQuoteId: $importedQuoteId
    percent: $percent
    issueDate: $issueDate
  )
}
    `) as unknown as TypedDocumentString<CreateDepositInvoiceMutation, CreateDepositInvoiceMutationVariables>;
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
    ...ImportedDocumentFields
  }
}
    fragment ImportedDocumentFields on ImportedDocument {
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
  trackingStatus {
    id
    name
    color
    category
  }
  fileMimeType
}`) as unknown as TypedDocumentString<ImportedDocumentsQuery, ImportedDocumentsQueryVariables>;
export const ImportedDocumentDocument = new TypedDocumentString(`
    query ImportedDocument($id: ID!) {
  importedDocument(id: $id) {
    ...ImportedDocumentFields
  }
}
    fragment ImportedDocumentFields on ImportedDocument {
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
  trackingStatus {
    id
    name
    color
    category
  }
  fileMimeType
}`) as unknown as TypedDocumentString<ImportedDocumentQuery, ImportedDocumentQueryVariables>;
export const SetImportedDocumentTrackingStatusDocument = new TypedDocumentString(`
    mutation SetImportedDocumentTrackingStatus($id: ID!, $statusId: ID) {
  setImportedDocumentTrackingStatus(id: $id, statusId: $statusId)
}
    `) as unknown as TypedDocumentString<SetImportedDocumentTrackingStatusMutation, SetImportedDocumentTrackingStatusMutationVariables>;
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
    mutation MarkDocumentSent($id: ID!, $date: Date, $via: String) {
  markDocumentSent(id: $id, date: $date, via: $via)
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
export const WorkSchedulesDocument = new TypedDocumentString(`
    query WorkSchedules {
  workSchedules {
    id
    name
    startDate
    endDate
    typeId
    cases
    exceptions
  }
  scheduleTypes {
    id
    name
    color
    dayDisplay
    dayBar
    monthDisplay
    position
  }
  defaultScheduleKind {
    name
    color
    dayDisplay
    dayBar
    monthDisplay
  }
}
    `) as unknown as TypedDocumentString<WorkSchedulesQuery, WorkSchedulesQueryVariables>;
export const ForeignScheduleKindsDocument = new TypedDocumentString(`
    query ForeignScheduleKinds {
  foreignScheduleKinds {
    workspaceId
    workspaceName
    typeId
    name
    color
    sourceColor
    dayDisplay
    dayBar
    monthDisplay
    customized
    scheduleCount
    subscribed
  }
}
    `) as unknown as TypedDocumentString<ForeignScheduleKindsQuery, ForeignScheduleKindsQueryVariables>;
export const SubscribedWorkSchedulesDocument = new TypedDocumentString(`
    query SubscribedWorkSchedules {
  subscribedWorkSchedules {
    id
    name
    startDate
    endDate
    cases
    exceptions
    typeName
    color
    dayDisplay
    dayBar
    monthDisplay
    workspaceId
    workspaceName
  }
}
    `) as unknown as TypedDocumentString<SubscribedWorkSchedulesQuery, SubscribedWorkSchedulesQueryVariables>;
export const SaveScheduleTypeDocument = new TypedDocumentString(`
    mutation SaveScheduleType($id: ID, $input: ScheduleTypeInput!) {
  saveScheduleType(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SaveScheduleTypeMutation, SaveScheduleTypeMutationVariables>;
export const DeleteScheduleTypeDocument = new TypedDocumentString(`
    mutation DeleteScheduleType($id: ID!) {
  deleteScheduleType(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteScheduleTypeMutation, DeleteScheduleTypeMutationVariables>;
export const SubscribeScheduleKindDocument = new TypedDocumentString(`
    mutation SubscribeScheduleKind($workspaceId: ID!, $typeId: ID) {
  subscribeScheduleKind(workspaceId: $workspaceId, typeId: $typeId)
}
    `) as unknown as TypedDocumentString<SubscribeScheduleKindMutation, SubscribeScheduleKindMutationVariables>;
export const SaveDefaultScheduleKindDocument = new TypedDocumentString(`
    mutation SaveDefaultScheduleKind($input: DefaultScheduleKindInput!) {
  saveDefaultScheduleKind(input: $input) {
    name
  }
}
    `) as unknown as TypedDocumentString<SaveDefaultScheduleKindMutation, SaveDefaultScheduleKindMutationVariables>;
export const SetScheduleSubscriptionLookDocument = new TypedDocumentString(`
    mutation SetScheduleSubscriptionLook($workspaceId: ID!, $typeId: ID, $input: ScheduleSubscriptionLookInput!) {
  setScheduleSubscriptionLook(
    workspaceId: $workspaceId
    typeId: $typeId
    input: $input
  )
}
    `) as unknown as TypedDocumentString<SetScheduleSubscriptionLookMutation, SetScheduleSubscriptionLookMutationVariables>;
export const UnsubscribeScheduleKindDocument = new TypedDocumentString(`
    mutation UnsubscribeScheduleKind($workspaceId: ID!, $typeId: ID) {
  unsubscribeScheduleKind(workspaceId: $workspaceId, typeId: $typeId)
}
    `) as unknown as TypedDocumentString<UnsubscribeScheduleKindMutation, UnsubscribeScheduleKindMutationVariables>;
export const CreateWorkScheduleDocument = new TypedDocumentString(`
    mutation CreateWorkSchedule($input: WorkScheduleInput!) {
  createWorkSchedule(input: $input)
}
    `) as unknown as TypedDocumentString<CreateWorkScheduleMutation, CreateWorkScheduleMutationVariables>;
export const UpdateWorkScheduleDocument = new TypedDocumentString(`
    mutation UpdateWorkSchedule($id: ID!, $input: WorkScheduleInput!) {
  updateWorkSchedule(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateWorkScheduleMutation, UpdateWorkScheduleMutationVariables>;
export const DeleteWorkScheduleDocument = new TypedDocumentString(`
    mutation DeleteWorkSchedule($id: ID!) {
  deleteWorkSchedule(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteWorkScheduleMutation, DeleteWorkScheduleMutationVariables>;
export const SetCalendarEventCalledOffDocument = new TypedDocumentString(`
    mutation SetCalendarEventCalledOff($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date, $calledOff: Boolean!) {
  setCalendarEventCalledOff(
    id: $id
    scope: $scope
    occurrenceDate: $occurrenceDate
    calledOff: $calledOff
  )
}
    `) as unknown as TypedDocumentString<SetCalendarEventCalledOffMutation, SetCalendarEventCalledOffMutationVariables>;
export const PostponeCalendarEventDocument = new TypedDocumentString(`
    mutation PostponeCalendarEvent($id: ID!, $occurrenceDate: Date, $input: CalendarEventInput!) {
  postponeCalendarEvent(id: $id, occurrenceDate: $occurrenceDate, input: $input)
}
    `) as unknown as TypedDocumentString<PostponeCalendarEventMutation, PostponeCalendarEventMutationVariables>;
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
  travelBefore
  travelAfter
  projectId
  calendarId
  contributorIds
  relationIds
  categoryIds
  taskIds
  calledOff
  postponedFrom {
    eventId
    date
    title
  }
  postponedTo {
    eventId
    title
    startDate
    startTime
  }
  trackedSeconds
}`) as unknown as TypedDocumentString<CalendarEventsQuery, CalendarEventsQueryVariables>;
export const CalendarsDocument = new TypedDocumentString(`
    query Calendars {
  calendars {
    id
    name
    color
    position
  }
  calendarSubscriptions {
    id
    calendarId
    name
    color
    workspace {
      id
      name
      kind
    }
  }
}
    `) as unknown as TypedDocumentString<CalendarsQuery, CalendarsQueryVariables>;
export const SubscribableCalendarsDocument = new TypedDocumentString(`
    query SubscribableCalendars {
  subscribableCalendars {
    id
    name
    color
    subscribed
    workspace {
      id
      name
      kind
    }
  }
}
    `) as unknown as TypedDocumentString<SubscribableCalendarsQuery, SubscribableCalendarsQueryVariables>;
export const SubscribedCalendarEventsDocument = new TypedDocumentString(`
    query SubscribedCalendarEvents($from: Date!, $to: Date!) {
  subscribedCalendarEvents(from: $from, to: $to) {
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
  travelBefore
  travelAfter
  projectId
  calendarId
  contributorIds
  relationIds
  categoryIds
  taskIds
  calledOff
  postponedFrom {
    eventId
    date
    title
  }
  postponedTo {
    eventId
    title
    startDate
    startTime
  }
  trackedSeconds
}`) as unknown as TypedDocumentString<SubscribedCalendarEventsQuery, SubscribedCalendarEventsQueryVariables>;
export const CreateCalendarDocument = new TypedDocumentString(`
    mutation CreateCalendar($input: CalendarInput!) {
  createCalendar(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateCalendarMutation, CreateCalendarMutationVariables>;
export const UpdateCalendarDocument = new TypedDocumentString(`
    mutation UpdateCalendar($id: ID!, $input: CalendarInput!) {
  updateCalendar(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateCalendarMutation, UpdateCalendarMutationVariables>;
export const MoveCalendarDocument = new TypedDocumentString(`
    mutation MoveCalendar($id: ID!, $index: Int!) {
  moveCalendar(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveCalendarMutation, MoveCalendarMutationVariables>;
export const DeleteCalendarDocument = new TypedDocumentString(`
    mutation DeleteCalendar($id: ID!) {
  deleteCalendar(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteCalendarMutation, DeleteCalendarMutationVariables>;
export const SubscribeCalendarDocument = new TypedDocumentString(`
    mutation SubscribeCalendar($calendarId: ID!) {
  subscribeCalendar(calendarId: $calendarId)
}
    `) as unknown as TypedDocumentString<SubscribeCalendarMutation, SubscribeCalendarMutationVariables>;
export const UnsubscribeCalendarDocument = new TypedDocumentString(`
    mutation UnsubscribeCalendar($calendarId: ID!) {
  unsubscribeCalendar(calendarId: $calendarId)
}
    `) as unknown as TypedDocumentString<UnsubscribeCalendarMutation, UnsubscribeCalendarMutationVariables>;
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
export const SprintTaskStatusesDocument = new TypedDocumentString(`
    query SprintTaskStatuses($today: Date!) {
  sprintTaskStatuses(today: $today) {
    sprintId
    taskId
    statusId
    closed
  }
}
    `) as unknown as TypedDocumentString<SprintTaskStatusesQuery, SprintTaskStatusesQueryVariables>;
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
export const TransferDashboardChartDocument = new TypedDocumentString(`
    mutation TransferDashboardChart($id: ID!, $dashboardId: ID, $projectId: ID) {
  transferDashboardChart(
    id: $id
    dashboardId: $dashboardId
    projectId: $projectId
  )
}
    `) as unknown as TypedDocumentString<TransferDashboardChartMutation, TransferDashboardChartMutationVariables>;
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
export const PlacesDocument = new TypedDocumentString(`
    query Places {
  places {
    id
    name
    address
    lat
    lon
  }
}
    `) as unknown as TypedDocumentString<PlacesQuery, PlacesQueryVariables>;
export const SearchAddressesDocument = new TypedDocumentString(`
    query SearchAddresses($text: String!, $near: GeoPointInput) {
  searchAddresses(text: $text, near: $near) {
    label
    name
    lat
    lon
  }
}
    `) as unknown as TypedDocumentString<SearchAddressesQuery, SearchAddressesQueryVariables>;
export const ReverseAddressDocument = new TypedDocumentString(`
    query ReverseAddress($point: GeoPointInput!) {
  reverseAddress(point: $point) {
    label
    name
    lat
    lon
  }
}
    `) as unknown as TypedDocumentString<ReverseAddressQuery, ReverseAddressQueryVariables>;
export const TravelTimeDocument = new TypedDocumentString(`
    query TravelTime($from: GeoPointInput!, $to: GeoPointInput!, $mode: TravelMode!) {
  travelTime(from: $from, to: $to, mode: $mode) {
    seconds
    meters
  }
}
    `) as unknown as TypedDocumentString<TravelTimeQuery, TravelTimeQueryVariables>;
export const SavePlaceDocument = new TypedDocumentString(`
    mutation SavePlace($id: ID, $input: PlaceInput!) {
  savePlace(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SavePlaceMutation, SavePlaceMutationVariables>;
export const DeletePlaceDocument = new TypedDocumentString(`
    mutation DeletePlace($id: ID!) {
  deletePlace(id: $id)
}
    `) as unknown as TypedDocumentString<DeletePlaceMutation, DeletePlaceMutationVariables>;
export const GithubLoginDocument = new TypedDocumentString(`
    query GithubLogin {
  githubLogin
}
    `) as unknown as TypedDocumentString<GithubLoginQuery, GithubLoginQueryVariables>;
export const GithubContributorsDocument = new TypedDocumentString(`
    query GithubContributors {
  githubContributors {
    id
    name
    githubLogin
  }
}
    `) as unknown as TypedDocumentString<GithubContributorsQuery, GithubContributorsQueryVariables>;
export const GithubBoardDocument = new TypedDocumentString(`
    query GithubBoard($url: String!) {
  githubBoard(url: $url) {
    id
    title
    url
    fields {
      id
      name
      dataType
      iterationCount
      options {
        id
        name
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GithubBoardQuery, GithubBoardQueryVariables>;
export const GithubProjectLinkDocument = new TypedDocumentString(`
    query GithubProjectLink($projectId: ID!) {
  githubProjectLink(projectId: $projectId) {
    id
    projectId
    url
    title
    statusFieldId
    priorityFieldId
    iterationFieldId
    startFieldId
    endFieldId
    effortFieldId
    statusOptions
    priorityOptions
    repositoryName
    pushExisting
    enabled
    lastSyncAt
    lastSyncError
    lastSyncSummary
    linkedTaskCount
  }
}
    `) as unknown as TypedDocumentString<GithubProjectLinkQuery, GithubProjectLinkQueryVariables>;
export const SetGithubTokenDocument = new TypedDocumentString(`
    mutation SetGithubToken($token: String!) {
  setGithubToken(token: $token)
}
    `) as unknown as TypedDocumentString<SetGithubTokenMutation, SetGithubTokenMutationVariables>;
export const RemoveGithubTokenDocument = new TypedDocumentString(`
    mutation RemoveGithubToken {
  removeGithubToken
}
    `) as unknown as TypedDocumentString<RemoveGithubTokenMutation, RemoveGithubTokenMutationVariables>;
export const SaveGithubLinkDocument = new TypedDocumentString(`
    mutation SaveGithubLink($projectId: ID!, $input: GithubLinkInput!) {
  saveGithubLink(projectId: $projectId, input: $input)
}
    `) as unknown as TypedDocumentString<SaveGithubLinkMutation, SaveGithubLinkMutationVariables>;
export const UnlinkGithubProjectDocument = new TypedDocumentString(`
    mutation UnlinkGithubProject($projectId: ID!) {
  unlinkGithubProject(projectId: $projectId)
}
    `) as unknown as TypedDocumentString<UnlinkGithubProjectMutation, UnlinkGithubProjectMutationVariables>;
export const SyncGithubProjectDocument = new TypedDocumentString(`
    mutation SyncGithubProject($projectId: ID!) {
  syncGithubProject(projectId: $projectId) {
    pulledNew
    pushedNew
    pulled
    pushed
    unlinked
    sprints
    comments
  }
}
    `) as unknown as TypedDocumentString<SyncGithubProjectMutation, SyncGithubProjectMutationVariables>;
export const SetContributorGithubLoginDocument = new TypedDocumentString(`
    mutation SetContributorGithubLogin($id: ID!, $login: String) {
  setContributorGithubLogin(id: $id, login: $login)
}
    `) as unknown as TypedDocumentString<SetContributorGithubLoginMutation, SetContributorGithubLoginMutationVariables>;
export const LibraryDocument = new TypedDocumentString(`
    query Library {
  documentFolders {
    id
    name
    parentId
  }
  libraryDocuments {
    id
    folderId
    kind
    title
    note
    url
    fileName
    mimeType
    size
    updatedAt
  }
}
    `) as unknown as TypedDocumentString<LibraryQuery, LibraryQueryVariables>;
export const CreateDocumentFolderDocument = new TypedDocumentString(`
    mutation CreateDocumentFolder($name: String!, $parentId: ID) {
  createDocumentFolder(name: $name, parentId: $parentId)
}
    `) as unknown as TypedDocumentString<CreateDocumentFolderMutation, CreateDocumentFolderMutationVariables>;
export const RenameDocumentFolderDocument = new TypedDocumentString(`
    mutation RenameDocumentFolder($id: ID!, $name: String!) {
  renameDocumentFolder(id: $id, name: $name)
}
    `) as unknown as TypedDocumentString<RenameDocumentFolderMutation, RenameDocumentFolderMutationVariables>;
export const MoveDocumentFolderDocument = new TypedDocumentString(`
    mutation MoveDocumentFolder($id: ID!, $parentId: ID) {
  moveDocumentFolder(id: $id, parentId: $parentId)
}
    `) as unknown as TypedDocumentString<MoveDocumentFolderMutation, MoveDocumentFolderMutationVariables>;
export const DeleteDocumentFolderDocument = new TypedDocumentString(`
    mutation DeleteDocumentFolder($id: ID!) {
  deleteDocumentFolder(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteDocumentFolderMutation, DeleteDocumentFolderMutationVariables>;
export const AddLibraryFilesDocument = new TypedDocumentString(`
    mutation AddLibraryFiles($folderId: ID, $files: [File!]!) {
  addLibraryFiles(folderId: $folderId, files: $files)
}
    `) as unknown as TypedDocumentString<AddLibraryFilesMutation, AddLibraryFilesMutationVariables>;
export const AddLibraryLinkDocument = new TypedDocumentString(`
    mutation AddLibraryLink($folderId: ID, $title: String!, $url: String!, $note: String) {
  addLibraryLink(folderId: $folderId, title: $title, url: $url, note: $note)
}
    `) as unknown as TypedDocumentString<AddLibraryLinkMutation, AddLibraryLinkMutationVariables>;
export const UpdateLibraryDocumentDocument = new TypedDocumentString(`
    mutation UpdateLibraryDocument($id: ID!, $title: String!, $url: String, $note: String, $file: File) {
  updateLibraryDocument(
    id: $id
    title: $title
    url: $url
    note: $note
    file: $file
  )
}
    `) as unknown as TypedDocumentString<UpdateLibraryDocumentMutation, UpdateLibraryDocumentMutationVariables>;
export const MoveLibraryDocumentsDocument = new TypedDocumentString(`
    mutation MoveLibraryDocuments($ids: [ID!]!, $folderId: ID) {
  moveLibraryDocuments(ids: $ids, folderId: $folderId)
}
    `) as unknown as TypedDocumentString<MoveLibraryDocumentsMutation, MoveLibraryDocumentsMutationVariables>;
export const DeleteLibraryDocumentsDocument = new TypedDocumentString(`
    mutation DeleteLibraryDocuments($ids: [ID!]!) {
  deleteLibraryDocuments(ids: $ids)
}
    `) as unknown as TypedDocumentString<DeleteLibraryDocumentsMutation, DeleteLibraryDocumentsMutationVariables>;
export const WatchedMailAccountsDocument = new TypedDocumentString(`
    query WatchedMailAccounts {
  mailAccounts {
    id
  }
}
    `) as unknown as TypedDocumentString<WatchedMailAccountsQuery, WatchedMailAccountsQueryVariables>;
export const WatchedUnreadMailsDocument = new TypedDocumentString(`
    query WatchedUnreadMails($accountId: ID!) {
  mailMessages(accountId: $accountId, folder: "INBOX", page: 0, unread: true) {
    messages {
      uid
      subject
      from {
        name
        address
      }
    }
  }
}
    `) as unknown as TypedDocumentString<WatchedUnreadMailsQuery, WatchedUnreadMailsQueryVariables>;
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
    parent
    todo
  }
}
    `) as unknown as TypedDocumentString<MailFoldersQuery, MailFoldersQueryVariables>;
export const MailMessagesDocument = new TypedDocumentString(`
    query MailMessages($accountId: ID!, $folder: String!, $page: Int!, $search: String, $unread: Boolean, $state: String, $sort: String, $ascending: Boolean) {
  mailMessages(
    accountId: $accountId
    folder: $folder
    page: $page
    search: $search
    unread: $unread
    state: $state
    sort: $sort
    ascending: $ascending
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
      labelIds
      done
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
  labelIds
  done
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
export const TodoMailCountDocument = new TypedDocumentString(`
    query TodoMailCount {
  todoMailCount
}
    `) as unknown as TypedDocumentString<TodoMailCountQuery, TodoMailCountQueryVariables>;
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
export const MailLabelsDocument = new TypedDocumentString(`
    query MailLabels {
  mailLabels {
    id
    name
    color
    position
  }
}
    `) as unknown as TypedDocumentString<MailLabelsQuery, MailLabelsQueryVariables>;
export const ScheduledMailsDocument = new TypedDocumentString(`
    query ScheduledMails {
  scheduledMails {
    id
    accountId
    sendAt
    subject
    to
    status
    error
  }
}
    `) as unknown as TypedDocumentString<ScheduledMailsQuery, ScheduledMailsQueryVariables>;
export const MarkMailsDocument = new TypedDocumentString(`
    mutation MarkMails($accountId: ID!, $folder: String!, $uids: [Int!]!, $labelId: ID, $on: Boolean, $done: Boolean) {
  markMails(
    accountId: $accountId
    folder: $folder
    uids: $uids
    labelId: $labelId
    on: $on
    done: $done
  )
}
    `) as unknown as TypedDocumentString<MarkMailsMutation, MarkMailsMutationVariables>;
export const ReportMailSpamDocument = new TypedDocumentString(`
    mutation ReportMailSpam($accountId: ID!, $folder: String!, $uids: [Int!]!, $spam: Boolean!) {
  reportMailSpam(accountId: $accountId, folder: $folder, uids: $uids, spam: $spam)
}
    `) as unknown as TypedDocumentString<ReportMailSpamMutation, ReportMailSpamMutationVariables>;
export const MoveMailsDocument = new TypedDocumentString(`
    mutation MoveMails($accountId: ID!, $folder: String!, $uids: [Int!]!, $target: String!) {
  moveMails(accountId: $accountId, folder: $folder, uids: $uids, target: $target)
}
    `) as unknown as TypedDocumentString<MoveMailsMutation, MoveMailsMutationVariables>;
export const CreateMailFolderDocument = new TypedDocumentString(`
    mutation CreateMailFolder($accountId: ID!, $parent: String, $name: String!) {
  createMailFolder(accountId: $accountId, parent: $parent, name: $name)
}
    `) as unknown as TypedDocumentString<CreateMailFolderMutation, CreateMailFolderMutationVariables>;
export const RenameMailFolderDocument = new TypedDocumentString(`
    mutation RenameMailFolder($accountId: ID!, $path: String!, $name: String!) {
  renameMailFolder(accountId: $accountId, path: $path, name: $name)
}
    `) as unknown as TypedDocumentString<RenameMailFolderMutation, RenameMailFolderMutationVariables>;
export const DeleteMailFolderDocument = new TypedDocumentString(`
    mutation DeleteMailFolder($accountId: ID!, $path: String!) {
  deleteMailFolder(accountId: $accountId, path: $path)
}
    `) as unknown as TypedDocumentString<DeleteMailFolderMutation, DeleteMailFolderMutationVariables>;
export const CreateMailLabelDocument = new TypedDocumentString(`
    mutation CreateMailLabel($name: String!, $color: String!) {
  createMailLabel(name: $name, color: $color)
}
    `) as unknown as TypedDocumentString<CreateMailLabelMutation, CreateMailLabelMutationVariables>;
export const UpdateMailLabelDocument = new TypedDocumentString(`
    mutation UpdateMailLabel($id: ID!, $name: String!, $color: String!) {
  updateMailLabel(id: $id, name: $name, color: $color)
}
    `) as unknown as TypedDocumentString<UpdateMailLabelMutation, UpdateMailLabelMutationVariables>;
export const DeleteMailLabelDocument = new TypedDocumentString(`
    mutation DeleteMailLabel($id: ID!) {
  deleteMailLabel(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteMailLabelMutation, DeleteMailLabelMutationVariables>;
export const ScheduleMailDocument = new TypedDocumentString(`
    mutation ScheduleMail($input: SendMailInput!, $sendAt: DateTime!) {
  scheduleMail(input: $input, sendAt: $sendAt)
}
    `) as unknown as TypedDocumentString<ScheduleMailMutation, ScheduleMailMutationVariables>;
export const SendScheduledMailDocument = new TypedDocumentString(`
    mutation SendScheduledMail($id: ID!) {
  sendScheduledMail(id: $id)
}
    `) as unknown as TypedDocumentString<SendScheduledMailMutation, SendScheduledMailMutationVariables>;
export const CancelScheduledMailDocument = new TypedDocumentString(`
    mutation CancelScheduledMail($id: ID!) {
  cancelScheduledMail(id: $id)
}
    `) as unknown as TypedDocumentString<CancelScheduledMailMutation, CancelScheduledMailMutationVariables>;
export const MailSearchesDocument = new TypedDocumentString(`
    query MailSearches {
  mailSearches {
    id
    name
    criteria
    position
  }
}
    `) as unknown as TypedDocumentString<MailSearchesQuery, MailSearchesQueryVariables>;
export const MailSearchResultsDocument = new TypedDocumentString(`
    query MailSearchResults($id: ID!, $page: Int!) {
  mailSearchResults(id: $id, page: $page) {
    total
    pageSize
    messages {
      accountId
      folder
      folderName
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
      labelIds
      done
    }
  }
}
    `) as unknown as TypedDocumentString<MailSearchResultsQuery, MailSearchResultsQueryVariables>;
export const MailAdvancedSearchDocument = new TypedDocumentString(`
    query MailAdvancedSearch($criteria: JSON!, $page: Int!) {
  mailAdvancedSearch(criteria: $criteria, page: $page) {
    total
    pageSize
    messages {
      accountId
      folder
      folderName
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
      labelIds
      done
    }
  }
}
    `) as unknown as TypedDocumentString<MailAdvancedSearchQuery, MailAdvancedSearchQueryVariables>;
export const MoveMailFolderDocument = new TypedDocumentString(`
    mutation MoveMailFolder($accountId: ID!, $path: String!, $parent: String) {
  moveMailFolder(accountId: $accountId, path: $path, parent: $parent)
}
    `) as unknown as TypedDocumentString<MoveMailFolderMutation, MoveMailFolderMutationVariables>;
export const CreateMailSearchDocument = new TypedDocumentString(`
    mutation CreateMailSearch($input: MailSearchInput!) {
  createMailSearch(input: $input)
}
    `) as unknown as TypedDocumentString<CreateMailSearchMutation, CreateMailSearchMutationVariables>;
export const UpdateMailSearchDocument = new TypedDocumentString(`
    mutation UpdateMailSearch($id: ID!, $input: MailSearchInput!) {
  updateMailSearch(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateMailSearchMutation, UpdateMailSearchMutationVariables>;
export const DeleteMailSearchDocument = new TypedDocumentString(`
    mutation DeleteMailSearch($id: ID!) {
  deleteMailSearch(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteMailSearchMutation, DeleteMailSearchMutationVariables>;
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
  taskTags {
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
  sprintIds
  deadline
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  tagIds
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
  githubLinked
  githubUrl
  githubNumber
}`) as unknown as TypedDocumentString<TasksDataQuery, TasksDataQueryVariables>;
export const TaskCommentsDocument = new TypedDocumentString(`
    query TaskComments($id: ID!) {
  task(id: $id) {
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
  githubAuthor
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
  sprintIds
  deadline
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  tagIds
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
  githubLinked
  githubUrl
  githubNumber
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
  sprintIds
  deadline
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  tagIds
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
  githubLinked
  githubUrl
  githubNumber
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
  githubAuthor
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
  githubAuthor
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
export const CreateTaskTagDocument = new TypedDocumentString(`
    mutation CreateTaskTag($input: TaskLabelInput!) {
  createTaskTag(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateTaskTagMutation, CreateTaskTagMutationVariables>;
export const UpdateTaskTagDocument = new TypedDocumentString(`
    mutation UpdateTaskTag($id: ID!, $input: TaskLabelUpdateInput!) {
  updateTaskTag(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTaskTagMutation, UpdateTaskTagMutationVariables>;
export const DeleteTaskTagDocument = new TypedDocumentString(`
    mutation DeleteTaskTag($id: ID!) {
  deleteTaskTag(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTaskTagMutation, DeleteTaskTagMutationVariables>;
export const MoveTaskTagDocument = new TypedDocumentString(`
    mutation MoveTaskTag($id: ID!, $index: Int!) {
  moveTaskTag(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveTaskTagMutation, MoveTaskTagMutationVariables>;
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
export const MatchingTaskIdsBySprintDocument = new TypedDocumentString(`
    query MatchingTaskIdsBySprint($query: TaskQueryInput!) {
  matchingTaskIdsBySprint(query: $query) {
    sprintId
    taskIds
  }
}
    `) as unknown as TypedDocumentString<MatchingTaskIdsBySprintQuery, MatchingTaskIdsBySprintQueryVariables>;
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
    query TimeEntries($projectId: ID, $since: DateTime) {
  timeEntries(projectId: $projectId, since: $since) {
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
  calendarEventId
  calendarOccurrenceDate
  calendarEventTitle
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
  calendarEventId
  calendarOccurrenceDate
  calendarEventTitle
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
export const TreasuryDocumentOptionsDocument = new TypedDocumentString(`
    query TreasuryDocumentOptions {
  treasuryDocumentOptions {
    ...TreasuryEntryDocumentFields
  }
}
    fragment TreasuryEntryDocumentFields on TreasuryEntryDocument {
  id
  source
  kind
  title
  url
  projectId
  place
}`) as unknown as TypedDocumentString<TreasuryDocumentOptionsQuery, TreasuryDocumentOptionsQueryVariables>;
export const TreasuryAccountsDocument = new TypedDocumentString(`
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
fragment TreasuryEntryDocumentFields on TreasuryEntryDocument {
  id
  source
  kind
  title
  url
  projectId
  place
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
fragment TreasuryEntryDocumentFields on TreasuryEntryDocument {
  id
  source
  kind
  title
  url
  projectId
  place
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
    `) as unknown as TypedDocumentString<TreasuryProjectionQuery, TreasuryProjectionQueryVariables>;
export const TreasurySettingsDocument = new TypedDocumentString(`
    query TreasurySettings {
  treasuryCategories {
    id
    name
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
    `) as unknown as TypedDocumentString<TreasurySettingsQuery, TreasurySettingsQueryVariables>;
export const TreasuryEntrySearchDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<TreasuryEntrySearchQuery, TreasuryEntrySearchQueryVariables>;
export const CreateTreasuryCategoryDocument = new TypedDocumentString(`
    mutation CreateTreasuryCategory($input: TreasuryCategoryInput!) {
  createTreasuryCategory(input: $input)
}
    `) as unknown as TypedDocumentString<CreateTreasuryCategoryMutation, CreateTreasuryCategoryMutationVariables>;
export const UpdateTreasuryCategoryDocument = new TypedDocumentString(`
    mutation UpdateTreasuryCategory($id: ID!, $input: TreasuryCategoryInput!) {
  updateTreasuryCategory(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateTreasuryCategoryMutation, UpdateTreasuryCategoryMutationVariables>;
export const DeleteTreasuryCategoryDocument = new TypedDocumentString(`
    mutation DeleteTreasuryCategory($id: ID!) {
  deleteTreasuryCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryCategoryMutation, DeleteTreasuryCategoryMutationVariables>;
export const CreateTreasuryPaymentMethodDocument = new TypedDocumentString(`
    mutation CreateTreasuryPaymentMethod($input: TreasuryPaymentMethodInput!) {
  createTreasuryPaymentMethod(input: $input)
}
    `) as unknown as TypedDocumentString<CreateTreasuryPaymentMethodMutation, CreateTreasuryPaymentMethodMutationVariables>;
export const UpdateTreasuryPaymentMethodDocument = new TypedDocumentString(`
    mutation UpdateTreasuryPaymentMethod($id: ID!, $input: TreasuryPaymentMethodInput!) {
  updateTreasuryPaymentMethod(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateTreasuryPaymentMethodMutation, UpdateTreasuryPaymentMethodMutationVariables>;
export const DeleteTreasuryPaymentMethodDocument = new TypedDocumentString(`
    mutation DeleteTreasuryPaymentMethod($id: ID!) {
  deleteTreasuryPaymentMethod(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryPaymentMethodMutation, DeleteTreasuryPaymentMethodMutationVariables>;
export const CreateTreasuryCounterpartyDocument = new TypedDocumentString(`
    mutation CreateTreasuryCounterparty($input: TreasuryCounterpartyInput!) {
  createTreasuryCounterparty(input: $input)
}
    `) as unknown as TypedDocumentString<CreateTreasuryCounterpartyMutation, CreateTreasuryCounterpartyMutationVariables>;
export const UpdateTreasuryCounterpartyDocument = new TypedDocumentString(`
    mutation UpdateTreasuryCounterparty($id: ID!, $input: TreasuryCounterpartyInput!) {
  updateTreasuryCounterparty(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateTreasuryCounterpartyMutation, UpdateTreasuryCounterpartyMutationVariables>;
export const DeleteTreasuryCounterpartyDocument = new TypedDocumentString(`
    mutation DeleteTreasuryCounterparty($id: ID!) {
  deleteTreasuryCounterparty(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryCounterpartyMutation, DeleteTreasuryCounterpartyMutationVariables>;
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
export const AddTreasuryMemberDocument = new TypedDocumentString(`
    mutation AddTreasuryMember($contributorId: ID, $name: String) {
  addTreasuryMember(contributorId: $contributorId, name: $name)
}
    `) as unknown as TypedDocumentString<AddTreasuryMemberMutation, AddTreasuryMemberMutationVariables>;
export const RemoveTreasuryMemberDocument = new TypedDocumentString(`
    mutation RemoveTreasuryMember($contributorId: ID!) {
  removeTreasuryMember(contributorId: $contributorId)
}
    `) as unknown as TypedDocumentString<RemoveTreasuryMemberMutation, RemoveTreasuryMemberMutationVariables>;
export const SaveTreasuryRelationDocument = new TypedDocumentString(`
    mutation SaveTreasuryRelation($id: ID, $input: TreasuryRelationInput!) {
  saveTreasuryRelation(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SaveTreasuryRelationMutation, SaveTreasuryRelationMutationVariables>;
export const DeleteTreasuryRelationDocument = new TypedDocumentString(`
    mutation DeleteTreasuryRelation($id: ID!) {
  deleteTreasuryRelation(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryRelationMutation, DeleteTreasuryRelationMutationVariables>;
export const SaveTreasuryContextDocument = new TypedDocumentString(`
    mutation SaveTreasuryContext($id: ID, $input: TreasuryContextInput!) {
  saveTreasuryContext(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SaveTreasuryContextMutation, SaveTreasuryContextMutationVariables>;
export const DeleteTreasuryContextDocument = new TypedDocumentString(`
    mutation DeleteTreasuryContext($id: ID!) {
  deleteTreasuryContext(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryContextMutation, DeleteTreasuryContextMutationVariables>;
export const SaveTreasuryContextPeriodDocument = new TypedDocumentString(`
    mutation SaveTreasuryContextPeriod($id: ID, $input: TreasuryContextPeriodInput!) {
  saveTreasuryContextPeriod(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SaveTreasuryContextPeriodMutation, SaveTreasuryContextPeriodMutationVariables>;
export const DeleteTreasuryContextPeriodDocument = new TypedDocumentString(`
    mutation DeleteTreasuryContextPeriod($id: ID!) {
  deleteTreasuryContextPeriod(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryContextPeriodMutation, DeleteTreasuryContextPeriodMutationVariables>;
export const TreasuryBudgetsDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<TreasuryBudgetsQuery, TreasuryBudgetsQueryVariables>;
export const SaveTreasuryBudgetDocument = new TypedDocumentString(`
    mutation SaveTreasuryBudget($id: ID, $input: TreasuryBudgetInput!) {
  saveTreasuryBudget(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SaveTreasuryBudgetMutation, SaveTreasuryBudgetMutationVariables>;
export const DeleteTreasuryBudgetDocument = new TypedDocumentString(`
    mutation DeleteTreasuryBudget($id: ID!) {
  deleteTreasuryBudget(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryBudgetMutation, DeleteTreasuryBudgetMutationVariables>;
export const TreasuryLoansDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<TreasuryLoansQuery, TreasuryLoansQueryVariables>;
export const ImportTreasuryStatementDocument = new TypedDocumentString(`
    mutation ImportTreasuryStatement($accountId: ID!, $mapping: JSON, $rows: [TreasuryStatementRowInput!]!) {
  importTreasuryStatement(accountId: $accountId, mapping: $mapping, rows: $rows)
}
    `) as unknown as TypedDocumentString<ImportTreasuryStatementMutation, ImportTreasuryStatementMutationVariables>;
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
export const ElsewhereAlarmsDocument = new TypedDocumentString(`
    query ElsewhereAlarms {
  alarms {
    ...AlarmFields
    task {
      id
      number
      title
      projectId
    }
    project {
      id
      title
    }
  }
  runningTimeEntry {
    id
    startedAt
    endedAt
    pausedAt
    pausedSeconds
    duration
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
}`) as unknown as TypedDocumentString<ElsewhereAlarmsQuery, ElsewhereAlarmsQueryVariables>;
export const ElsewhereMarkAlarmFiredDocument = new TypedDocumentString(`
    mutation ElsewhereMarkAlarmFired($id: ID!, $at: DateTime!) {
  markAlarmFired(id: $id, at: $at)
}
    `) as unknown as TypedDocumentString<ElsewhereMarkAlarmFiredMutation, ElsewhereMarkAlarmFiredMutationVariables>;
export const WorkspacesDocument = new TypedDocumentString(`
    query Workspaces {
  workspaces {
    id
    name
    kind
    position
    notifyElsewhere
  }
  currentWorkspaceId
}
    `) as unknown as TypedDocumentString<WorkspacesQuery, WorkspacesQueryVariables>;
export const CreateWorkspaceDocument = new TypedDocumentString(`
    mutation CreateWorkspace($input: WorkspaceInput!) {
  createWorkspace(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateWorkspaceMutation, CreateWorkspaceMutationVariables>;
export const UpdateWorkspaceDocument = new TypedDocumentString(`
    mutation UpdateWorkspace($id: ID!, $input: WorkspaceInput!) {
  updateWorkspace(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>;
export const SetWorkspaceNotificationsDocument = new TypedDocumentString(`
    mutation SetWorkspaceNotifications($id: ID!, $sources: [NotificationSource!]!) {
  setWorkspaceNotifications(id: $id, sources: $sources) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetWorkspaceNotificationsMutation, SetWorkspaceNotificationsMutationVariables>;
export const MoveWorkspaceDocument = new TypedDocumentString(`
    mutation MoveWorkspace($id: ID!, $index: Int!) {
  moveWorkspace(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveWorkspaceMutation, MoveWorkspaceMutationVariables>;
export const DeleteWorkspaceDocument = new TypedDocumentString(`
    mutation DeleteWorkspace($id: ID!) {
  deleteWorkspace(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>;
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