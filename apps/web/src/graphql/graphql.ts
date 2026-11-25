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
  label?: string | null | undefined;
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
  label: string;
  quantity: number;
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
  label: string;
  minutes?: number | null | undefined;
  note?: string | null | undefined;
  projectId?: string | number | null | undefined;
  /** Repetition in the common form; null: it rings once. */
  recurrence?: unknown;
  startDate?: string | null | undefined;
  taskId?: string | number | null | undefined;
  /** HH:MM, local time. */
  time?: string | null | undefined;
  type: AlarmType;
  /** 1 (Monday) to 7 (Sunday). */
  weekdays: Array<number>;
};

export type AlarmRingInput = {
  dueAt: string;
  key: string;
  lines?: Array<string> | null | undefined;
  linkLabel?: string | null | undefined;
  path?: string | null | undefined;
  ringtone?: string | null | undefined;
  title: string;
  workspaceId?: string | number | null | undefined;
};

export type AlarmType =
  | 'NOT_TRACKING'
  | 'REMINDER'
  | 'TRACKING_DURATION';

/** Kind of element archived or restored by `setArchived`: main elements of the features and every settings list (clients, projects, tasks and routines have their own mutations). */
export type ArchivableKind =
  | 'ACCOUNTING_DOCUMENT'
  | 'CALENDAR'
  | 'CALENDAR_CATEGORY'
  | 'CALENDAR_EVENT'
  | 'CATALOG_ITEM'
  | 'CLIENT_CONTACT'
  | 'CONTRIBUTOR'
  | 'DASHBOARD'
  | 'DOCUMENT_STATUS'
  | 'IMPORTED_DOCUMENT'
  | 'MAIL_ACCOUNT'
  | 'MAIL_LABEL'
  | 'MILESTONE'
  | 'PLACE'
  | 'PROJECT_CATEGORY'
  | 'PROJECT_STATUS'
  | 'RECURRING_INVOICE'
  | 'ROUTINE_CATEGORY'
  | 'SAVED_COUNTDOWN'
  | 'SCHEDULE_TYPE'
  | 'SHEET'
  | 'SHEET_CATEGORY'
  | 'SHOPPING_BASE_LIST'
  | 'SHOPPING_CATEGORY'
  | 'SHOPPING_LIST'
  | 'SHOPPING_PRODUCT'
  | 'SHOPPING_STORAGE'
  | 'SHOPPING_STORE'
  | 'SHOPPING_UNIT'
  | 'SPRINT'
  | 'STOCK_ITEM'
  | 'STOCK_LOCATION'
  | 'TASK_AUTOMATION'
  | 'TASK_PRIORITY'
  | 'TASK_STATUS'
  | 'TASK_TAG'
  | 'TASK_TYPE'
  | 'TREASURY_ACCOUNT'
  | 'TREASURY_BUDGET'
  | 'TREASURY_CATEGORY'
  | 'TREASURY_COUNTERPARTY'
  | 'TREASURY_ENTRY'
  | 'TREASURY_PAYMENT_METHOD'
  | 'TREASURY_RELATION'
  | 'WORK_SCHEDULE';

export type BirthdayLookInput = {
  color?: string | null | undefined;
  shown: boolean;
};

/** Omitted fields are left unchanged; null clears a field. */
export type BulkTaskInput = {
  addAssigneeIds?: Array<string | number> | null | undefined;
  addSprintIds?: Array<string | number> | null | undefined;
  addTagIds?: Array<string | number> | null | undefined;
  /** Fields emptied on purpose (« Vider »; PROJECT refused). A field given a value becomes their own. */
  clearFields?: Array<TaskInheritableField> | null | undefined;
  deadline?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  /** Fields made inherited from their parent again (« Rétablir l’héritage »); tasks without parent unchanged. */
  inheritFields?: Array<TaskInheritableField> | null | undefined;
  milestoneId?: string | number | null | undefined;
  minDate?: string | null | undefined;
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
  label: string;
  parentId?: string | number | null | undefined;
};

/** Times are Paris times; all-day events have none. */
export type CalendarEventInput = {
  allDay: boolean;
  /** Contributors the event is for; none: none. */
  beneficiaryIds?: Array<string | number> | null | undefined;
  /** Relations the event is for; none: none. */
  beneficiaryRelationIds?: Array<string | number> | null | undefined;
  /** Calendar; the first one of the workspace when omitted. */
  calendarId?: string | number | null | undefined;
  categoryIds: Array<string | number>;
  contributorIds: Array<string | number>;
  description?: string | null | undefined;
  endDate: string;
  endTime?: string | null | undefined;
  label: string;
  /** Documents of the library linked to it (50 at most); none: none. */
  libraryDocumentIds?: Array<string | number> | null | undefined;
  links: Array<ItemLinkInput>;
  location?: string | null | undefined;
  /** Point of the location; none: unknown. */
  locationLat?: number | null | undefined;
  locationLon?: number | null | undefined;
  projectId?: string | number | null | undefined;
  /** Documents of projects linked to it, of its project tree (50 at most); none: none. */
  projectResourceIds?: Array<string | number> | null | undefined;
  recurrence?: unknown;
  /** Relations without contributor taking part; none: none. */
  relationIds?: Array<string | number> | null | undefined;
  /** Minutes before its start or its end (24 hours at most), a time of its first (or last) day, or that time 1 to 30 days before; each with its ringtone or none; 10 at most. */
  reminders: Array<ReminderInput>;
  /** Routines of a day of the occurrence it is about (its other days kept); none when omitted. */
  routineLinks?: Array<EventRoutineLinkInput> | null | undefined;
  startDate: string;
  startTime?: string | null | undefined;
  /** Tasks the event is about (none when omitted). */
  taskIds?: Array<string | number> | null | undefined;
  /** Travel time back, in minutes; none: 0. */
  travelAfter?: number | null | undefined;
  /** Travel time there, in minutes; none: 0. */
  travelBefore?: number | null | undefined;
};

/** Scope of a change to a recurring event. */
export type CalendarEventScope =
  | 'ALL'
  | 'FOLLOWING'
  | 'THIS';

export type CatalogItemInput = {
  description?: string | null | undefined;
  /** ITEM or DISBURSEMENT. */
  kind: AccountingLineKind;
  label: string;
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
  label: string;
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

export type CommentSnapshotInput = {
  body: string;
  createdAt: string;
  updatedAt: string;
};

/** Kind of item a comment goes on (tasks have their own comments). */
export type CommentTarget =
  | 'BUDGET'
  | 'CATALOG_ITEM'
  | 'DOCUMENT'
  | 'EVENT'
  | 'IMPORTED_DOCUMENT'
  | 'LIBRARY_DOCUMENT'
  | 'MAIL'
  | 'RELATION'
  | 'ROUTINE'
  | 'SCHEDULE'
  | 'SHEET_ITEM'
  | 'SHOPPING_ITEM'
  | 'SHOPPING_LIST'
  | 'SHOPPING_PRODUCT'
  | 'STOCK_ITEM'
  | 'TIME_ENTRY'
  | 'TREASURY_ENTRY';

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
  /** What its details come from (it has none of its own). */
  link?: ContributorLinkInput | null | undefined;
  name: string;
  /** Projects the contributor is directly attached to. */
  projectIds?: Array<string | number> | null | undefined;
};

/** What the details of a contributor come from, one at most; the link replaces the one it had. */
export type ContributorLinkInput = {
  /** Client contact (kind CONTACT), not linked to another contributor. */
  contactId?: string | number | null | undefined;
  kind: ContributorLinkKind;
  /** Relation (kind RELATION), not linked to another contributor. */
  relationId?: string | number | null | undefined;
};

export type ContributorLinkKind =
  | 'CONTACT'
  | 'MEMBER'
  | 'NONE'
  | 'RELATION';

export type ContributorUpdateInput = {
  avatar?: File | null | undefined;
  handle?: string | null | undefined;
  /** What its details come from (it has none of its own). */
  link?: ContributorLinkInput | null | undefined;
  name?: string | null | undefined;
  /** Projects the contributor is directly attached to. */
  projectIds?: Array<string | number> | null | undefined;
  removeAvatar?: boolean | null | undefined;
};

export type CountdownInput = {
  /** Event it is launched for. */
  eventId?: string | number | null | undefined;
  /** Its name; none: « Minuteur ». */
  label?: string | null | undefined;
  linkLabel?: string | null | undefined;
  /** Occurrence of that routine or recurring event. */
  occurrenceDate?: string | null | undefined;
  /** Page of the app its ring links to. */
  path?: string | null | undefined;
  /** Ringtone of the bank; none: the one of the settings. */
  ringtone?: string | null | undefined;
  /** Routine it is launched for. */
  routineId?: string | number | null | undefined;
  /** Duration, 1 minute to 24 hours. */
  seconds: number;
  /** Sheet it is launched for. */
  sheetId?: string | number | null | undefined;
  /** Name of its item. */
  subject?: string | null | undefined;
  /** Task it is launched for (a dead time, a saved timer). */
  taskId?: string | number | null | undefined;
  /** Workspace of its item. */
  workspaceId?: string | number | null | undefined;
};

export type DashboardChartInput = {
  config: unknown;
  label: string;
  wide: boolean;
};

export type DeadTimeInput = {
  label: string;
  /** 1 to 1 440. */
  minutes: number;
  /** Ringtone of the bank; none: the one of the settings. */
  ringtone?: string | null | undefined;
};

export type DefaultScheduleKindInput = {
  color?: string | null | undefined;
  dayBar: boolean;
  dayDisplay: string;
  /** Empty: "Travail". */
  label: string;
  monthDisplay: string;
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

export type EventRoutineLinkInput = {
  /** Day that identifies the occurrence of the routine (YYYY-MM-DD). */
  date: string;
  routineId: string | number;
  /** Moved with the event: the day it shows on now (YYYY-MM-DD); the occurrence of that routine shown that day is linked, none there: the link is dropped. */
  shownDate?: string | null | undefined;
};

export type GeoPointInput = {
  lat: number;
  lon: number;
};

export type GithubLinkInput = {
  deadlineFieldId?: string | null | undefined;
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
  syncAssignees: boolean;
  syncLabels: boolean;
  /** Number field receiving the tracked time, in hours (Ordo → GitHub). */
  timeSpentFieldId?: string | null | undefined;
  typeFieldId?: string | null | undefined;
  /** { [ordoTypeId]: optionId or issue type id } */
  typeOptions: unknown;
  /** FIELD (typeFieldId), ISSUE_TYPE (issue types of the organization), or null. */
  typeSource?: string | null | undefined;
  url: string;
  /** Sprints written as iterations on GitHub. Default = false. */
  writeIterations?: boolean | null | undefined;
};

/** Where a task of a project tree linked to a GitHub board stands: on the board, not on GitHub, or removed from the board (not sent again by the sync). */
export type GithubTaskState =
  | 'NOT_SENT'
  | 'REMOVED'
  | 'SYNCED';

export type ImportedDocumentInput = {
  clientId?: string | number | null | undefined;
  clientName?: string | null | undefined;
  currency: string;
  dueDate?: string | null | undefined;
  issueDate: string;
  label?: string | null | undefined;
  note?: string | null | undefined;
  number: string;
  projectId?: string | number | null | undefined;
  settled: boolean;
  totalGross: number;
  totalNet: number;
  totalVat: number;
  type: AccountingDocumentType;
};

/** Where the value a field goes by comes from: OWN, PARENT (« (parent) »), and for the dates of a task MILESTONE (« (jalon) »), PROJECT (« (projet) »), SPRINT (« (sprint) »). */
export type InheritSource =
  | 'MILESTONE'
  | 'OWN'
  | 'PARENT'
  | 'PROJECT'
  | 'SPRINT';

/** State of an inherited field of a sub-task or sub-routine: INHERITED (its parent’s, live), OWN (its own value; a top-level item’s fields always are), CLEARED (emptied on purpose, « aucun », even when its parent has one). */
export type InheritState =
  | 'CLEARED'
  | 'INHERITED'
  | 'OWN';

export type ItemLinkInput = {
  label: string;
  url: string;
};

/** Label and color of an item of a simple list. */
export type LabelColorInput = {
  color: string;
  label: string;
};

/** Changes of an item of a simple list (omitted fields unchanged). */
export type LabelColorPatch = {
  color?: string | null | undefined;
  label?: string | null | undefined;
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
  label: string;
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
  label: string;
  labelIds: Array<string | number>;
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
  label: string;
  projectId: string | number;
};

/** Omitted fields are left unchanged; null clears a field. */
export type MilestoneUpdateInput = {
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  label?: string | null | undefined;
};

/** Kind of notification a workspace can give while another one is open. */
export type NotificationSource =
  | 'MAILS';

export type PlaceInput = {
  address?: string | null | undefined;
  label: string;
  /** None for a zone. */
  lat?: number | null | undefined;
  /** None for a zone. */
  lon?: number | null | undefined;
  /** Place a zone is in. */
  parentId?: string | number | null | undefined;
};

export type ProductStockInput = {
  autoStock: boolean;
  consumable: boolean;
  stockLocationId?: string | number | null | undefined;
  stockTracked: boolean;
};

export type ProjectInput = {
  categoryIds?: Array<string | number> | null | undefined;
  /** Client of a root project; a sub-project inherits the client of its parent. */
  clientId?: string | number | null | undefined;
  color?: string | null | undefined;
  description?: string | null | undefined;
  endDate?: string | null | undefined;
  icon?: File | null | undefined;
  label: string;
  parentId?: string | number | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
};

export type ProjectResourceKind =
  | 'FILE'
  | 'LINK';

export type ProjectUpdateInput = {
  categoryIds?: Array<string | number> | null | undefined;
  /** null detaches the project from its client; omitted leaves it unchanged. */
  clientId?: string | number | null | undefined;
  color?: string | null | undefined;
  description?: string | null | undefined;
  endDate?: string | null | undefined;
  /** Replaces the current icon. */
  icon?: File | null | undefined;
  label?: string | null | undefined;
  /** null makes it a root project; omitted leaves it unchanged. */
  parentId?: string | number | null | undefined;
  removeIcon?: boolean | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
};

export type PushSubscriptionInput = {
  auth: string;
  endpoint: string;
  label: string;
  p256dh: string;
};

export type RecurringInvoiceInput = {
  active: boolean;
  autoFinalize: boolean;
  label: string;
  recurrence: unknown;
  startDate: string;
};

export type ReminderInput = {
  /** `start` (default) or `end` (events and routines); `openEnd`, `dueStart` (routines). */
  anchor?: string | null | undefined;
  /** HH:MM. */
  at?: string | null | undefined;
  /** Minutes before, 0 to 1 440. */
  before?: number | null | undefined;
  /** Days before, 1 to 30, with `at`. */
  days?: number | null | undefined;
  /** Ringtone of the bank; none: the one of the settings. */
  ringtone?: string | null | undefined;
};

export type RingSettingsInput = {
  loop: boolean;
  outside: boolean;
  repeatMinutes: number;
  ringMinutes: number;
  ringtone: string;
};

/** Same changes for several routines (omitted fields unchanged; null clears estimate, projectId, priorityId and typeId). */
export type RoutineBulkChanges = {
  addAssigneeIds?: Array<string | number> | null | undefined;
  addCategoryIds?: Array<string | number> | null | undefined;
  /** « Relative à » added (never to itself). */
  addRelatedIds?: Array<string | number> | null | undefined;
  addRequiredIds?: Array<string | number> | null | undefined;
  /** Cases (with recurrence: its whole repetition); empty: its rule. */
  cases?: unknown;
  /** Fields emptied on purpose (« Vider »; START_DATE and RECURRENCE refused). A field given a value becomes their own. */
  clearFields?: Array<RoutineInheritableField> | null | undefined;
  /** HH:MM; null: no limit. */
  dueTime?: string | null | undefined;
  /** Minutes. */
  estimate?: number | null | undefined;
  /** HH:MM; null: no limit. */
  fromTime?: string | null | undefined;
  /** Fields made inherited from their parent again (« Rétablir l’héritage »); routines without parent unchanged. */
  inheritFields?: Array<RoutineInheritableField> | null | undefined;
  /** Times of the day following its rule. */
  moments?: unknown;
  /** « Ouverture » of its rule; null: none. */
  opensOn?: unknown;
  priorityId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
  recurrence?: unknown;
  removeAssigneeIds?: Array<string | number> | null | undefined;
  removeCategoryIds?: Array<string | number> | null | undefined;
  removeRelatedIds?: Array<string | number> | null | undefined;
  removeRequiredIds?: Array<string | number> | null | undefined;
  /** On or out of calendar schedules, following its rule; null: any time. */
  slotCondition?: unknown;
  startDate?: string | null | undefined;
  typeId?: string | number | null | undefined;
};

export type RoutineCategoryInput = {
  color?: string | null | undefined;
  label: string;
  parentId?: string | number | null | undefined;
};

/** Field a sub-routine inherits from its parent; START_DATE, RECURRENCE, CASES, MOMENTS, MOVES and OPENS_ON make its « quand ». */
export type RoutineInheritableField =
  | 'ASSIGNEES'
  | 'BENEFICIARIES'
  | 'CASES'
  | 'CATEGORIES'
  | 'LOCATION'
  | 'MOMENTS'
  | 'MOVES'
  | 'OPENS_ON'
  | 'PRIORITY'
  | 'PROJECT'
  | 'RECURRENCE'
  | 'SLOT_CONDITION'
  | 'START_DATE';

export type RoutineInput = {
  assigneeIds: Array<string | number>;
  /** Contributors it is for; none: none. */
  beneficiaryIds?: Array<string | number> | null | undefined;
  /** Relations it is for; none: none. */
  beneficiaryRelationIds?: Array<string | number> | null | undefined;
  /** Cases (days and times of the day); empty: the repetition. */
  cases?: unknown;
  categoryIds: Array<string | number>;
  /** « Temps morts », 20 at most; required, as links: an omitted field never wipes them. */
  deadTimes: Array<DeadTimeInput>;
  description?: string | null | undefined;
  /** HH:MM. */
  dueTime?: string | null | undefined;
  /** Minutes. */
  estimate?: number | null | undefined;
  /** HH:MM. */
  fromTime?: string | null | undefined;
  /** Under a parent: the fields it inherits, live (their values given are not used, its project is its parent’s). Omitted: none for a new routine, unchanged for an update. */
  inheritedFields?: Array<RoutineInheritableField> | null | undefined;
  label: string;
  /** Documents of the library linked to it (50 at most); none: none. */
  libraryDocumentIds?: Array<string | number> | null | undefined;
  /** 20 at most, http or https; required, as relatedIds: an omitted field never wipes them. */
  links: Array<ItemLinkInput>;
  location?: string | null | undefined;
  /** Point of the location; none: unknown. */
  locationLat?: number | null | undefined;
  locationLon?: number | null | undefined;
  /** Times of the day, [{ fromTime, dueTime, optional }]. */
  moments?: unknown;
  /** Its exceptions, [{ from, to, times }] (an undo gives them back). Omitted: kept; not taken by a new routine. */
  moves?: unknown;
  /** « Ouverture » of the occurrences of its rule: { mode: DAY | WEEKDAY | WEEK | BEFORE, … }; null: none. */
  opensOn?: unknown;
  parentId?: string | number | null | undefined;
  /** Priority (the list of the tasks); none: none. */
  priorityId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
  /** Documents of projects linked to it, of its project tree (50 at most); none: none. */
  projectResourceIds?: Array<string | number> | null | undefined;
  recurrence: unknown;
  /** « Relative à »: routines related to it (same project tree). */
  relatedIds: Array<string | number>;
  reminders?: Array<ReminderInput> | null | undefined;
  requiredIds: Array<string | number>;
  /** Following its rule: on or out of calendar schedules, in groups (and / or); null: any time. */
  slotCondition?: unknown;
  startDate: string;
  /** Travel time back, in minutes; none: 0. */
  travelAfter?: number | null | undefined;
  /** Travel time there, in minutes; none: 0. */
  travelBefore?: number | null | undefined;
  /** Type (the list of the tasks); none: none. */
  typeId?: string | number | null | undefined;
};

export type RoutineOccurrenceGoneInput = {
  /** Occurrence (its day now). */
  date: string;
  id: string | number;
  /** THIS or FOLLOWING. */
  scope: CalendarEventScope;
};

/** Changes of a routine (omitted fields unchanged). */
export type RoutinePatch = {
  assigneeIds?: Array<string | number> | null | undefined;
  beneficiaryIds?: Array<string | number> | null | undefined;
  beneficiaryRelationIds?: Array<string | number> | null | undefined;
  /** Cases (with recurrence: its whole repetition); empty: its rule. */
  cases?: unknown;
  categoryIds?: Array<string | number> | null | undefined;
  /** Fields emptied on purpose (« Vider »; START_DATE and RECURRENCE refused). A field given a value becomes its own. */
  clear?: Array<RoutineInheritableField> | null | undefined;
  /** HH:MM; null: no limit. */
  dueTime?: string | null | undefined;
  estimate?: number | null | undefined;
  /** HH:MM; null: no limit. */
  fromTime?: string | null | undefined;
  /** Fields made inherited from its parent again (« Rétablir l’héritage »); a sub-routine only. */
  inherit?: Array<RoutineInheritableField> | null | undefined;
  label?: string | null | undefined;
  /** Null: none (its point too). */
  location?: string | null | undefined;
  /** Point of the location; none: unknown. */
  locationLat?: number | null | undefined;
  locationLon?: number | null | undefined;
  /** Times of the day following its rule. */
  moments?: unknown;
  /** « Ouverture »: { mode: DAY | WEEKDAY | WEEK | BEFORE, … }; null: none. */
  opensOn?: unknown;
  /** Null: top level. */
  parentId?: string | number | null | undefined;
  /** Null: none. */
  priorityId?: string | number | null | undefined;
  /** Null: none. */
  projectId?: string | number | null | undefined;
  recurrence?: unknown;
  relatedIds?: Array<string | number> | null | undefined;
  /** Minutes (24 hours at most) before the lowest date and time of an occurrence, or a time of its first day. */
  reminders?: Array<ReminderInput> | null | undefined;
  requiredIds?: Array<string | number> | null | undefined;
  /** On or out of calendar schedules, following its rule; null: any time. */
  slotCondition?: unknown;
  startDate?: string | null | undefined;
  /** Travel time back, in minutes; omitted: unchanged. */
  travelAfter?: number | null | undefined;
  /** Travel time there, in minutes; omitted: unchanged. */
  travelBefore?: number | null | undefined;
  /** Null: none. */
  typeId?: string | number | null | undefined;
};

/** An occurrence moved onto a day that has its own: both kept apart (the moved one keeps the day of its rule as its identity), or merged into one. */
export type RoutineSameDayChoice =
  /** Both kept, apart. */
  | 'KEEP_BOTH'
  /** Merged into the occurrence of that day, with the ticks and comments of both. */
  | 'MERGE';

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

export type SavedCountdownInput = {
  color: string;
  /** Its name, unique in the workspace. */
  label: string;
  /** Duration, 1 to 1 440 minutes. */
  minutes: number;
  /** Ringtone of the bank; none: the one of the settings. */
  ringtone?: string | null | undefined;
};

/** Changes of a saved timer (omitted fields unchanged; a null ringtone: the one of the settings). */
export type SavedCountdownPatch = {
  color?: string | null | undefined;
  label?: string | null | undefined;
  minutes?: number | null | undefined;
  ringtone?: string | null | undefined;
};

/** Item saved timers are linked to. */
export type SavedCountdownTarget =
  | 'EVENT'
  | 'ROUTINE'
  | 'SHEET'
  | 'TASK';

/** Color and display of a kind of schedules subscribed to, in this workspace; null: those of the kind. */
export type ScheduleSubscriptionLookInput = {
  color?: string | null | undefined;
  dayBar?: boolean | null | undefined;
  dayDisplay?: string | null | undefined;
  monthDisplay?: string | null | undefined;
};

export type ScheduleTypeInput = {
  /** Éphémérides only: « Sert de contexte au budget ». */
  budgetContext?: boolean | null | undefined;
  color: string;
  dayBar: boolean;
  dayDisplay: string;
  /** A kind of éphémérides; set at its creation only (a conversion changes it). */
  ephemeris?: boolean | null | undefined;
  label: string;
  monthDisplay: string;
  /** Budget context only: « Partagé entre espaces ». */
  sharedContext?: boolean | null | undefined;
  /** « Indisponible »: nothing is scheduled during the slots of its schedules (they take it). */
  unavailable?: boolean | null | undefined;
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

export type SettingsItemLookInput = {
  /** New color; null: none (where the list allows it). */
  color?: string | null | undefined;
  /** Replaces the current image. */
  icon?: File | null | undefined;
  removeIcon?: boolean | null | undefined;
};

/** Settings list sharing the same look (color, image, label) and manual order. */
export type SettingsListKind =
  | 'CALENDAR'
  | 'CALENDAR_CATEGORY'
  | 'DOCUMENT_STATUS'
  | 'MAIL_LABEL'
  | 'PLACE'
  | 'PROJECT_CATEGORY'
  | 'PROJECT_STATUS'
  | 'ROUTINE_CATEGORY'
  | 'SAVED_COUNTDOWN'
  | 'SCHEDULE_TYPE'
  | 'SHEET_CATEGORY'
  | 'SHOPPING_BASE_LIST'
  | 'SHOPPING_CATEGORY'
  | 'SHOPPING_STORAGE'
  | 'SHOPPING_STORE'
  | 'SHOPPING_UNIT'
  | 'STOCK_LOCATION'
  | 'TASK_AUTOMATION'
  | 'TASK_PRIORITY'
  | 'TASK_STATUS'
  | 'TASK_TAG'
  | 'TASK_TYPE'
  | 'TREASURY_ACCOUNT'
  | 'TREASURY_CATEGORY'
  | 'TREASURY_COUNTERPARTY'
  | 'TREASURY_PAYMENT_METHOD';

export type SheetInput = {
  categoryIds: Array<string | number>;
  label: string;
  note?: string | null | undefined;
  projectId?: string | number | null | undefined;
};

export type SheetItemInput = {
  categoryId?: string | number | null | undefined;
  consumable?: boolean | null | undefined;
  id?: string | number | null | undefined;
  label: string;
  memberIds?: Array<string | number> | null | undefined;
  note?: string | null | undefined;
  optional?: boolean | null | undefined;
  perishable?: boolean | null | undefined;
  productId?: string | number | null | undefined;
  quantity?: number | null | undefined;
  relationIds?: Array<string | number> | null | undefined;
  storageId?: string | number | null | undefined;
  storeId?: string | number | null | undefined;
  unit?: string | null | undefined;
  url?: string | null | undefined;
};

export type SheetLinkInput = {
  multiplier: number;
  sheetId: string | number;
};

export type ShoppingCategoryInput = {
  baseListIds?: Array<string | number> | null | undefined;
  color?: string | null | undefined;
  label: string;
  parentId?: string | number | null | undefined;
};

export type ShoppingDeliveryInput = {
  address?: string | null | undefined;
  itemIds: Array<string | number>;
  label?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
  pickup: boolean;
  trackingUrl?: string | null | undefined;
  windowFrom?: string | null | undefined;
  windowTo?: string | null | undefined;
};

export type ShoppingItemInput = {
  categoryId?: string | number | null | undefined;
  expiresAt?: string | null | undefined;
  label: string;
  memberIds: Array<string | number>;
  note?: string | null | undefined;
  /** Not needed: bought if possible. */
  optional?: boolean | null | undefined;
  perishable?: boolean | null | undefined;
  quantity?: number | null | undefined;
  relationIds: Array<string | number>;
  storageId?: string | number | null | undefined;
  storeId?: string | number | null | undefined;
  unit?: string | null | undefined;
  unitPrice?: number | null | undefined;
  url?: string | null | undefined;
};

export type ShoppingOrderInput = {
  deliveryAddress?: string | null | undefined;
  deliveryLat?: number | null | undefined;
  deliveryLon?: number | null | undefined;
  remote: boolean;
};

export type ShoppingProductInput = {
  baseListId: string | number;
  categoryId?: string | number | null | undefined;
  expiresAt?: string | null | undefined;
  label: string;
  memberIds: Array<string | number>;
  missing: boolean;
  note?: string | null | undefined;
  perishable?: boolean | null | undefined;
  quantity?: number | null | undefined;
  relationIds: Array<string | number>;
  storageId?: string | number | null | undefined;
  storeId?: string | number | null | undefined;
  unit?: string | null | undefined;
  unitPrice?: number | null | undefined;
  url?: string | null | undefined;
};

export type SprintInput = {
  endDate: string;
  goal?: string | null | undefined;
  label: string;
  startDate: string;
};

export type StockCountInput = {
  lines: Array<StockCountLineInput>;
  locationId?: string | number | null | undefined;
  note?: string | null | undefined;
};

export type StockCountLineInput = {
  counted: number;
  itemId: string | number;
};

export type StockItemInput = {
  categoryId?: string | number | null | undefined;
  /** New item: the date of its first lot. */
  expiresAt?: string | null | undefined;
  label: string;
  locationId?: string | number | null | undefined;
  memberIds: Array<string | number>;
  note?: string | null | undefined;
  perishable: boolean;
  productId?: string | number | null | undefined;
  /** New item: its quantity to start with. */
  quantity?: number | null | undefined;
  relationIds: Array<string | number>;
  unit?: string | null | undefined;
};

export type StockLocationInput = {
  color?: string | null | undefined;
  label: string;
  parentId?: string | number | null | undefined;
};

export type StockMoveInput = {
  expiresAt?: string | null | undefined;
  itemId: string | number;
  kind: StockMovementKind;
  lotId?: string | number | null | undefined;
  note?: string | null | undefined;
  quantity: number;
};

/** Why a quantity of the stock changed. */
export type StockMovementKind =
  | 'CONSUMPTION'
  | 'CORRECTION'
  | 'COUNT'
  | 'LOSS'
  | 'PURCHASE';

export type StockPurchaseInput = {
  expiresAt?: string | null | undefined;
  locationId?: string | number | null | undefined;
  quantity: number;
  shoppingItemId: string | number;
};

/** Order and hidden columns of a data table. */
export type TableColumnLayoutInput = {
  columnOrder: Array<string>;
  hiddenColumns: Array<string>;
};

export type TaskAutomationInput = {
  /** [{ kind, field, value }], 1 to 20: checked by `taskAutomationActionSchema`. */
  actions: unknown;
  color: string;
  /** Filter of the task table (checked by `taskAutomationConditionSchema`); null or empty: every task. */
  condition?: unknown;
  /** On (default) or off. */
  enabled?: boolean | null | undefined;
  /** Its name, unique in the workspace. */
  label: string;
  /** { event, field, change, value }: checked by `taskAutomationTriggerSchema`. */
  trigger: unknown;
};

/** Changes of a rule (omitted fields unchanged; a null condition: every task). */
export type TaskAutomationPatch = {
  actions?: unknown;
  color?: string | null | undefined;
  condition?: unknown;
  enabled?: boolean | null | undefined;
  label?: string | null | undefined;
  trigger?: unknown;
};

/** How a task is closed: done (COMPLETED) or cancelled (NOT_PLANNED, « Annulée »), as the state reason of a GitHub issue. */
export type TaskCloseReason =
  | 'COMPLETED'
  | 'NOT_PLANNED';

/** Field a sub-task inherits from its parent. */
export type TaskInheritableField =
  | 'ASSIGNEES'
  | 'BENEFICIARIES'
  | 'DEADLINE'
  | 'HOURS'
  | 'LOCATION'
  | 'MILESTONE'
  | 'MIN_DATE'
  | 'PRIORITY'
  | 'PROJECT'
  | 'SLOT_CONDITION';

export type TaskInput = {
  assigneeIds?: Array<string | number> | null | undefined;
  beneficiaryIds?: Array<string | number> | null | undefined;
  beneficiaryRelationIds?: Array<string | number> | null | undefined;
  /** « Temps morts », 20 at most; null: none. */
  deadTimes?: Array<DeadTimeInput> | null | undefined;
  deadline?: string | null | undefined;
  description?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  /** « Horaires »: cases of days and hours, as those of a schedule (20 at most, no overlapping hours); null or empty: any time. */
  hours?: unknown;
  /** Under a parent: the fields it inherits (their values given are ignored); omitted: every field left out of the input. Ignored without parent. */
  inheritedFields?: Array<TaskInheritableField> | null | undefined;
  label: string;
  /** Documents of the library linked to it (50 at most); omitted: unchanged. */
  libraryDocumentIds?: Array<string | number> | null | undefined;
  /** 20 at most, http or https; null: none. */
  links?: Array<ItemLinkInput> | null | undefined;
  /** Null: none (its point too). */
  location?: string | null | undefined;
  /** Point of the location; none: unknown. */
  locationLat?: number | null | undefined;
  locationLon?: number | null | undefined;
  milestoneId?: string | number | null | undefined;
  minDate?: string | null | undefined;
  parentId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  /** None: a task of no project (no number, sprint, milestone nor GitHub item). */
  projectId?: string | number | null | undefined;
  /** Documents of projects linked to it, of its project tree (50 at most); omitted: unchanged. */
  projectResourceIds?: Array<string | number> | null | undefined;
  /** Reminders « À HH:MM » only, 10 at most; null: none. */
  reminders?: Array<ReminderInput> | null | undefined;
  /** On or out of calendar schedules, or on the free time, in groups (and / or); null: any time. */
  slotCondition?: unknown;
  sprintIds?: Array<string | number> | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  tagIds?: Array<string | number> | null | undefined;
  typeId?: string | number | null | undefined;
};

export type TaskLabelInput = {
  /** Statuses only; defaults to TODO. */
  category?: TaskStatusCategory | null | undefined;
  color: string;
  label: string;
};

export type TaskLabelUpdateInput = {
  /** Statuses only. */
  category?: TaskStatusCategory | null | undefined;
  color?: string | null | undefined;
  label?: string | null | undefined;
};

/** Tasks put back in a project by the undo of a transfer. */
export type TaskProjectMoveInput = {
  ids: Array<string | number>;
  /** Project (null: out of any project). */
  projectId?: string | number | null | undefined;
};

/** Fixed meaning of a status, a classification (to do, in progress, done, cancelled): it neither closes nor reopens tasks. */
export type TaskStatusCategory =
  | 'CANCELLED'
  | 'DONE'
  | 'IN_PROGRESS'
  | 'TODO';

/** Omitted fields are left unchanged; null clears a field (a field given a value, null included, becomes its own). Use bulkTransferTasks to change the project. */
export type TaskUpdateInput = {
  assigneeIds?: Array<string | number> | null | undefined;
  beneficiaryIds?: Array<string | number> | null | undefined;
  beneficiaryRelationIds?: Array<string | number> | null | undefined;
  /** Fields emptied on purpose (« Vider »): no value, not inherited (PROJECT refused). A field given a value becomes its own. */
  clear?: Array<TaskInheritableField> | null | undefined;
  /** « Temps morts », 20 at most; null: none. */
  deadTimes?: Array<DeadTimeInput> | null | undefined;
  deadline?: string | null | undefined;
  description?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  /** « Horaires »: cases of days and hours, as those of a schedule (20 at most, no overlapping hours); null or empty: any time. */
  hours?: unknown;
  /** Fields made inherited from its parent again (« Rétablir l’héritage »); a sub-task only. */
  inherit?: Array<TaskInheritableField> | null | undefined;
  label?: string | null | undefined;
  /** Documents of the library linked to it (50 at most); omitted: unchanged. */
  libraryDocumentIds?: Array<string | number> | null | undefined;
  /** 20 at most, http or https; null: none. */
  links?: Array<ItemLinkInput> | null | undefined;
  /** Null: none (its point too). */
  location?: string | null | undefined;
  /** Point of the location; none: unknown. */
  locationLat?: number | null | undefined;
  locationLon?: number | null | undefined;
  milestoneId?: string | number | null | undefined;
  minDate?: string | null | undefined;
  parentId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  /** Documents of projects linked to it, of its project tree (50 at most); omitted: unchanged. */
  projectResourceIds?: Array<string | number> | null | undefined;
  /** Reminders « À HH:MM » only, 10 at most; null: none. */
  reminders?: Array<ReminderInput> | null | undefined;
  /** On or out of calendar schedules, or on the free time, in groups (and / or); null: any time. */
  slotCondition?: unknown;
  sprintIds?: Array<string | number> | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  tagIds?: Array<string | number> | null | undefined;
  typeId?: string | number | null | undefined;
};

export type TaskViewInput = {
  config: unknown;
  /** Tasks (default), routines, shopping lists or another table. */
  kind?: ViewKind | null | undefined;
  label: string;
  /** Project of the view; omitted or null for the home page. */
  projectId?: string | number | null | undefined;
  /** Table of a view of kind TABLE (required for it). */
  tableKey?: string | null | undefined;
};

export type TaskViewUpdateInput = {
  config?: unknown;
  label?: string | null | undefined;
};

/** Why an open task cannot be done now: its « Ouverture » is after today, its hours or its slot condition leave the moment out, a slot « Indisponible » of the workspace holds it, an event keeps its assignees busy. */
export type TaskWaitReason =
  | 'ASSIGNEE_BUSY'
  | 'NOT_OPEN'
  | 'OUTSIDE_HOURS'
  | 'OUTSIDE_SLOTS'
  | 'UNAVAILABLE';

/** At least a project, a task, a routine (the project of the first one by default) or an event. */
export type TimeEntryInput = {
  description?: string | null | undefined;
  /** Seconds. */
  duration: number;
  events?: Array<TimeEventInput> | null | undefined;
  projectId?: string | number | null | undefined;
  routineIds?: Array<string | number> | null | undefined;
  startedAt: string;
  taskIds: Array<string | number>;
};

/** Omitted fields are left unchanged. The duration of the running timer cannot be changed. */
export type TimeEntryUpdateInput = {
  description?: string | null | undefined;
  /** Seconds. */
  duration?: number | null | undefined;
  /** Omitted: unchanged. */
  events?: Array<TimeEventInput> | null | undefined;
  projectId?: string | number | null | undefined;
  /** Omitted: unchanged. */
  routineIds?: Array<string | number> | null | undefined;
  startedAt?: string | null | undefined;
  /** Omitted: unchanged. */
  taskIds?: Array<string | number> | null | undefined;
};

/** Calendar event a time is spent on (its occurrence for a recurring one). */
export type TimeEventInput = {
  eventId: string | number;
  occurrenceDate?: string | null | undefined;
};

/** At least a project, a task, a routine (the project of the first one by default) or an event. */
export type TimerInput = {
  description?: string | null | undefined;
  events?: Array<TimeEventInput> | null | undefined;
  projectId?: string | number | null | undefined;
  routineIds?: Array<string | number> | null | undefined;
  taskIds: Array<string | number>;
};

export type TravelMode =
  | 'BIKE'
  | 'CAR'
  | 'FOOT';

export type TreasuryAccountInput = {
  label: string;
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
  /** Hex color; empty clears it, omitted leaves it. */
  color?: string | null | undefined;
  direction: TreasuryDirection;
  label: string;
  parentId?: string | number | null | undefined;
};

export type TreasuryCounterpartyInput = {
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
  /** Page about it on the internet (an online order…). */
  url?: string | null | undefined;
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

/** Details of a member of the team or household; omitted fields are left unchanged. */
export type TreasuryMemberDetailsInput = {
  /** Birth date: YYYY-MM-DD, or --MM-DD when the year is not known. Its birthday shows in the calendar (query birthdays). Empty: none. */
  birthDate?: string | null | undefined;
  /** Reminders of its birthday « À HH:MM » or « N jours avant, à HH:MM », 10 at most. */
  birthdayReminders?: Array<ReminderInput> | null | undefined;
  /** [{ label, address }]: email addresses, 10 at most. */
  emails?: unknown;
  /** [{ label, number }], 10 at most. */
  phones?: unknown;
};

export type TreasuryPaymentMethodInput = {
  incoming: boolean;
  label: string;
  outgoing: boolean;
};

export type TreasuryRelationInput = {
  /** Birth date: YYYY-MM-DD, or --MM-DD when the year is not known. Its birthday shows in the calendar (query birthdays). Empty: none. */
  birthDate?: string | null | undefined;
  /** Reminders of its birthday « À HH:MM » or « N jours avant, à HH:MM », 10 at most. */
  birthdayReminders?: Array<ReminderInput> | null | undefined;
  /** Contributor this person also is (not a member nor linked to a contact): its details are the relation's. */
  contributorId?: string | number | null | undefined;
  /** [{ label, address }]: email addresses, 10 at most. */
  emails?: unknown;
  name: string;
  note?: string | null | undefined;
  /** [{ label, number }], 10 at most. */
  phones?: unknown;
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

/** What a saved view lists (TABLE: any other table, named by its key). */
export type ViewKind =
  | 'ROUTINES'
  | 'SHOPPING_LISTS'
  | 'TABLE'
  | 'TASKS';

export type WorkScheduleInput = {
  /** Cases (shared schedule case shape). */
  cases: unknown;
  endDate?: string | null | undefined;
  /** Without kind: an éphéméride, not a créneau (with one: that of its kind). */
  ephemeris?: boolean | null | undefined;
  /** Exceptions: { from, to, label, cases }. */
  exceptions: unknown;
  label: string;
  /** Reminders of an éphéméride, 10 at most; omitted: left unchanged. */
  reminders?: Array<ReminderInput> | null | undefined;
  startDate: string;
  /** Kind of time it plans; none: working hours (or, an éphéméride, no kind). */
  typeId?: string | number | null | undefined;
  /** Without kind: « Indisponible », nothing is scheduled during its slots (with one: that of its kind). */
  unavailable?: boolean | null | undefined;
};

export type WorkspaceInput = {
  kind: WorkspaceKind;
  label: string;
};

/** Professional (invoicing, clients, company) or personal workspace. */
export type WorkspaceKind =
  | 'PERSO'
  | 'PRO';

export type TaskViewsQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
  kind?: ViewKind | null | undefined;
  tableKey?: string | null | undefined;
}>;


export type TaskViewsQuery = { taskViews: Array<{ id: string, label: string, config: unknown, isDefault: boolean, position: number }> };

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
  label: string;
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

export type TableColumnDefaultsQueryVariables = Exact<{
  tableKey: string;
}>;


export type TableColumnDefaultsQuery = { tableColumnDefaults: { columnOrder: Array<string>, hiddenColumns: Array<string> } };

export type SetTableColumnDefaultsMutationVariables = Exact<{
  tableKey: string;
  layout?: TableColumnLayoutInput | null | undefined;
}>;


export type SetTableColumnDefaultsMutation = { setTableColumnDefaults: { columnOrder: Array<string>, hiddenColumns: Array<string> } };

export type UploadAttachmentMutationVariables = Exact<{
  file: File;
}>;


export type UploadAttachmentMutation = { uploadAttachment: { id: string, filename: string, url: string, isImage: boolean } };

export type SetSettingsItemLookMutationVariables = Exact<{
  kind: SettingsListKind;
  id: string | number;
  input: SettingsItemLookInput;
}>;


export type SetSettingsItemLookMutation = { setSettingsItemLook: string | null };

export type ReorderSettingsItemsMutationVariables = Exact<{
  kind: SettingsListKind;
  ids: Array<string | number> | string | number;
}>;


export type ReorderSettingsItemsMutation = { reorderSettingsItems: boolean };

export type CatalogItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type CatalogItemsQuery = { catalogItems: Array<{ id: string, kind: AccountingLineKind, label: string, description: string | null, unit: AccountingUnit, unitPrice: number, vatRate: number, archived: boolean }> };

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

export type AccountingDocumentListFieldsFragment = { id: string, archived: boolean, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, label: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, paymentMethods: string | null, balance: number | null, paid: number | null, overdue: boolean, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, depositType: DiscountType | null, depositValue: number | null, trackingStatus: { id: string, archived: boolean, label: string, color: string, category: DocumentStatusCategory } | null, attachments: Array<{ id: string, filename: string, url: string }> };

export type AccountingDocumentFieldsFragment = { serviceStart: string | null, serviceEnd: string | null, serviceId: string | null, contactId: string | null, sourceId: string | null, importedSourceId: string | null, importedSourceNumber: string | null, seller: unknown, buyer: unknown, introduction: string | null, referenceLabel: string | null, referenceValue: string | null, conclusion: string | null, paymentTerms: string | null, paymentMethods: string | null, lateInterest: string | null, depositType: DiscountType | null, depositValue: number | null, billingSchedule: string | null, otherMentions: string | null, showBankDetails: boolean, vatApplicable: boolean, vatExemptionText: string | null, globalDiscountType: DiscountType | null, globalDiscountValue: number | null, totalVat: number, finalizedAt: string | null, updatedAt: string, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, signedFileUrl: string | null, signedFilename: string | null, paid: number | null, credited: number | null, id: string, archived: boolean, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, label: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, derived: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, totalGross: number }>, timeEntries: Array<{ id: string, projectId: string | null, description: string | null, startedAt: string, duration: number | null }>, reminders: Array<{ id: string, date: string, note: string | null }>, payments: Array<{ id: string, amount: number, entry: { id: string, date: string, accountLabel: string, methodLabel: string | null } }>, lines: Array<{ id: string, kind: AccountingLineKind, label: string, description: string | null, quantity: number, unit: AccountingUnit, unitPrice: number, vatRate: number, discountType: DiscountType | null, discountValue: number | null, deductedDocumentId: string | null }>, attachments: Array<{ id: string, filename: string, size: number, url: string }>, trackingStatus: { id: string, archived: boolean, label: string, color: string, category: DocumentStatusCategory } | null };

export type AccountingDocumentsQueryVariables = Exact<{
  clientId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
}>;


export type AccountingDocumentsQuery = { accountingDocuments: Array<{ id: string, archived: boolean, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, label: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, paymentMethods: string | null, balance: number | null, paid: number | null, overdue: boolean, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, depositType: DiscountType | null, depositValue: number | null, trackingStatus: { id: string, archived: boolean, label: string, color: string, category: DocumentStatusCategory } | null, attachments: Array<{ id: string, filename: string, url: string }> }> };

export type AccountingDocumentQueryVariables = Exact<{
  id: string | number;
}>;


export type AccountingDocumentQuery = { accountingDocument: { serviceStart: string | null, serviceEnd: string | null, serviceId: string | null, contactId: string | null, sourceId: string | null, importedSourceId: string | null, importedSourceNumber: string | null, seller: unknown, buyer: unknown, introduction: string | null, referenceLabel: string | null, referenceValue: string | null, conclusion: string | null, paymentTerms: string | null, paymentMethods: string | null, lateInterest: string | null, depositType: DiscountType | null, depositValue: number | null, billingSchedule: string | null, otherMentions: string | null, showBankDetails: boolean, vatApplicable: boolean, vatExemptionText: string | null, globalDiscountType: DiscountType | null, globalDiscountValue: number | null, totalVat: number, finalizedAt: string | null, updatedAt: string, sentAt: string | null, sentVia: string | null, acceptedAt: string | null, signedFileUrl: string | null, signedFilename: string | null, paid: number | null, credited: number | null, id: string, archived: boolean, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, issueDate: string, dueDate: string | null, clientId: string, clientName: string, projectId: string | null, label: string | null, totalNet: number, totalGross: number, currency: string, invoicedNet: number | null, sourceNumber: string | null, recurringId: string | null, balance: number | null, overdue: boolean, derived: Array<{ id: string, type: AccountingDocumentType, status: AccountingDocumentStatus, number: string | null, totalGross: number }>, timeEntries: Array<{ id: string, projectId: string | null, description: string | null, startedAt: string, duration: number | null }>, reminders: Array<{ id: string, date: string, note: string | null }>, payments: Array<{ id: string, amount: number, entry: { id: string, date: string, accountLabel: string, methodLabel: string | null } }>, lines: Array<{ id: string, kind: AccountingLineKind, label: string, description: string | null, quantity: number, unit: AccountingUnit, unitPrice: number, vatRate: number, discountType: DiscountType | null, discountValue: number | null, deductedDocumentId: string | null }>, attachments: Array<{ id: string, filename: string, size: number, url: string }>, trackingStatus: { id: string, archived: boolean, label: string, color: string, category: DocumentStatusCategory } | null } | null };

export type NewDocumentDefaultsQueryVariables = Exact<{
  type: AccountingDocumentType;
  clientId: string | number;
  issueDate: string;
}>;


export type NewDocumentDefaultsQuery = { newDocumentDefaults: unknown };

export type RecurringInvoicesQueryVariables = Exact<{ [key: string]: never; }>;


export type RecurringInvoicesQuery = { recurringInvoices: Array<{ id: string, archived: boolean, label: string, templateId: string, recurrence: unknown, startDate: string, nextDate: string | null, autoFinalize: boolean, active: boolean, issuedCount: number, template: { clientName: string, totalGross: number, currency: string } }> };

export type ProjectResourcesQueryVariables = Exact<{
  projectId: string | number;
}>;


export type ProjectResourcesQuery = { projectResources: Array<{ id: string, kind: ProjectResourceKind, label: string, note: string | null, url: string, size: number | null, createdAt: string }> };

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

export type SetAccountingDocumentProjectMutationVariables = Exact<{
  id: string | number;
  projectId?: string | number | null | undefined;
}>;


export type SetAccountingDocumentProjectMutation = { setAccountingDocumentProject: boolean };

export type SetImportedDocumentProjectMutationVariables = Exact<{
  id: string | number;
  projectId?: string | number | null | undefined;
}>;


export type SetImportedDocumentProjectMutation = { setImportedDocumentProject: boolean };

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
  label: string;
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
  label: string;
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

export type ImportedDocumentFieldsFragment = { id: string, archived: boolean, type: AccountingDocumentType, number: string, issueDate: string, dueDate: string | null, clientId: string | null, clientName: string, projectId: string | null, label: string | null, totalNet: number, totalVat: number, totalGross: number, currency: string, note: string | null, fileUrl: string | null, filename: string | null, settled: boolean, paid: number | null, balance: number | null, fileMimeType: string | null, sentAt: string | null, sentVia: string | null, trackingStatus: { id: string, archived: boolean, label: string, color: string, category: DocumentStatusCategory } | null };

export type ImportedDocumentsQueryVariables = Exact<{
  clientId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
}>;


export type ImportedDocumentsQuery = { importedDocuments: Array<{ id: string, archived: boolean, type: AccountingDocumentType, number: string, issueDate: string, dueDate: string | null, clientId: string | null, clientName: string, projectId: string | null, label: string | null, totalNet: number, totalVat: number, totalGross: number, currency: string, note: string | null, fileUrl: string | null, filename: string | null, settled: boolean, paid: number | null, balance: number | null, fileMimeType: string | null, sentAt: string | null, sentVia: string | null, trackingStatus: { id: string, archived: boolean, label: string, color: string, category: DocumentStatusCategory } | null }> };

export type ImportedDocumentQueryVariables = Exact<{
  id: string | number;
}>;


export type ImportedDocumentQuery = { importedDocument: { id: string, archived: boolean, type: AccountingDocumentType, number: string, issueDate: string, dueDate: string | null, clientId: string | null, clientName: string, projectId: string | null, label: string | null, totalNet: number, totalVat: number, totalGross: number, currency: string, note: string | null, fileUrl: string | null, filename: string | null, settled: boolean, paid: number | null, balance: number | null, fileMimeType: string | null, sentAt: string | null, sentVia: string | null, trackingStatus: { id: string, archived: boolean, label: string, color: string, category: DocumentStatusCategory } | null } | null };

export type MarkImportedDocumentSentMutationVariables = Exact<{
  id: string | number;
  date?: string | null | undefined;
  via?: string | null | undefined;
  statusId: string | number;
}>;


export type MarkImportedDocumentSentMutation = { markImportedDocumentSent: boolean };

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


export type ClientBillingQuery = { client: { id: string, name: string, archived: boolean, kind: ClientKind, firstName: string | null, lastName: string | null, address: unknown, email: string | null, phones: unknown, website: string | null, vatNumber: string | null, siren: string | null, siret: string | null, activityCode: string | null, services: Array<{ id: string, label: string, address: unknown, email: string | null, phones: unknown }>, contacts: Array<{ id: string, serviceId: string | null, firstName: string, lastName: string, email: string | null, jobTitle: string | null, phones: unknown, archived: boolean }> } | null };

export type ClientContactsQueryVariables = Exact<{ [key: string]: never; }>;


export type ClientContactsQuery = { clientContacts: Array<{ id: string, firstName: string, lastName: string, email: string | null, phones: unknown, archived: boolean, client: { id: string, name: string, archived: boolean } }> };

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

export type DocumentStatusesQueryVariables = Exact<{ [key: string]: never; }>;


export type DocumentStatusesQuery = { documentStatuses: Array<{ id: string, archived: boolean, scope: DocumentStatusScope, label: string, color: string, iconUrl: string | null, category: DocumentStatusCategory, position: number, documentCount: number }> };

export type OverdueInvoicesQueryVariables = Exact<{
  today: string;
}>;


export type OverdueInvoicesQuery = { overdueInvoices: Array<{ id: string, archived: boolean, type: AccountingDocumentType, number: string | null, clientId: string, clientName: string, projectId: string | null, contactId: string | null, serviceId: string | null, issueDate: string, dueDate: string | null, sentAt: string | null, sentVia: string | null, totalGross: number, currency: string, balance: number | null, billingEmail: string | null, reminderCount: number, lastReminderAt: string | null }> };

export type SendDocumentRemindersMutationVariables = Exact<{
  accountId: string | number;
  documentIds: Array<string | number> | string | number;
}>;


export type SendDocumentRemindersMutation = { sendDocumentReminders: Array<{ documentId: string, number: string, error: string | null }> };

export type CreateDocumentStatusMutationVariables = Exact<{
  scope: DocumentStatusScope;
  label: string;
  color: string;
  category: DocumentStatusCategory;
}>;


export type CreateDocumentStatusMutation = { createDocumentStatus: string };

export type UpdateDocumentStatusMutationVariables = Exact<{
  id: string | number;
  label?: string | null | undefined;
  color?: string | null | undefined;
  category?: DocumentStatusCategory | null | undefined;
}>;


export type UpdateDocumentStatusMutation = { updateDocumentStatus: boolean };

export type DeleteDocumentStatusMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteDocumentStatusMutation = { deleteDocumentStatus: boolean };

export type SetDocumentTrackingStatusMutationVariables = Exact<{
  id: string | number;
  statusId: string | number;
}>;


export type SetDocumentTrackingStatusMutation = { setDocumentTrackingStatus: boolean };

export type MarkDocumentSentMutationVariables = Exact<{
  id: string | number;
  date?: string | null | undefined;
  via?: string | null | undefined;
  statusId?: string | number | null | undefined;
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

export type ReminderFieldsFragment = { before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null };

export type AlarmRingFieldsFragment = { id: string, key: string, workspaceId: string | null, title: string, lines: Array<string>, path: string | null, linkLabel: string | null, ringtone: string | null, dueAt: string, ringingSince: string | null, nextAt: string | null, stoppedAt: string | null };

export type AlarmRingsQueryVariables = Exact<{ [key: string]: never; }>;


export type AlarmRingsQuery = { alarmRings: Array<{ id: string, key: string, workspaceId: string | null, title: string, lines: Array<string>, path: string | null, linkLabel: string | null, ringtone: string | null, dueAt: string, ringingSince: string | null, nextAt: string | null, stoppedAt: string | null }> };

export type RingAlarmMutationVariables = Exact<{
  input: AlarmRingInput;
}>;


export type RingAlarmMutation = { ringAlarm: { id: string, key: string, workspaceId: string | null, title: string, lines: Array<string>, path: string | null, linkLabel: string | null, ringtone: string | null, dueAt: string, ringingSince: string | null, nextAt: string | null, stoppedAt: string | null } };

export type SnoozeAlarmRingMutationVariables = Exact<{
  key: string;
}>;


export type SnoozeAlarmRingMutation = { snoozeAlarmRing: { id: string, key: string, workspaceId: string | null, title: string, lines: Array<string>, path: string | null, linkLabel: string | null, ringtone: string | null, dueAt: string, ringingSince: string | null, nextAt: string | null, stoppedAt: string | null } | null };

export type StopAlarmRingMutationVariables = Exact<{
  key: string;
}>;


export type StopAlarmRingMutation = { stopAlarmRing: boolean };

export type AlarmFieldsFragment = { id: string, label: string, note: string | null, type: AlarmType, startDate: string | null, time: string | null, frequency: AlarmFrequency, interval: number, weekdays: Array<number>, endDate: string | null, recurrence: unknown, minutes: number | null, projectId: string | null, taskId: string | null, enabled: boolean, lastFiredAt: string | null, createdAt: string };

export type AlarmsQueryVariables = Exact<{ [key: string]: never; }>;


export type AlarmsQuery = { alarms: Array<{ id: string, label: string, note: string | null, type: AlarmType, startDate: string | null, time: string | null, frequency: AlarmFrequency, interval: number, weekdays: Array<number>, endDate: string | null, recurrence: unknown, minutes: number | null, projectId: string | null, taskId: string | null, enabled: boolean, lastFiredAt: string | null, createdAt: string }> };

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

export type PushConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type PushConfigQuery = { pushPublicKey: string | null, pushSubscriptions: Array<{ id: string, endpoint: string, label: string, createdAt: string, lastSuccessAt: string | null }> };

export type RegisterPushSubscriptionMutationVariables = Exact<{
  input: PushSubscriptionInput;
}>;


export type RegisterPushSubscriptionMutation = { registerPushSubscription: { id: string } };

export type RemovePushSubscriptionMutationVariables = Exact<{
  id: string | number;
}>;


export type RemovePushSubscriptionMutation = { removePushSubscription: boolean };

export type TestPushSubscriptionMutationVariables = Exact<{
  id: string | number;
}>;


export type TestPushSubscriptionMutation = { testPushSubscription: boolean };

export type AccountUserFragment = { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null, ringSettings: { ringMinutes: number, loop: boolean, repeatMinutes: number, ringtone: string, outside: boolean } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null, ringSettings: { ringMinutes: number, loop: boolean, repeatMinutes: number, ringtone: string, outside: boolean } } | null };

export type LoginMutationVariables = Exact<{
  identifier: string;
  password: string;
}>;


export type LoginMutation = { login: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null, ringSettings: { ringMinutes: number, loop: boolean, repeatMinutes: number, ringtone: string, outside: boolean } } };

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

export type UpdateRingSettingsMutationVariables = Exact<{
  input: RingSettingsInput;
}>;


export type UpdateRingSettingsMutation = { updateRingSettings: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null, ringSettings: { ringMinutes: number, loop: boolean, repeatMinutes: number, ringtone: string, outside: boolean } } };

export type ChangeUsernameMutationVariables = Exact<{
  currentPassword: string;
  username: string;
}>;


export type ChangeUsernameMutation = { changeUsername: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null, ringSettings: { ringMinutes: number, loop: boolean, repeatMinutes: number, ringtone: string, outside: boolean } } };

export type RequestEmailChangeMutationVariables = Exact<{
  currentPassword: string;
  email: string;
}>;


export type RequestEmailChangeMutation = { requestEmailChange: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null, ringSettings: { ringMinutes: number, loop: boolean, repeatMinutes: number, ringtone: string, outside: boolean } } };

export type CancelEmailChangeMutationVariables = Exact<{ [key: string]: never; }>;


export type CancelEmailChangeMutation = { cancelEmailChange: { id: string, username: string, email: string, pendingEmail: string | null, contributorId: string | null, ringSettings: { ringMinutes: number, loop: boolean, repeatMinutes: number, ringtone: string, outside: boolean } } };

export type CalendarEventOccurrenceFieldsFragment = { key: string, eventId: string, occurrenceDate: string | null, modified: boolean, label: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, start: string, end: string, recurrence: unknown, seriesStartDate: string, travelBefore: number, travelAfter: number, projectId: string | null, calendarId: string, archived: boolean, contributorIds: Array<string>, relationIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, categoryIds: Array<string>, taskIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, savedCountdownIds: Array<string>, calledOff: boolean, trackedSeconds: number, links: Array<{ url: string, label: string }>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, routineLinks: Array<{ routineId: string, date: string, shownDate: string }>, postponedFrom: { eventId: string, date: string | null, label: string } | null, postponedTo: Array<{ eventId: string, label: string, startDate: string, startTime: string | null }>, series: { label: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, travelBefore: number, travelAfter: number, links: Array<{ url: string, label: string }> } | null };

export type WorkSchedulesQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkSchedulesQuery = { workSchedules: Array<{ id: string, archived: boolean, label: string, startDate: string, endDate: string | null, typeId: string | null, ephemeris: boolean, unavailable: boolean, cases: unknown, exceptions: unknown, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> }>, scheduleTypes: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string, ephemeris: boolean, unavailable: boolean, budgetContext: boolean, sharedContext: boolean, position: number }>, defaultScheduleKind: { label: string, color: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string }, birthdayLook: { shown: boolean, color: string | null } };

export type ForeignScheduleKindsQueryVariables = Exact<{ [key: string]: never; }>;


export type ForeignScheduleKindsQuery = { foreignScheduleKinds: Array<{ workspaceId: string, workspaceLabel: string, typeId: string | null, label: string, color: string | null, sourceColor: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string, customized: boolean, scheduleCount: number, subscribed: boolean, archived: boolean, ephemeris: boolean, unavailable: boolean }> };

export type SubscribedWorkSchedulesQueryVariables = Exact<{ [key: string]: never; }>;


export type SubscribedWorkSchedulesQuery = { subscribedWorkSchedules: Array<{ id: string, label: string, startDate: string, endDate: string | null, cases: unknown, exceptions: unknown, typeLabel: string | null, typeId: string | null, ephemeris: boolean, color: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string, workspaceId: string, workspaceLabel: string }> };

export type OtherWorkspaceSchedulesQueryVariables = Exact<{ [key: string]: never; }>;


export type OtherWorkspaceSchedulesQuery = { otherWorkspaceSchedules: Array<{ id: string, archived: boolean, label: string, startDate: string, endDate: string | null, cases: unknown, exceptions: unknown, typeId: string | null, ephemeris: boolean, unavailable: boolean, workspaceId: string, workspaceLabel: string }> };

export type CreateScheduleTypeMutationVariables = Exact<{
  input: ScheduleTypeInput;
}>;


export type CreateScheduleTypeMutation = { createScheduleType: { id: string } };

export type UpdateScheduleTypeMutationVariables = Exact<{
  id: string | number;
  input: ScheduleTypeInput;
  confirmLoss?: boolean | null | undefined;
}>;


export type UpdateScheduleTypeMutation = { updateScheduleType: { id: string } };

export type DeleteScheduleTypeMutationVariables = Exact<{
  id: string | number;
  confirmLoss?: boolean | null | undefined;
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


export type SaveDefaultScheduleKindMutation = { saveDefaultScheduleKind: { label: string } };

export type SaveBirthdayLookMutationVariables = Exact<{
  input: BirthdayLookInput;
}>;


export type SaveBirthdayLookMutation = { saveBirthdayLook: { shown: boolean } };

export type SetScheduleSubscriptionLookMutationVariables = Exact<{
  workspaceId: string | number;
  typeId?: string | number | null | undefined;
  input: ScheduleSubscriptionLookInput;
}>;


export type SetScheduleSubscriptionLookMutation = { setScheduleSubscriptionLook: boolean };

export type SetScheduleSubscriptionUnavailableMutationVariables = Exact<{
  workspaceId: string | number;
  typeId?: string | number | null | undefined;
  unavailable: boolean;
  confirmLoss?: boolean | null | undefined;
}>;


export type SetScheduleSubscriptionUnavailableMutation = { setScheduleSubscriptionUnavailable: boolean };

export type UnsubscribeScheduleKindMutationVariables = Exact<{
  workspaceId: string | number;
  typeId?: string | number | null | undefined;
}>;


export type UnsubscribeScheduleKindMutation = { unsubscribeScheduleKind: boolean };

export type CreateWorkScheduleMutationVariables = Exact<{
  input: WorkScheduleInput;
  confirmLoss?: boolean | null | undefined;
}>;


export type CreateWorkScheduleMutation = { createWorkSchedule: string };

export type UpdateWorkScheduleMutationVariables = Exact<{
  id: string | number;
  input: WorkScheduleInput;
  confirmLoss?: boolean | null | undefined;
}>;


export type UpdateWorkScheduleMutation = { updateWorkSchedule: boolean };

export type SetWorkScheduleEphemerisMutationVariables = Exact<{
  id: string | number;
  ephemeris: boolean;
  confirmLoss?: boolean | null | undefined;
}>;


export type SetWorkScheduleEphemerisMutation = { setWorkScheduleEphemeris: boolean };

export type SetScheduleTypeEphemerisMutationVariables = Exact<{
  id: string | number;
  ephemeris: boolean;
  confirmLoss?: boolean | null | undefined;
}>;


export type SetScheduleTypeEphemerisMutation = { setScheduleTypeEphemeris: boolean };

export type DeleteWorkScheduleMutationVariables = Exact<{
  id: string | number;
  confirmLoss?: boolean | null | undefined;
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


export type CalendarCategoriesQuery = { calendarCategories: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, parentId: string | null, position: number }> };

export type CalendarEventsQueryVariables = Exact<{
  from: string;
  to: string;
}>;


export type CalendarEventsQuery = { calendarEvents: Array<{ key: string, eventId: string, occurrenceDate: string | null, modified: boolean, label: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, start: string, end: string, recurrence: unknown, seriesStartDate: string, travelBefore: number, travelAfter: number, projectId: string | null, calendarId: string, archived: boolean, contributorIds: Array<string>, relationIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, categoryIds: Array<string>, taskIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, savedCountdownIds: Array<string>, calledOff: boolean, trackedSeconds: number, links: Array<{ url: string, label: string }>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, routineLinks: Array<{ routineId: string, date: string, shownDate: string }>, postponedFrom: { eventId: string, date: string | null, label: string } | null, postponedTo: Array<{ eventId: string, label: string, startDate: string, startTime: string | null }>, series: { label: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, travelBefore: number, travelAfter: number, links: Array<{ url: string, label: string }> } | null }>, calendars: Array<{ id: string, archived: boolean }> };

export type CalendarsQueryVariables = Exact<{ [key: string]: never; }>;


export type CalendarsQuery = { calendars: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, calendarSubscriptions: Array<{ id: string, calendarId: string, label: string, color: string, workspace: { id: string, label: string, kind: string } }> };

export type SubscribableCalendarsQueryVariables = Exact<{ [key: string]: never; }>;


export type SubscribableCalendarsQuery = { subscribableCalendars: Array<{ id: string, label: string, color: string, subscribed: boolean, workspace: { id: string, label: string, kind: string } }> };

export type SubscribedCalendarEventsQueryVariables = Exact<{
  from: string;
  to: string;
}>;


export type SubscribedCalendarEventsQuery = { subscribedCalendarEvents: Array<{ key: string, eventId: string, occurrenceDate: string | null, modified: boolean, label: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, start: string, end: string, recurrence: unknown, seriesStartDate: string, travelBefore: number, travelAfter: number, projectId: string | null, calendarId: string, archived: boolean, contributorIds: Array<string>, relationIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, categoryIds: Array<string>, taskIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, savedCountdownIds: Array<string>, calledOff: boolean, trackedSeconds: number, links: Array<{ url: string, label: string }>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, routineLinks: Array<{ routineId: string, date: string, shownDate: string }>, postponedFrom: { eventId: string, date: string | null, label: string } | null, postponedTo: Array<{ eventId: string, label: string, startDate: string, startTime: string | null }>, series: { label: string, description: string | null, location: string | null, allDay: boolean, startDate: string, startTime: string | null, endDate: string, endTime: string | null, travelBefore: number, travelAfter: number, links: Array<{ url: string, label: string }> } | null }> };

export type CreateCalendarMutationVariables = Exact<{
  input: LabelColorInput;
}>;


export type CreateCalendarMutation = { createCalendar: { id: string } };

export type UpdateCalendarMutationVariables = Exact<{
  id: string | number;
  input: LabelColorInput;
}>;


export type UpdateCalendarMutation = { updateCalendar: { id: string } };

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
  parentId?: string | number | null | undefined;
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
  confirmLoss?: boolean | null | undefined;
  movedRule?: unknown;
}>;


export type UpdateCalendarEventMutation = { updateCalendarEvent: string };

export type DeleteCalendarEventMutationVariables = Exact<{
  id: string | number;
  scope: CalendarEventScope;
  occurrenceDate?: string | null | undefined;
}>;


export type DeleteCalendarEventMutation = { deleteCalendarEvent: boolean };

export type BirthdaysQueryVariables = Exact<{ [key: string]: never; }>;


export type BirthdaysQuery = { birthdays: Array<{ id: string, contributorId: string | null, relationId: string | null, name: string, birthDate: string, archived: boolean, aliases: Array<string>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> }> };

export type BirthdayPersonNamesQueryVariables = Exact<{ [key: string]: never; }>;


export type BirthdayPersonNamesQuery = { birthdayPersonNames: Array<{ id: string, name: string, archived: boolean }> };

export type CommentsQueryVariables = Exact<{
  target: CommentTarget;
  id: string;
  occurrenceDate?: string | null | undefined;
}>;


export type CommentsQuery = { comments: Array<{ id: string, body: string, createdAt: string }> };

export type CommentCountsQueryVariables = Exact<{
  target: CommentTarget;
  ids: Array<string> | string;
}>;


export type CommentCountsQuery = { commentCounts: Array<{ id: string, count: number }> };

export type AddCommentMutationVariables = Exact<{
  target: CommentTarget;
  id: string;
  body: string;
  occurrenceDate?: string | null | undefined;
}>;


export type AddCommentMutation = { addComment: { id: string } };

export type UpdateCommentMutationVariables = Exact<{
  id: string | number;
  body: string;
}>;


export type UpdateCommentMutation = { updateComment: { id: string } };

export type DeleteCommentMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteCommentMutation = { deleteComment: boolean };

export type DeadTimeFieldsFragment = { label: string, minutes: number, ringtone: string | null };

export type CountdownFieldsFragment = { id: string, label: string | null, durationSeconds: number, endsAt: string | null, remainingSeconds: number | null, ringtone: string | null, workspaceId: string | null, taskId: string | null, routineId: string | null, eventId: string | null, sheetId: string | null, occurrenceDate: string | null, subject: string | null, path: string | null, linkLabel: string | null, createdAt: string };

export type CountdownsQueryVariables = Exact<{ [key: string]: never; }>;


export type CountdownsQuery = { countdowns: Array<{ id: string, label: string | null, durationSeconds: number, endsAt: string | null, remainingSeconds: number | null, ringtone: string | null, workspaceId: string | null, taskId: string | null, routineId: string | null, eventId: string | null, sheetId: string | null, occurrenceDate: string | null, subject: string | null, path: string | null, linkLabel: string | null, createdAt: string }> };

export type StartCountdownMutationVariables = Exact<{
  input: CountdownInput;
}>;


export type StartCountdownMutation = { startCountdown: { id: string, label: string | null, durationSeconds: number, endsAt: string | null, remainingSeconds: number | null, ringtone: string | null, workspaceId: string | null, taskId: string | null, routineId: string | null, eventId: string | null, sheetId: string | null, occurrenceDate: string | null, subject: string | null, path: string | null, linkLabel: string | null, createdAt: string } };

export type SetCountdownPausedMutationVariables = Exact<{
  id: string | number;
  paused: boolean;
}>;


export type SetCountdownPausedMutation = { setCountdownPaused: { id: string } };

export type ExtendCountdownMutationVariables = Exact<{
  id: string | number;
  minutes: number;
}>;


export type ExtendCountdownMutation = { extendCountdown: { id: string } };

export type RingCountdownMutationVariables = Exact<{
  id: string | number;
}>;


export type RingCountdownMutation = { ringCountdown: boolean };

export type CancelCountdownMutationVariables = Exact<{
  id: string | number;
}>;


export type CancelCountdownMutation = { cancelCountdown: boolean };

export type SavedCountdownFieldsFragment = { id: string, label: string, color: string, iconUrl: string | null, position: number, archived: boolean, minutes: number, ringtone: string | null };

export type SavedCountdownsQueryVariables = Exact<{ [key: string]: never; }>;


export type SavedCountdownsQuery = { savedCountdowns: Array<{ id: string, label: string, color: string, iconUrl: string | null, position: number, archived: boolean, minutes: number, ringtone: string | null }> };

export type CreateSavedCountdownMutationVariables = Exact<{
  input: SavedCountdownInput;
}>;


export type CreateSavedCountdownMutation = { createSavedCountdown: { id: string } };

export type UpdateSavedCountdownMutationVariables = Exact<{
  id: string | number;
  input: SavedCountdownPatch;
}>;


export type UpdateSavedCountdownMutation = { updateSavedCountdown: { id: string } };

export type DeleteSavedCountdownMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteSavedCountdownMutation = { deleteSavedCountdown: boolean };

export type SetSavedCountdownLinksMutationVariables = Exact<{
  target: SavedCountdownTarget;
  id: string | number;
  savedCountdownIds: Array<string | number> | string | number;
}>;


export type SetSavedCountdownLinksMutation = { setSavedCountdownLinks: boolean };

export type SprintTaskStatusesQueryVariables = Exact<{
  today: string;
}>;


export type SprintTaskStatusesQuery = { sprintTaskStatuses: Array<{ sprintId: string, taskId: string, statusId: string | null, closed: boolean }> };

export type DashboardsQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
}>;


export type DashboardsQuery = { dashboards: Array<{ id: string, projectId: string | null, archived: boolean, label: string, position: number, charts: Array<{ id: string, dashboardId: string, label: string, config: unknown, wide: boolean, position: number }> }> };

export type CreateDashboardMutationVariables = Exact<{
  label: string;
  projectId?: string | number | null | undefined;
}>;


export type CreateDashboardMutation = { createDashboard: string };

export type RenameDashboardMutationVariables = Exact<{
  id: string | number;
  label: string;
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

export type LinkedDocumentFieldsFragment = { id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string };

export type DocumentOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type DocumentOptionsQuery = { documentOptions: Array<{ id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string }> };

export type PlacesQueryVariables = Exact<{ [key: string]: never; }>;


export type PlacesQuery = { places: Array<{ id: string, archived: boolean, label: string, address: string, parentId: string | null, lat: number, lon: number, path: string, color: string | null, iconUrl: string | null, position: number }> };

export type SearchAddressesQueryVariables = Exact<{
  text: string;
  near?: GeoPointInput | null | undefined;
}>;


export type SearchAddressesQuery = { searchAddresses: Array<{ address: string, label: string | null, lat: number, lon: number }> };

export type ReverseAddressQueryVariables = Exact<{
  point: GeoPointInput;
}>;


export type ReverseAddressQuery = { reverseAddress: { address: string, label: string | null, lat: number, lon: number } | null };

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

export type MovePlaceMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  index: number;
}>;


export type MovePlaceMutation = { movePlace: boolean };

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


export type GithubBoardQuery = { githubBoard: { id: string, title: string, url: string, fields: Array<{ id: string, name: string, dataType: string, iterationCount: number, issueField: boolean, options: Array<{ id: string, name: string }> }>, issueTypes: Array<{ id: string, name: string }> } };

export type GithubProjectLinkQueryVariables = Exact<{
  projectId: string | number;
}>;


export type GithubProjectLinkQuery = { githubProjectLink: { id: string, projectId: string, url: string, label: string, statusFieldId: string | null, priorityFieldId: string | null, iterationFieldId: string | null, startFieldId: string | null, endFieldId: string | null, effortFieldId: string | null, deadlineFieldId: string | null, timeSpentFieldId: string | null, typeSource: string | null, typeFieldId: string | null, statusOptions: unknown, priorityOptions: unknown, typeOptions: unknown, syncAssignees: boolean, syncLabels: boolean, repositoryName: string | null, pushExisting: boolean, writeIterations: boolean, iterationWriteRefusal: string | null, enabled: boolean, lastSyncAt: string | null, lastSyncError: string | null, lastSyncSummary: unknown, iterationWriteError: string | null, linkedTaskCount: number } | null };

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

export type ResumeGithubIterationsMutationVariables = Exact<{
  projectId: string | number;
}>;


export type ResumeGithubIterationsMutation = { resumeGithubIterations: boolean };

export type UnlinkGithubProjectMutationVariables = Exact<{
  projectId: string | number;
}>;


export type UnlinkGithubProjectMutation = { unlinkGithubProject: boolean };

export type SyncGithubProjectMutationVariables = Exact<{
  projectId: string | number;
}>;


export type SyncGithubProjectMutation = { syncGithubProject: { pulledNew: number, pushedNew: number, pulled: number, pushed: number, unlinked: number, failed: number, sprints: number, sprintsPushed: number, sprintsSkipped: number, sprintsBlocked: number, sprintsUnpaired: number, renumbered: number, comments: number } };

export type SendTasksToGithubMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
}>;


export type SendTasksToGithubMutation = { sendTasksToGithub: { sent: number, errors: Array<string> } };

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

export type ReorderDocumentFolderMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  index: number;
}>;


export type ReorderDocumentFolderMutation = { reorderDocumentFolder: boolean };

export type ReorderLibraryDocumentMutationVariables = Exact<{
  id: string | number;
  folderId?: string | number | null | undefined;
  index: number;
}>;


export type ReorderLibraryDocumentMutation = { reorderLibraryDocument: boolean };

export type DeleteLibraryDocumentsMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
}>;


export type DeleteLibraryDocumentsMutation = { deleteLibraryDocuments: boolean };

export type MailAccountFieldsFragment = { id: string, archived: boolean, label: string, email: string, displayName: string | null, imapHost: string, imapPort: number, imapSecure: boolean, imapUser: string, smtpHost: string, smtpPort: number, smtpSecure: boolean, smtpUser: string, saveSent: boolean, signature: string | null };

export type MailViewFieldsFragment = { accountId: string, folder: string, uid: number, labelIds: Array<string>, done: boolean, messageId: string | null, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, linkedProjectIds: Array<string>, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, replyTo: Array<{ name: string | null, address: string }>, attachments: Array<{ index: number, filename: string, contentType: string, size: number, inline: boolean }> };

export type LinkedMailFieldsFragment = { id: string, projectId: string, accountId: string | null, messageId: string, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, sent: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, attachments: Array<{ id: string, filename: string, size: number, inline: boolean, url: string }> };

export type MailAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type MailAccountsQuery = { mailAccounts: Array<{ id: string, archived: boolean, label: string, email: string, displayName: string | null, imapHost: string, imapPort: number, imapSecure: boolean, imapUser: string, smtpHost: string, smtpPort: number, smtpSecure: boolean, smtpUser: string, saveSent: boolean, signature: string | null }> };

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


export type ProjectMailsQuery = { projectMails: Array<{ id: string, projectId: string, accountId: string | null, messageId: string, inReplyTo: string | null, references: Array<string>, subject: string, date: string, html: string | null, text: string | null, sent: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }>, cc: Array<{ name: string | null, address: string }>, attachments: Array<{ id: string, filename: string, size: number, inline: boolean, url: string }> }> };

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


export type MailLabelsQuery = { mailLabels: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }> };

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
  input: LabelColorInput;
}>;


export type CreateMailLabelMutation = { createMailLabel: { id: string } };

export type UpdateMailLabelMutationVariables = Exact<{
  id: string | number;
  input: LabelColorPatch;
}>;


export type UpdateMailLabelMutation = { updateMailLabel: { id: string } };

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


export type MailSearchesQuery = { mailSearches: Array<{ id: string, label: string, criteria: unknown, position: number }> };

export type MailSearchResultsQueryVariables = Exact<{
  id: string | number;
  page: number;
}>;


export type MailSearchResultsQuery = { mailSearchResults: { total: number, pageSize: number, messages: Array<{ accountId: string, folder: string, folderName: string, uid: number, subject: string, date: string, seen: boolean, flagged: boolean, hasAttachments: boolean, labelIds: Array<string>, done: boolean, from: Array<{ name: string | null, address: string }>, to: Array<{ name: string | null, address: string }> }> } };

export type MailAdvancedSearchQueryVariables = Exact<{
  criteria: unknown;
  page: number;
  sort?: string | null | undefined;
  ascending?: boolean | null | undefined;
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

export type WatchedMailAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type WatchedMailAccountsQuery = { mailAccounts: Array<{ id: string, archived: boolean }> };

export type WatchedUnreadMailsQueryVariables = Exact<{
  accountId: string | number;
}>;


export type WatchedUnreadMailsQuery = { mailMessages: { messages: Array<{ uid: number, subject: string, from: Array<{ name: string | null, address: string }> }> } };

export type ClientFieldsFragment = { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean };

export type LabelFieldsFragment = { id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null };

export type ProjectStatusFieldsFragment = { id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number };

export type ProjectFieldsFragment = { id: string, label: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null }> };

export type ProjectTreeQueryVariables = Exact<{ [key: string]: never; }>;


export type ProjectTreeQuery = { clients: Array<{ id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean }>, projects: Array<{ id: string, label: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null }> }>, projectCategories: Array<{ id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null }>, projectStatuses: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }> };

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


export type CreateProjectMutation = { createProject: { id: string, label: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null }> } };

export type UpdateProjectMutationVariables = Exact<{
  id: string | number;
  input: ProjectUpdateInput;
}>;


export type UpdateProjectMutation = { updateProject: { id: string, label: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null }> } };

export type SetProjectFavoriteMutationVariables = Exact<{
  id: string | number;
  favorite: boolean;
}>;


export type SetProjectFavoriteMutation = { setProjectFavorite: { id: string, label: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null }> } };

export type SetProjectArchivedMutationVariables = Exact<{
  id: string | number;
  archived: boolean;
}>;


export type SetProjectArchivedMutation = { setProjectArchived: { id: string, label: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null }> } };

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
  input: LabelColorInput;
}>;


export type CreateProjectCategoryMutation = { createProjectCategory: { id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null } };

export type UpdateProjectCategoryMutationVariables = Exact<{
  id: string | number;
  input: LabelColorPatch;
}>;


export type UpdateProjectCategoryMutation = { updateProjectCategory: { id: string, archived: boolean, label: string, color: string, position: number, iconUrl: string | null } };

export type DeleteProjectCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectCategoryMutation = { deleteProjectCategory: boolean };

export type CreateProjectStatusMutationVariables = Exact<{
  input: LabelColorInput;
}>;


export type CreateProjectStatusMutation = { createProjectStatus: { id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number } };

export type UpdateProjectStatusMutationVariables = Exact<{
  id: string | number;
  input: LabelColorPatch;
}>;


export type UpdateProjectStatusMutation = { updateProjectStatus: { id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number } };

export type DeleteProjectStatusMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectStatusMutation = { deleteProjectStatus: boolean };

export type RoutinesDataQueryVariables = Exact<{ [key: string]: never; }>;


export type RoutinesDataQuery = { routineCategories: Array<{ id: string, archived: boolean, label: string, color: string | null, iconUrl: string | null, parentId: string | null, position: number }>, routines: Array<{ id: string, label: string, description: string | null, categoryIds: Array<string>, priorityId: string | null, typeId: string | null, parentId: string | null, startDate: string, recurrence: unknown, estimate: number | null, fromTime: string | null, dueTime: string | null, slotCondition: unknown, moments: unknown, savedCountdownIds: Array<string>, cases: unknown, moves: unknown, done: boolean, windowFrom: string | null, windowTo: string | null, location: string | null, locationLat: number | null, locationLon: number | null, travelBefore: number, travelAfter: number, projectId: string | null, position: number, archived: boolean, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, requiredIds: Array<string>, relatedIds: Array<string>, currentDate: string | null, currentDueDate: string | null, firstDate: string | null, nextDate: string | null, nextDueDate: string | null, doneDates: Array<string>, lastDoneAt: string | null, trackedSeconds: number, opensOn: unknown, inheritedFields: Array<RoutineInheritableField>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, deadTimes: Array<{ label: string, minutes: number, ringtone: string | null }>, reminderOccurrences: Array<{ date: string, dueDate: string, day: string, slots: Array<{ slot: number, fromTime: string | null, dueTime: string | null }> }>, slots: Array<{ index: number, fromTime: string | null, dueTime: string | null, optional: boolean, done: boolean, doneAt: string | null, windows: unknown }>, links: Array<{ url: string, label: string }>, inheritance: Array<{ field: string, state: InheritState, source: InheritSource | null, sourceId: string | null }>, effective: { projectId: string | null, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, categoryIds: Array<string>, priorityId: string | null, slotCondition: unknown, opensOn: unknown, location: string | null, locationLat: number | null, locationLon: number | null, startDate: string, recurrence: unknown, cases: unknown, moments: unknown, moves: unknown } }> };

export type CreateRoutineCategoryMutationVariables = Exact<{
  input: RoutineCategoryInput;
}>;


export type CreateRoutineCategoryMutation = { createRoutineCategory: string };

export type UpdateRoutineCategoryMutationVariables = Exact<{
  id: string | number;
  input: RoutineCategoryInput;
}>;


export type UpdateRoutineCategoryMutation = { updateRoutineCategory: boolean };

export type MoveRoutineCategoryMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  index?: number | null | undefined;
}>;


export type MoveRoutineCategoryMutation = { moveRoutineCategory: boolean };

export type DeleteRoutineCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteRoutineCategoryMutation = { deleteRoutineCategory: boolean };

export type CopySubRoutinesMutationVariables = Exact<{
  fromId: string | number;
  toId: string | number;
}>;


export type CopySubRoutinesMutation = { copySubRoutines: number };

export type ConvertTaskToRoutineMutationVariables = Exact<{
  id: string | number;
  confirm?: boolean | null | undefined;
}>;


export type ConvertTaskToRoutineMutation = { convertTaskToRoutine: string };

export type ConvertRoutineToTaskMutationVariables = Exact<{
  id: string | number;
  confirm?: boolean | null | undefined;
}>;


export type ConvertRoutineToTaskMutation = { convertRoutineToTask: string };

export type CreateRoutineMutationVariables = Exact<{
  input: RoutineInput;
  copyOf?: string | number | null | undefined;
}>;


export type CreateRoutineMutation = { createRoutine: string };

export type UpdateRoutineMutationVariables = Exact<{
  id: string | number;
  input: RoutineInput;
  restoring?: boolean | null | undefined;
  confirmLoss?: boolean | null | undefined;
}>;


export type UpdateRoutineMutation = { updateRoutine: { removedLinks: number } };

export type PatchRoutineMutationVariables = Exact<{
  id: string | number;
  input: RoutinePatch;
  confirmLoss?: boolean | null | undefined;
}>;


export type PatchRoutineMutation = { patchRoutine: { removedLinks: number } };

export type MoveRoutineMutationVariables = Exact<{
  id: string | number;
  beforeId?: string | number | null | undefined;
  parentId?: string | number | null | undefined;
  categoryIds?: Array<string | number> | string | number | null | undefined;
  confirmLoss?: boolean | null | undefined;
}>;


export type MoveRoutineMutation = { moveRoutine: boolean };

export type BulkUpdateRoutinesMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  changes: RoutineBulkChanges;
  confirmLoss?: boolean | null | undefined;
}>;


export type BulkUpdateRoutinesMutation = { bulkUpdateRoutines: { removedLinks: number } };

export type BulkSetRoutinesArchivedMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  archived: boolean;
}>;


export type BulkSetRoutinesArchivedMutation = { bulkSetRoutinesArchived: number };

export type BulkSetRoutinesDoneMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  done: boolean;
  doneOn?: string | null | undefined;
  dates?: Array<string> | string | null | undefined;
}>;


export type BulkSetRoutinesDoneMutation = { bulkSetRoutinesDone: number };

export type BulkDeleteRoutinesMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  deleteSubRoutines: boolean;
}>;


export type BulkDeleteRoutinesMutation = { bulkDeleteRoutines: number };

export type SetRoutineDoneMutationVariables = Exact<{
  id: string | number;
  done: boolean;
  date?: string | null | undefined;
  slot?: number | null | undefined;
  doneAt?: string | null | undefined;
}>;


export type SetRoutineDoneMutation = { setRoutineDone: string };

export type MoveRoutineOccurrenceMutationVariables = Exact<{
  id: string | number;
  date: string;
  to: string;
  times?: unknown;
  sameDay?: RoutineSameDayChoice | null | undefined;
}>;


export type MoveRoutineOccurrenceMutation = { moveRoutineOccurrence: string };

export type ChangeRoutineOccurrenceMutationVariables = Exact<{
  id: string | number;
  date: string;
  scope: CalendarEventScope;
  to: string;
  slot: number;
  fromTime?: string | null | undefined;
  dueTime?: string | null | undefined;
  confirmLoss?: boolean | null | undefined;
  sameDay?: RoutineSameDayChoice | null | undefined;
  movedRule?: unknown;
}>;


export type ChangeRoutineOccurrenceMutation = { changeRoutineOccurrence: string };

export type DeleteRoutineOccurrenceMutationVariables = Exact<{
  id: string | number;
  date: string;
  scope: CalendarEventScope;
}>;


export type DeleteRoutineOccurrenceMutation = { deleteRoutineOccurrence: { archived: boolean, comments: Array<{ body: string, createdAt: string, updatedAt: string }> } };

export type RemoveRoutineMoveMutationVariables = Exact<{
  id: string | number;
  from: string;
  comments?: Array<CommentSnapshotInput> | CommentSnapshotInput | null | undefined;
  undo?: boolean | null | undefined;
}>;


export type RemoveRoutineMoveMutation = { removeRoutineMove: boolean };

export type RoutineOccurrencesQueryVariables = Exact<{
  from: string;
  to: string;
  doneInPeriod?: boolean | null | undefined;
}>;


export type RoutineOccurrencesQuery = { routineOccurrences: Array<{ routineId: string, date: string, dueDate: string, startDate: string, shownDate: string, movedFrom: string | null, cancelled: boolean, archived: boolean, slots: Array<{ index: number, fromTime: string | null, dueTime: string | null, optional: boolean, done: boolean, doneAt: string | null, windows: unknown }> }> };

export type SheetsQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
}>;


export type SheetsQuery = { sheets: Array<{ id: string, archived: boolean, label: string, note: string | null, projectId: string | null, categoryIds: Array<string>, position: number, createdAt: string, updatedAt: string, usedBy: number, items: Array<{ id: string, productId: string | null, label: string, categoryId: string | null, quantity: number | null, unit: string | null, note: string | null, consumable: boolean, storeId: string | null, url: string | null, perishable: boolean, storageId: string | null, memberIds: Array<string>, relationIds: Array<string>, optional: boolean, position: number }> }> };

export type SheetQueryVariables = Exact<{
  id: string | number;
}>;


export type SheetQuery = { sheet: { id: string, archived: boolean, label: string, note: string | null, projectId: string | null, categoryIds: Array<string>, savedCountdownIds: Array<string>, usedBy: number, updatedAt: string, items: Array<{ id: string, productId: string | null, label: string, categoryId: string | null, quantity: number | null, unit: string | null, note: string | null, consumable: boolean, storeId: string | null, url: string | null, perishable: boolean, storageId: string | null, memberIds: Array<string>, relationIds: Array<string>, optional: boolean, position: number }> } | null };

export type SheetCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type SheetCategoriesQuery = { sheetCategories: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }> };

export type SheetLinksQueryVariables = Exact<{
  routineId?: string | number | null | undefined;
  eventId?: string | number | null | undefined;
  taskId?: string | number | null | undefined;
}>;


export type SheetLinksQuery = { sheetLinks: Array<{ id: string, sheetId: string, multiplier: number }> };

export type ChecklistQueryVariables = Exact<{
  routineId?: string | number | null | undefined;
  eventId?: string | number | null | undefined;
  taskId?: string | number | null | undefined;
  occurrenceDate?: string | null | undefined;
}>;


export type ChecklistQuery = { checklist: { id: string, routineId: string | null, eventId: string | null, taskId: string | null, occurrenceDate: string | null, items: Array<{ id: string, productId: string | null, label: string, categoryId: string | null, quantity: number | null, unit: string | null, note: string | null, consumable: boolean, checkedAt: string | null, position: number, sources: Array<{ sheetId: string, label: string, quantity: number | null }> }> } | null };

export type CreateSheetMutationVariables = Exact<{
  input: SheetInput;
}>;


export type CreateSheetMutation = { createSheet: string };

export type UpdateSheetMutationVariables = Exact<{
  id: string | number;
  input: SheetInput;
}>;


export type UpdateSheetMutation = { updateSheet: boolean };

export type AddSheetItemMutationVariables = Exact<{
  sheetId: string | number;
  input: SheetItemInput;
}>;


export type AddSheetItemMutation = { addSheetItem: string };

export type AddSheetProductsMutationVariables = Exact<{
  sheetId: string | number;
  productIds: Array<string | number> | string | number;
}>;


export type AddSheetProductsMutation = { addSheetProducts: number };

export type UpdateSheetItemMutationVariables = Exact<{
  id: string | number;
  input: SheetItemInput;
}>;


export type UpdateSheetItemMutation = { updateSheetItem: boolean };

export type DeleteSheetItemsMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
}>;


export type DeleteSheetItemsMutation = { deleteSheetItems: boolean };

export type UseSheetMutationVariables = Exact<{
  id: string | number;
  multiplier: number;
}>;


export type UseSheetMutation = { useSheet: { taken: number, short: Array<string> } };

export type CreateSheetCategoryMutationVariables = Exact<{
  input: LabelColorInput;
}>;


export type CreateSheetCategoryMutation = { createSheetCategory: { id: string } };

export type UpdateSheetCategoryMutationVariables = Exact<{
  id: string | number;
  input: LabelColorPatch;
}>;


export type UpdateSheetCategoryMutation = { updateSheetCategory: { id: string } };

export type DeleteSheetCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteSheetCategoryMutation = { deleteSheetCategory: boolean };

export type DuplicateSheetMutationVariables = Exact<{
  id: string | number;
}>;


export type DuplicateSheetMutation = { duplicateSheet: string };

export type DeleteSheetMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteSheetMutation = { deleteSheet: boolean };

export type AddSheetToShoppingListMutationVariables = Exact<{
  listId: string | number;
  sheetId: string | number;
  multiplier: number;
}>;


export type AddSheetToShoppingListMutation = { addSheetToShoppingList: number };

export type RemoveSheetFromShoppingListMutationVariables = Exact<{
  listId: string | number;
  sheetId: string | number;
}>;


export type RemoveSheetFromShoppingListMutation = { removeSheetFromShoppingList: boolean };

export type SetSheetLinksMutationVariables = Exact<{
  routineId?: string | number | null | undefined;
  eventId?: string | number | null | undefined;
  taskId?: string | number | null | undefined;
  links: Array<SheetLinkInput> | SheetLinkInput;
}>;


export type SetSheetLinksMutation = { setSheetLinks: boolean };

export type ResetChecklistMutationVariables = Exact<{
  id: string | number;
}>;


export type ResetChecklistMutation = { resetChecklist: boolean };

export type AddSheetToChecklistMutationVariables = Exact<{
  id: string | number;
  sheetId: string | number;
  multiplier: number;
}>;


export type AddSheetToChecklistMutation = { addSheetToChecklist: boolean };

export type AddChecklistItemMutationVariables = Exact<{
  listId: string | number;
  input: SheetItemInput;
}>;


export type AddChecklistItemMutation = { addChecklistItem: string };

export type UpdateChecklistItemMutationVariables = Exact<{
  id: string | number;
  input: SheetItemInput;
}>;


export type UpdateChecklistItemMutation = { updateChecklistItem: boolean };

export type SetChecklistItemsCheckedMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  checked: boolean;
}>;


export type SetChecklistItemsCheckedMutation = { setChecklistItemsChecked: boolean };

export type DeleteChecklistItemMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteChecklistItemMutation = { deleteChecklistItem: boolean };

export type ShoppingDataQueryVariables = Exact<{ [key: string]: never; }>;


export type ShoppingDataQuery = { shoppingCategories: Array<{ id: string, archived: boolean, label: string, color: string | null, iconUrl: string | null, parentId: string | null, position: number, baseListIds: Array<string> }>, shoppingStorages: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, shoppingUnits: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, shoppingStores: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, shoppingBaseLists: Array<{ id: string, archived: boolean, label: string, color: string | null, iconUrl: string | null, position: number }>, shoppingProducts: Array<{ id: string, archived: boolean, baseListId: string, label: string, categoryId: string | null, storeId: string | null, url: string | null, note: string | null, quantity: number | null, unit: string | null, unitPrice: number | null, perishable: boolean, storageId: string | null, expiresAt: string | null, missing: boolean, lastPurchasedAt: string | null, lastPrice: number | null, memberIds: Array<string>, relationIds: Array<string>, stockTracked: boolean, consumable: boolean, autoStock: boolean, stockLocationId: string | null }> };

export type ShoppingListsQueryVariables = Exact<{
  taskId?: string | number | null | undefined;
}>;


export type ShoppingListsQuery = { shoppingLists: Array<{ id: string, archived: boolean, label: string, taskIds: Array<string>, entryId: string | null, closed: boolean, closedAt: string | null, remote: boolean, deliveryAddress: string | null, deliveryLat: number | null, deliveryLon: number | null, createdAt: string, entry: { id: string, date: string, label: string, amount: number } | null, deliveries: Array<{ id: string, label: string | null, trackingUrl: string | null, pickup: boolean, windowFrom: string | null, windowTo: string | null, address: string | null, lat: number | null, lon: number | null, receivedAt: string | null, position: number }>, items: Array<{ id: string, listId: string, productId: string | null, label: string, categoryId: string | null, storeId: string | null, url: string | null, note: string | null, quantity: number | null, unit: string | null, unitPrice: number | null, perishable: boolean, storageId: string | null, expiresAt: string | null, purchasedAt: string | null, optional: boolean, deliveryId: string | null, position: number, memberIds: Array<string>, relationIds: Array<string>, sheetSources: Array<{ sheetId: string, label: string, quantity: number | null }> }> }> };

export type CreateShoppingCategoryMutationVariables = Exact<{
  input: ShoppingCategoryInput;
}>;


export type CreateShoppingCategoryMutation = { createShoppingCategory: string };

export type UpdateShoppingCategoryMutationVariables = Exact<{
  id: string | number;
  input: ShoppingCategoryInput;
}>;


export type UpdateShoppingCategoryMutation = { updateShoppingCategory: boolean };

export type DeleteShoppingCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingCategoryMutation = { deleteShoppingCategory: boolean };

export type MoveShoppingCategoryMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  index?: number | null | undefined;
}>;


export type MoveShoppingCategoryMutation = { moveShoppingCategory: boolean };

export type CreateShoppingUnitMutationVariables = Exact<{
  input: LabelColorInput;
}>;


export type CreateShoppingUnitMutation = { createShoppingUnit: { id: string } };

export type UpdateShoppingUnitMutationVariables = Exact<{
  id: string | number;
  input: LabelColorPatch;
}>;


export type UpdateShoppingUnitMutation = { updateShoppingUnit: { id: string } };

export type DeleteShoppingUnitMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingUnitMutation = { deleteShoppingUnit: boolean };

export type MoveShoppingProductsMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  baseListId: string | number;
}>;


export type MoveShoppingProductsMutation = { moveShoppingProducts: number };

export type CreateShoppingStorageMutationVariables = Exact<{
  input: LabelColorInput;
}>;


export type CreateShoppingStorageMutation = { createShoppingStorage: { id: string } };

export type UpdateShoppingStorageMutationVariables = Exact<{
  id: string | number;
  input: LabelColorPatch;
}>;


export type UpdateShoppingStorageMutation = { updateShoppingStorage: { id: string } };

export type DeleteShoppingStorageMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingStorageMutation = { deleteShoppingStorage: boolean };

export type DuplicateShoppingItemMutationVariables = Exact<{
  id: string | number;
}>;


export type DuplicateShoppingItemMutation = { duplicateShoppingItem: string };

export type CreateShoppingStoreMutationVariables = Exact<{
  input: LabelColorInput;
}>;


export type CreateShoppingStoreMutation = { createShoppingStore: { id: string } };

export type UpdateShoppingStoreMutationVariables = Exact<{
  id: string | number;
  input: LabelColorPatch;
}>;


export type UpdateShoppingStoreMutation = { updateShoppingStore: { id: string } };

export type DeleteShoppingStoreMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingStoreMutation = { deleteShoppingStore: boolean };

export type CreateShoppingBaseListMutationVariables = Exact<{
  label: string;
}>;


export type CreateShoppingBaseListMutation = { createShoppingBaseList: string };

export type RenameShoppingBaseListMutationVariables = Exact<{
  id: string | number;
  label: string;
}>;


export type RenameShoppingBaseListMutation = { renameShoppingBaseList: boolean };

export type DeleteShoppingBaseListMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingBaseListMutation = { deleteShoppingBaseList: boolean };

export type CreateShoppingProductMutationVariables = Exact<{
  input: ShoppingProductInput;
}>;


export type CreateShoppingProductMutation = { createShoppingProduct: string };

export type UpdateShoppingProductMutationVariables = Exact<{
  id: string | number;
  input: ShoppingProductInput;
}>;


export type UpdateShoppingProductMutation = { updateShoppingProduct: boolean };

export type SetShoppingProductsMissingMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  missing: boolean;
}>;


export type SetShoppingProductsMissingMutation = { setShoppingProductsMissing: boolean };

export type DeleteShoppingProductMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingProductMutation = { deleteShoppingProduct: boolean };

export type CreateShoppingListMutationVariables = Exact<{
  label: string;
  taskIds: Array<string | number> | string | number;
  baseListIds: Array<string | number> | string | number;
}>;


export type CreateShoppingListMutation = { createShoppingList: string };

export type UpdateShoppingListMutationVariables = Exact<{
  id: string | number;
  label: string;
  taskIds: Array<string | number> | string | number;
}>;


export type UpdateShoppingListMutation = { updateShoppingList: boolean };

export type SetShoppingListClosedMutationVariables = Exact<{
  id: string | number;
  closed: boolean;
}>;


export type SetShoppingListClosedMutation = { setShoppingListClosed: boolean };

export type DuplicateShoppingListMutationVariables = Exact<{
  id: string | number;
}>;


export type DuplicateShoppingListMutation = { duplicateShoppingList: string };

export type DeleteShoppingListMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingListMutation = { deleteShoppingList: boolean };

export type AttachShoppingListEntryMutationVariables = Exact<{
  id: string | number;
  entryId?: string | number | null | undefined;
}>;


export type AttachShoppingListEntryMutation = { attachShoppingListEntry: boolean };

export type AddShoppingItemMutationVariables = Exact<{
  listId: string | number;
  input: ShoppingItemInput;
}>;


export type AddShoppingItemMutation = { addShoppingItem: string };

export type AddShoppingProductsMutationVariables = Exact<{
  listId: string | number;
  productIds: Array<string | number> | string | number;
}>;


export type AddShoppingProductsMutation = { addShoppingProducts: number };

export type UpdateShoppingItemMutationVariables = Exact<{
  id: string | number;
  input: ShoppingItemInput;
}>;


export type UpdateShoppingItemMutation = { updateShoppingItem: boolean };

export type SetShoppingItemPurchasedMutationVariables = Exact<{
  id: string | number;
  purchased: boolean;
}>;


export type SetShoppingItemPurchasedMutation = { setShoppingItemPurchased: boolean };

export type SaveShoppingItemToBaseMutationVariables = Exact<{
  id: string | number;
  baseListId: string | number;
}>;


export type SaveShoppingItemToBaseMutation = { saveShoppingItemToBase: string };

export type DeleteShoppingItemMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingItemMutation = { deleteShoppingItem: boolean };

export type StockLocationsQueryVariables = Exact<{ [key: string]: never; }>;


export type StockLocationsQuery = { stockLocations: Array<{ id: string, archived: boolean, label: string, color: string | null, iconUrl: string | null, parentId: string | null, position: number }> };

export type StockItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type StockItemsQuery = { stockItems: Array<{ id: string, archived: boolean, productId: string | null, label: string, categoryId: string | null, unit: string | null, locationId: string | null, note: string | null, perishable: boolean, position: number, createdAt: string, updatedAt: string, quantity: number, consumable: boolean, memberIds: Array<string>, relationIds: Array<string>, lots: Array<{ id: string, quantity: number, expiresAt: string | null, createdAt: string }> }> };

export type StockMovementsQueryVariables = Exact<{
  itemId?: string | number | null | undefined;
}>;


export type StockMovementsQuery = { stockMovements: Array<{ id: string, itemId: string, itemLabel: string, lotId: string | null, kind: StockMovementKind, quantity: number, date: string, note: string | null, source: string | null, shoppingListId: string | null, sheetId: string | null, countId: string | null }> };

export type StockCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type StockCountsQuery = { stockCounts: Array<{ id: string, date: string, locationId: string | null, note: string | null, lines: number }> };

export type ProductStockQueryVariables = Exact<{ [key: string]: never; }>;


export type ProductStockQuery = { productStock: Array<{ productId: string, quantity: number }> };

export type CreateStockLocationMutationVariables = Exact<{
  input: StockLocationInput;
}>;


export type CreateStockLocationMutation = { createStockLocation: string };

export type UpdateStockLocationMutationVariables = Exact<{
  id: string | number;
  input: StockLocationInput;
}>;


export type UpdateStockLocationMutation = { updateStockLocation: boolean };

export type MoveStockLocationMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  index?: number | null | undefined;
}>;


export type MoveStockLocationMutation = { moveStockLocation: boolean };

export type DeleteStockLocationMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteStockLocationMutation = { deleteStockLocation: boolean };

export type CreateStockItemMutationVariables = Exact<{
  input: StockItemInput;
}>;


export type CreateStockItemMutation = { createStockItem: string };

export type UpdateStockItemMutationVariables = Exact<{
  id: string | number;
  input: StockItemInput;
}>;


export type UpdateStockItemMutation = { updateStockItem: boolean };

export type DeleteStockItemMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteStockItemMutation = { deleteStockItem: boolean };

export type MoveStockMutationVariables = Exact<{
  input: StockMoveInput;
}>;


export type MoveStockMutation = { moveStock: number };

export type SetStockLotExpiryMutationVariables = Exact<{
  id: string | number;
  expiresAt?: string | null | undefined;
}>;


export type SetStockLotExpiryMutation = { setStockLotExpiry: boolean };

export type RecordStockCountMutationVariables = Exact<{
  input: StockCountInput;
}>;


export type RecordStockCountMutation = { recordStockCount: string };

export type SetProductStockMutationVariables = Exact<{
  id: string | number;
  input: ProductStockInput;
}>;


export type SetProductStockMutation = { setProductStock: boolean };

export type AddStockPurchaseMutationVariables = Exact<{
  input: StockPurchaseInput;
}>;


export type AddStockPurchaseMutation = { addStockPurchase: boolean };

export type SetShoppingOrderMutationVariables = Exact<{
  listId: string | number;
  input: ShoppingOrderInput;
}>;


export type SetShoppingOrderMutation = { setShoppingOrder: boolean };

export type CreateShoppingDeliveryMutationVariables = Exact<{
  listId: string | number;
  input: ShoppingDeliveryInput;
}>;


export type CreateShoppingDeliveryMutation = { createShoppingDelivery: string };

export type UpdateShoppingDeliveryMutationVariables = Exact<{
  id: string | number;
  input: ShoppingDeliveryInput;
}>;


export type UpdateShoppingDeliveryMutation = { updateShoppingDelivery: boolean };

export type DeleteShoppingDeliveryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteShoppingDeliveryMutation = { deleteShoppingDelivery: boolean };

export type SetShoppingDeliveryReceivedMutationVariables = Exact<{
  id: string | number;
  received: boolean;
}>;


export type SetShoppingDeliveryReceivedMutation = { setShoppingDeliveryReceived: Array<string> };

export type TaskAutomationFieldsFragment = { id: string, label: string, color: string, iconUrl: string | null, position: number, archived: boolean, enabled: boolean, trigger: unknown, condition: unknown, actions: unknown };

export type TaskAutomationsQueryVariables = Exact<{ [key: string]: never; }>;


export type TaskAutomationsQuery = { taskAutomations: Array<{ id: string, label: string, color: string, iconUrl: string | null, position: number, archived: boolean, enabled: boolean, trigger: unknown, condition: unknown, actions: unknown }> };

export type CreateTaskAutomationMutationVariables = Exact<{
  input: TaskAutomationInput;
}>;


export type CreateTaskAutomationMutation = { createTaskAutomation: { id: string } };

export type UpdateTaskAutomationMutationVariables = Exact<{
  id: string | number;
  input: TaskAutomationPatch;
}>;


export type UpdateTaskAutomationMutation = { updateTaskAutomation: { id: string } };

export type DeleteTaskAutomationMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTaskAutomationMutation = { deleteTaskAutomation: boolean };

export type ContributorFieldsFragment = { id: string, archived: boolean, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string>, link: ContributorLinkKind, relationId: string | null, contactId: string | null, linkName: string | null, birthDate: string | null, emails: unknown, phones: unknown, birthdayReminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> };

export type SprintFieldsFragment = { id: string, archived: boolean, projectId: string, label: string, goal: string | null, startDate: string, endDate: string };

export type MilestoneFieldsFragment = { id: string, archived: boolean, projectId: string, label: string, description: string | null, dueDate: string | null, position: number };

export type TaskLabelFieldsFragment = { id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number };

export type FieldOriginFieldsFragment = { field: string, state: InheritState, source: InheritSource | null, sourceId: string | null };

export type TaskFieldsFragment = { id: string, number: number | null, label: string, description: string | null, projectId: string | null, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, minDate: string | null, effectiveDeadline: string | null, effectiveMinDate: string | null, deadlineSource: InheritSource | null, minDateSource: InheritSource | null, inheritedFields: Array<TaskInheritableField>, cancelled: boolean, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, closed: boolean, closedAt: string | null, closeReason: TaskCloseReason | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null, githubState: GithubTaskState | null, githubSendable: boolean, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, savedCountdownIds: Array<string>, inheritance: Array<{ field: string, state: InheritState, source: InheritSource | null, sourceId: string | null }>, effective: { projectId: string | null, priorityId: string | null, milestoneId: string | null, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, minDate: string | null, deadline: string | null }, links: Array<{ url: string, label: string }>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, deadTimes: Array<{ label: string, minutes: number, ringtone: string | null }> };

export type TaskCommentFieldsFragment = { id: string, body: string, createdAt: string, githubAuthor: string | null };

export type TasksDataQueryVariables = Exact<{ [key: string]: never; }>;


export type TasksDataQuery = { tasks: Array<{ id: string, number: number | null, label: string, description: string | null, projectId: string | null, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, minDate: string | null, effectiveDeadline: string | null, effectiveMinDate: string | null, deadlineSource: InheritSource | null, minDateSource: InheritSource | null, inheritedFields: Array<TaskInheritableField>, cancelled: boolean, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, closed: boolean, closedAt: string | null, closeReason: TaskCloseReason | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null, githubState: GithubTaskState | null, githubSendable: boolean, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, savedCountdownIds: Array<string>, inheritance: Array<{ field: string, state: InheritState, source: InheritSource | null, sourceId: string | null }>, effective: { projectId: string | null, priorityId: string | null, milestoneId: string | null, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, minDate: string | null, deadline: string | null }, links: Array<{ url: string, label: string }>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, deadTimes: Array<{ label: string, minutes: number, ringtone: string | null }> }>, contributors: Array<{ id: string, archived: boolean, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string>, link: ContributorLinkKind, relationId: string | null, contactId: string | null, linkName: string | null, birthDate: string | null, emails: unknown, phones: unknown, birthdayReminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> }>, taskStatuses: Array<{ category: TaskStatusCategory, id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, taskPriorities: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, taskTypes: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, taskTags: Array<{ id: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number }>, milestones: Array<{ id: string, archived: boolean, projectId: string, label: string, description: string | null, dueDate: string | null, position: number }>, sprints: Array<{ id: string, archived: boolean, projectId: string, label: string, goal: string | null, startDate: string, endDate: string }> };

export type TaskCommentsQueryVariables = Exact<{
  id: string | number;
}>;


export type TaskCommentsQuery = { task: { id: string, comments: Array<{ id: string, body: string, createdAt: string, githubAuthor: string | null }> } | null };

export type CreateTaskMutationVariables = Exact<{
  input: TaskInput;
}>;


export type CreateTaskMutation = { createTask: { id: string, number: number | null, label: string, description: string | null, projectId: string | null, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, minDate: string | null, effectiveDeadline: string | null, effectiveMinDate: string | null, deadlineSource: InheritSource | null, minDateSource: InheritSource | null, inheritedFields: Array<TaskInheritableField>, cancelled: boolean, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, closed: boolean, closedAt: string | null, closeReason: TaskCloseReason | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null, githubState: GithubTaskState | null, githubSendable: boolean, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, savedCountdownIds: Array<string>, inheritance: Array<{ field: string, state: InheritState, source: InheritSource | null, sourceId: string | null }>, effective: { projectId: string | null, priorityId: string | null, milestoneId: string | null, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, minDate: string | null, deadline: string | null }, links: Array<{ url: string, label: string }>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, deadTimes: Array<{ label: string, minutes: number, ringtone: string | null }> } };

export type UpdateTaskMutationVariables = Exact<{
  id: string | number;
  input: TaskUpdateInput;
  restoring?: boolean | null | undefined;
}>;


export type UpdateTaskMutation = { updateTask: { id: string, number: number | null, label: string, description: string | null, projectId: string | null, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, sprintIds: Array<string>, deadline: string | null, minDate: string | null, effectiveDeadline: string | null, effectiveMinDate: string | null, deadlineSource: InheritSource | null, minDateSource: InheritSource | null, inheritedFields: Array<TaskInheritableField>, cancelled: boolean, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, libraryDocumentIds: Array<string>, projectResourceIds: Array<string>, tagIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, closed: boolean, closedAt: string | null, closeReason: TaskCloseReason | null, githubLinked: boolean, githubUrl: string | null, githubNumber: number | null, githubState: GithubTaskState | null, githubSendable: boolean, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, savedCountdownIds: Array<string>, inheritance: Array<{ field: string, state: InheritState, source: InheritSource | null, sourceId: string | null }>, effective: { projectId: string | null, priorityId: string | null, milestoneId: string | null, assigneeIds: Array<string>, beneficiaryIds: Array<string>, beneficiaryRelationIds: Array<string>, slotCondition: unknown, hours: unknown, location: string | null, locationLat: number | null, locationLon: number | null, minDate: string | null, deadline: string | null }, links: Array<{ url: string, label: string }>, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, deadTimes: Array<{ label: string, minutes: number, ringtone: string | null }> } };

export type DuplicateTaskMutationVariables = Exact<{
  id: string | number;
  includeSubtasks: boolean;
}>;


export type DuplicateTaskMutation = { duplicateTask: { id: string, number: number | null } };

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
  confirmLoss?: boolean | null | undefined;
}>;


export type CreateContributorMutation = { createContributor: { id: string, archived: boolean, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string>, link: ContributorLinkKind, relationId: string | null, contactId: string | null, linkName: string | null, birthDate: string | null, emails: unknown, phones: unknown, birthdayReminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> } };

export type UpdateContributorMutationVariables = Exact<{
  id: string | number;
  input: ContributorUpdateInput;
  confirmLoss?: boolean | null | undefined;
}>;


export type UpdateContributorMutation = { updateContributor: { id: string, archived: boolean, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string>, link: ContributorLinkKind, relationId: string | null, contactId: string | null, linkName: string | null, birthDate: string | null, emails: unknown, phones: unknown, birthdayReminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> } };

export type SetProjectContributorsMutationVariables = Exact<{
  projectId: string | number;
  contributorIds: Array<string | number> | string | number;
}>;


export type SetProjectContributorsMutation = { setProjectContributors: boolean };

export type DeleteContributorMutationVariables = Exact<{
  id: string | number;
  confirmLoss?: boolean | null | undefined;
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

export type SetTasksClosedMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  closed: boolean;
  reason?: TaskCloseReason | null | undefined;
  restoring?: boolean | null | undefined;
}>;


export type SetTasksClosedMutation = { setTasksClosed: boolean };

export type BulkUpdateTasksMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  changes: BulkTaskInput;
  restoring?: boolean | null | undefined;
}>;


export type BulkUpdateTasksMutation = { bulkUpdateTasks: boolean };

export type BulkTransferTasksMutationVariables = Exact<{
  ids: Array<string | number> | string | number;
  projectId?: string | number | null | undefined;
}>;


export type BulkTransferTasksMutation = { bulkTransferTasks: { removedLinks: number, lost: unknown } };

export type UndoTaskTransferMutationVariables = Exact<{
  moves: Array<TaskProjectMoveInput> | TaskProjectMoveInput;
  links: unknown;
}>;


export type UndoTaskTransferMutation = { undoTaskTransfer: boolean };

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

export type DoableTasksQueryVariables = Exact<{ [key: string]: never; }>;


export type DoableTasksQuery = { doableTasks: Array<{ id: string, reason: TaskWaitReason | null }> };

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

export type TimeEntryFieldsFragment = { id: string, projectId: string | null, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null, routines: Array<{ id: string, label: string }>, events: Array<{ eventId: string, occurrenceDate: string | null, label: string }> };

export type TimeEntriesQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
  since?: string | null | undefined;
}>;


export type TimeEntriesQuery = { timeEntries: Array<{ id: string, projectId: string | null, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null, routines: Array<{ id: string, label: string }>, events: Array<{ eventId: string, occurrenceDate: string | null, label: string }> }> };

export type RunningTimeEntriesQueryVariables = Exact<{ [key: string]: never; }>;


export type RunningTimeEntriesQuery = { runningTimeEntries: Array<{ id: string, projectId: string | null, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string>, documentId: string | null, documentNumber: string | null, routines: Array<{ id: string, label: string }>, events: Array<{ eventId: string, occurrenceDate: string | null, label: string }> }> };

export type StartTimerMutationVariables = Exact<{
  input: TimerInput;
}>;


export type StartTimerMutation = { startTimer: { id: string } };

export type SetTimerPausedMutationVariables = Exact<{
  id: string | number;
  paused: boolean;
}>;


export type SetTimerPausedMutation = { setTimerPaused: { id: string } };

export type StopTimerMutationVariables = Exact<{
  id: string | number;
}>;


export type StopTimerMutation = { stopTimer: { id: string, duration: number | null } | null };

export type StopAllTimersMutationVariables = Exact<{ [key: string]: never; }>;


export type StopAllTimersMutation = { stopAllTimers: Array<{ id: string, duration: number | null }> };

export type CreateTimeEntryMutationVariables = Exact<{
  input: TimeEntryInput;
}>;


export type CreateTimeEntryMutation = { createTimeEntry: { id: string } };

export type UpdateTimeEntryMutationVariables = Exact<{
  id: string | number;
  input: TimeEntryUpdateInput;
}>;


export type UpdateTimeEntryMutation = { updateTimeEntry: { id: string } };

export type LostOnDeleteQueryVariables = Exact<{
  taskIds?: Array<string | number> | string | number | null | undefined;
  routineIds?: Array<string | number> | string | number | null | undefined;
  withSubtree?: boolean | null | undefined;
  eventId?: string | number | null | undefined;
  scope?: CalendarEventScope | null | undefined;
  occurrenceDate?: string | null | undefined;
  calendarId?: string | number | null | undefined;
  routineOccurrence?: RoutineOccurrenceGoneInput | null | undefined;
}>;


export type LostOnDeleteQuery = { lostOnDelete: { times: number, comments: number } };

export type DeleteTimeEntryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTimeEntryMutation = { deleteTimeEntry: boolean };

export type TreasuryEntryFieldsFragment = { id: string, archived: boolean, accountId: string, accountLabel: string, status: TreasuryEntryStatus, date: string, valueDate: string, label: string, amount: number, categoryId: string | null, methodId: string | null, methodLabel: string | null, clientId: string | null, counterpartyId: string | null, payerName: string | null, projectId: string | null, note: string | null, url: string | null, recurrence: unknown, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }>, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number, memberId: string | null, relationId: string | null, loan: boolean, date: string | null, categoryId: string | null, contextId: string | null, projectId: string | null, documents: Array<{ id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string }>, linkedLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }> }>, linkedByLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }>, documents: Array<{ id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string }> };

export type TreasuryAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type TreasuryAccountsQuery = { treasuryAccounts: Array<{ id: string, label: string, color: string | null, iconUrl: string | null, openingBalance: number, openingDate: string, archived: boolean, csvMapping: unknown, entryCount: number, balance: number }> };

export type TreasuryEntriesQueryVariables = Exact<{
  from: string;
  to: string;
  accountId?: string | number | null | undefined;
}>;


export type TreasuryEntriesQuery = { treasuryEntries: Array<{ id: string, archived: boolean, accountId: string, accountLabel: string, status: TreasuryEntryStatus, date: string, valueDate: string, label: string, amount: number, categoryId: string | null, methodId: string | null, methodLabel: string | null, clientId: string | null, counterpartyId: string | null, payerName: string | null, projectId: string | null, note: string | null, url: string | null, recurrence: unknown, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }>, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number, memberId: string | null, relationId: string | null, loan: boolean, date: string | null, categoryId: string | null, contextId: string | null, projectId: string | null, documents: Array<{ id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string }>, linkedLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }> }>, linkedByLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }>, documents: Array<{ id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string }> }> };

export type ForecastEntriesQueryVariables = Exact<{ [key: string]: never; }>;


export type ForecastEntriesQuery = { forecastEntries: Array<{ id: string, archived: boolean, accountId: string, accountLabel: string, status: TreasuryEntryStatus, date: string, valueDate: string, label: string, amount: number, categoryId: string | null, methodId: string | null, methodLabel: string | null, clientId: string | null, counterpartyId: string | null, payerName: string | null, projectId: string | null, note: string | null, url: string | null, recurrence: unknown, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }>, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number, memberId: string | null, relationId: string | null, loan: boolean, date: string | null, categoryId: string | null, contextId: string | null, projectId: string | null, documents: Array<{ id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string }>, linkedLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, linkedEntries: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus }> }>, linkedByLines: Array<{ id: string, entryId: string, entryLabel: string, date: string, label: string | null, amount: number, status: TreasuryEntryStatus }>, allocations: Array<{ id: string, amount: number, documentId: string | null, importedDocumentId: string | null, documentLabel: string }>, documents: Array<{ id: string, source: string, kind: string, label: string, url: string, projectId: string | null, place: string }> }> };

export type TreasuryProjectionQueryVariables = Exact<{
  today: string;
  from: string;
  until: string;
}>;


export type TreasuryProjectionQuery = { treasuryProjection: { balance: number, series: Array<{ date: string, balance: number, forecast: boolean }>, items: Array<{ date: string, dueDate: string, label: string, payerName: string | null, amount: number, kind: string, overdue: boolean, entryId: string | null, documentId: string | null, importedDocumentId: string | null, recurringInvoiceId: string | null, accountId: string | null, archived: boolean }> } };

export type TreasurySettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type TreasurySettingsQuery = { treasuryCategories: Array<{ id: string, archived: boolean, label: string, color: string | null, iconUrl: string | null, direction: TreasuryDirection, parentId: string | null, position: number, entryCount: number }>, treasuryPaymentMethods: Array<{ id: string, archived: boolean, label: string, color: string | null, iconUrl: string | null, position: number, incoming: boolean, outgoing: boolean, entryCount: number }>, treasuryCounterparties: Array<{ id: string, name: string, color: string | null, iconUrl: string | null, position: number, note: string | null, archived: boolean, entryCount: number }>, treasuryMembers: Array<{ id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean }>, treasuryContexts: Array<{ id: string, scheduleTypeId: string, archived: boolean, label: string, color: string, iconUrl: string | null, position: number, workspaceLabel: string | null }>, treasuryRelations: Array<{ id: string, archived: boolean, name: string, note: string | null, contributorId: string | null, birthDate: string | null, emails: unknown, phones: unknown, lineCount: number, budgetCount: number, birthdayReminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> }>, treasuryContextEphemerides: Array<{ contextId: string, schedule: { id: string, label: string, startDate: string, endDate: string | null, cases: unknown, exceptions: unknown } }> };

export type TreasuryEntrySearchQueryVariables = Exact<{
  text: string;
}>;


export type TreasuryEntrySearchQuery = { treasuryEntrySearch: Array<{ id: string, date: string, label: string, amount: number, status: TreasuryEntryStatus, accountLabel: string, lines: Array<{ id: string, label: string | null, mode: TreasuryLineMode, value: number }> }> };

export type CreateTreasuryCategoryMutationVariables = Exact<{
  input: TreasuryCategoryInput;
}>;


export type CreateTreasuryCategoryMutation = { createTreasuryCategory: string };

export type UpdateTreasuryCategoryMutationVariables = Exact<{
  id: string | number;
  input: TreasuryCategoryInput;
}>;


export type UpdateTreasuryCategoryMutation = { updateTreasuryCategory: boolean };

export type MoveTreasuryCategoryMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  index?: number | null | undefined;
}>;


export type MoveTreasuryCategoryMutation = { moveTreasuryCategory: boolean };

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

export type InvoiceTreasuryCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type InvoiceTreasuryCategoriesQuery = { invoiceTreasuryCategories: { invoiceCategoryId: string | null, creditNoteCategoryId: string | null } };

export type SetInvoiceTreasuryCategoriesMutationVariables = Exact<{
  invoiceCategoryId?: string | number | null | undefined;
  creditNoteCategoryId?: string | number | null | undefined;
}>;


export type SetInvoiceTreasuryCategoriesMutation = { setInvoiceTreasuryCategories: boolean };

export type AddTreasuryMemberMutationVariables = Exact<{
  contributorId?: string | number | null | undefined;
  name?: string | null | undefined;
  confirmLoss?: boolean | null | undefined;
}>;


export type AddTreasuryMemberMutation = { addTreasuryMember: string };

export type RemoveTreasuryMemberMutationVariables = Exact<{
  contributorId: string | number;
  confirmLoss?: boolean | null | undefined;
}>;


export type RemoveTreasuryMemberMutation = { removeTreasuryMember: boolean };

export type UpdateTreasuryMemberMutationVariables = Exact<{
  contributorId: string | number;
  input: TreasuryMemberDetailsInput;
  confirmLoss?: boolean | null | undefined;
}>;


export type UpdateTreasuryMemberMutation = { updateTreasuryMember: { id: string } };

export type SaveTreasuryRelationMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: TreasuryRelationInput;
  confirmLoss?: boolean | null | undefined;
}>;


export type SaveTreasuryRelationMutation = { saveTreasuryRelation: string };

export type DeleteTreasuryRelationMutationVariables = Exact<{
  id: string | number;
  confirmLoss?: boolean | null | undefined;
}>;


export type DeleteTreasuryRelationMutation = { deleteTreasuryRelation: boolean };

export type SaveTreasuryContextMutationVariables = Exact<{
  id?: string | number | null | undefined;
  input: LabelColorInput;
}>;


export type SaveTreasuryContextMutation = { saveTreasuryContext: string };

export type TreasuryBudgetsQueryVariables = Exact<{
  from: string;
  to: string;
}>;


export type TreasuryBudgetsQuery = { treasuryBudgets: Array<{ id: string, archived: boolean, month: string, memberId: string | null, relationId: string | null, contextId: string | null, categoryId: string, amount: number, repeatEvery: number | null, repeatUntil: string | null }>, treasuryBudgetReport: Array<{ month: string, memberId: string | null, relationId: string | null, contextId: string | null, categoryId: string | null, budget: number, actual: number, forecast: number, budgeted: boolean }> };

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

export type WorkspacesQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkspacesQuery = { currentWorkspaceId: string, workspaces: Array<{ id: string, label: string, kind: WorkspaceKind, position: number, notifyElsewhere: Array<NotificationSource>, weekStart: number, weekEnd: number }> };

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

export type SetWorkspaceWeekMutationVariables = Exact<{
  id: string | number;
  start: number;
  end: number;
}>;


export type SetWorkspaceWeekMutation = { setWorkspaceWeek: { id: string } };

export type MoveWorkspaceMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveWorkspaceMutation = { moveWorkspace: boolean };

export type DeleteWorkspaceMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteWorkspaceMutation = { deleteWorkspace: boolean };

export type ElsewhereAlarmsQueryVariables = Exact<{ [key: string]: never; }>;


export type ElsewhereAlarmsQuery = { alarms: Array<{ id: string, label: string, note: string | null, type: AlarmType, startDate: string | null, time: string | null, frequency: AlarmFrequency, interval: number, weekdays: Array<number>, endDate: string | null, recurrence: unknown, minutes: number | null, projectId: string | null, taskId: string | null, enabled: boolean, lastFiredAt: string | null, createdAt: string, task: { id: string, number: number | null, label: string, projectId: string | null } | null, project: { id: string, label: string } | null }>, projects: Array<{ id: string, label: string, parentId: string | null }>, runningTimeEntries: Array<{ id: string, projectId: string | null, taskIds: Array<string>, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null }> };

export type ElsewhereRemindersQueryVariables = Exact<{ [key: string]: never; }>;


export type ElsewhereRemindersQuery = { tasks: Array<{ id: string, number: number | null, label: string, projectId: string | null, closed: boolean, archived: boolean, effectiveMinDate: string | null, effectiveDeadline: string | null, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> }>, routines: Array<{ id: string, label: string, archived: boolean, location: string | null, estimate: number | null, currentDate: string | null, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }>, reminderOccurrences: Array<{ date: string, dueDate: string, day: string, slots: Array<{ slot: number, fromTime: string | null, dueTime: string | null }> }>, slots: Array<{ index: number, fromTime: string | null, dueTime: string | null, optional: boolean, done: boolean, doneAt: string | null, windows: unknown }> }>, workSchedules: Array<{ id: string, archived: boolean, label: string, startDate: string, endDate: string | null, typeId: string | null, ephemeris: boolean, cases: unknown, exceptions: unknown, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> }>, birthdays: Array<{ id: string, name: string, birthDate: string, reminders: Array<{ before: number | null, at: string | null, days: number | null, anchor: string, ringtone: string | null }> }> };

export type ElsewhereMarkAlarmFiredMutationVariables = Exact<{
  id: string | number;
  at: string;
}>;


export type ElsewhereMarkAlarmFiredMutation = { markAlarmFired: boolean };

export type SetArchivedMutationVariables = Exact<{
  kind: ArchivableKind;
  ids: Array<string | number> | string | number;
  archived: boolean;
  confirmLoss?: boolean | null | undefined;
}>;


export type SetArchivedMutation = { setArchived: boolean };

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
export const AccountingDocumentListFieldsFragmentDoc = new TypedDocumentString(`
    fragment AccountingDocumentListFields on AccountingDocument {
  id
  archived
  type
  status
  number
  issueDate
  dueDate
  clientId
  clientName
  projectId
  label
  totalNet
  totalGross
  currency
  invoicedNet
  sourceNumber
  recurringId
  trackingStatus {
    id
    archived
    label
    color
    category
  }
  paymentMethods
  balance
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
  attachments {
    id
    filename
    url
  }
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
  signedFilename
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
      accountLabel
      methodLabel
    }
  }
  lines {
    id
    kind
    label
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
    filename
    size
    url
  }
}
    fragment AccountingDocumentListFields on AccountingDocument {
  id
  archived
  type
  status
  number
  issueDate
  dueDate
  clientId
  clientName
  projectId
  label
  totalNet
  totalGross
  currency
  invoicedNet
  sourceNumber
  recurringId
  trackingStatus {
    id
    archived
    label
    color
    category
  }
  paymentMethods
  balance
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
  attachments {
    id
    filename
    url
  }
}`, {"fragmentName":"AccountingDocumentFields"}) as unknown as TypedDocumentString<AccountingDocumentFieldsFragment, unknown>;
export const ImportedDocumentFieldsFragmentDoc = new TypedDocumentString(`
    fragment ImportedDocumentFields on ImportedDocument {
  id
  archived
  type
  number
  issueDate
  dueDate
  clientId
  clientName
  projectId
  label
  totalNet
  totalVat
  totalGross
  currency
  note
  fileUrl
  filename
  settled
  paid
  balance
  trackingStatus {
    id
    archived
    label
    color
    category
  }
  fileMimeType
  sentAt
  sentVia
}
    `, {"fragmentName":"ImportedDocumentFields"}) as unknown as TypedDocumentString<ImportedDocumentFieldsFragment, unknown>;
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
export const AlarmRingFieldsFragmentDoc = new TypedDocumentString(`
    fragment AlarmRingFields on AlarmRing {
  id
  key
  workspaceId
  title
  lines
  path
  linkLabel
  ringtone
  dueAt
  ringingSince
  nextAt
  stoppedAt
}
    `, {"fragmentName":"AlarmRingFields"}) as unknown as TypedDocumentString<AlarmRingFieldsFragment, unknown>;
export const AlarmFieldsFragmentDoc = new TypedDocumentString(`
    fragment AlarmFields on Alarm {
  id
  label
  note
  type
  startDate
  time
  frequency
  interval
  weekdays
  endDate
  recurrence
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
  ringSettings {
    ringMinutes
    loop
    repeatMinutes
    ringtone
    outside
  }
}
    `, {"fragmentName":"AccountUser"}) as unknown as TypedDocumentString<AccountUserFragment, unknown>;
export const ReminderFieldsFragmentDoc = new TypedDocumentString(`
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
    `, {"fragmentName":"ReminderFields"}) as unknown as TypedDocumentString<ReminderFieldsFragment, unknown>;
export const CalendarEventOccurrenceFieldsFragmentDoc = new TypedDocumentString(`
    fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {
  key
  eventId
  occurrenceDate
  modified
  label
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
  start
  end
  recurrence
  seriesStartDate
  reminders {
    ...ReminderFields
  }
  travelBefore
  travelAfter
  projectId
  calendarId
  archived
  contributorIds
  relationIds
  beneficiaryIds
  beneficiaryRelationIds
  categoryIds
  taskIds
  libraryDocumentIds
  projectResourceIds
  savedCountdownIds
  routineLinks {
    routineId
    date
    shownDate
  }
  calledOff
  postponedFrom {
    eventId
    date
    label
  }
  postponedTo {
    eventId
    label
    startDate
    startTime
  }
  trackedSeconds
  series {
    label
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
    travelBefore
    travelAfter
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}`, {"fragmentName":"CalendarEventOccurrenceFields"}) as unknown as TypedDocumentString<CalendarEventOccurrenceFieldsFragment, unknown>;
export const CountdownFieldsFragmentDoc = new TypedDocumentString(`
    fragment CountdownFields on Countdown {
  id
  label
  durationSeconds
  endsAt
  remainingSeconds
  ringtone
  workspaceId
  taskId
  routineId
  eventId
  sheetId
  occurrenceDate
  subject
  path
  linkLabel
  createdAt
}
    `, {"fragmentName":"CountdownFields"}) as unknown as TypedDocumentString<CountdownFieldsFragment, unknown>;
export const SavedCountdownFieldsFragmentDoc = new TypedDocumentString(`
    fragment SavedCountdownFields on SavedCountdown {
  id
  label
  color
  iconUrl
  position
  archived
  minutes
  ringtone
}
    `, {"fragmentName":"SavedCountdownFields"}) as unknown as TypedDocumentString<SavedCountdownFieldsFragment, unknown>;
export const MailAccountFieldsFragmentDoc = new TypedDocumentString(`
    fragment MailAccountFields on MailAccount {
  id
  archived
  label
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
    filename
    size
    inline
    url
  }
}
    `, {"fragmentName":"LinkedMailFields"}) as unknown as TypedDocumentString<LinkedMailFieldsFragment, unknown>;
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
  archived
  label
  color
  iconUrl
  position
}
    `, {"fragmentName":"ProjectStatusFields"}) as unknown as TypedDocumentString<ProjectStatusFieldsFragment, unknown>;
export const LabelFieldsFragmentDoc = new TypedDocumentString(`
    fragment LabelFields on ProjectCategory {
  id
  archived
  label
  color
  position
  iconUrl
}
    `, {"fragmentName":"LabelFields"}) as unknown as TypedDocumentString<LabelFieldsFragment, unknown>;
export const ProjectFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProjectFields on Project {
  id
  label
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
  archived
  label
  color
  position
  iconUrl
}`, {"fragmentName":"ProjectFields"}) as unknown as TypedDocumentString<ProjectFieldsFragment, unknown>;
export const TaskAutomationFieldsFragmentDoc = new TypedDocumentString(`
    fragment TaskAutomationFields on TaskAutomation {
  id
  label
  color
  iconUrl
  position
  archived
  enabled
  trigger
  condition
  actions
}
    `, {"fragmentName":"TaskAutomationFields"}) as unknown as TypedDocumentString<TaskAutomationFieldsFragment, unknown>;
export const ContributorFieldsFragmentDoc = new TypedDocumentString(`
    fragment ContributorFields on Contributor {
  id
  archived
  name
  handle
  avatarUrl
  isMe
  projectIds
  link
  relationId
  contactId
  linkName
  birthDate
  birthdayReminders {
    ...ReminderFields
  }
  emails
  phones
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}`, {"fragmentName":"ContributorFields"}) as unknown as TypedDocumentString<ContributorFieldsFragment, unknown>;
export const SprintFieldsFragmentDoc = new TypedDocumentString(`
    fragment SprintFields on Sprint {
  id
  archived
  projectId
  label
  goal
  startDate
  endDate
}
    `, {"fragmentName":"SprintFields"}) as unknown as TypedDocumentString<SprintFieldsFragment, unknown>;
export const MilestoneFieldsFragmentDoc = new TypedDocumentString(`
    fragment MilestoneFields on Milestone {
  id
  archived
  projectId
  label
  description
  dueDate
  position
}
    `, {"fragmentName":"MilestoneFields"}) as unknown as TypedDocumentString<MilestoneFieldsFragment, unknown>;
export const TaskLabelFieldsFragmentDoc = new TypedDocumentString(`
    fragment TaskLabelFields on TaskStatus {
  id
  archived
  label
  color
  iconUrl
  position
}
    `, {"fragmentName":"TaskLabelFields"}) as unknown as TypedDocumentString<TaskLabelFieldsFragment, unknown>;
export const FieldOriginFieldsFragmentDoc = new TypedDocumentString(`
    fragment FieldOriginFields on FieldOrigin {
  field
  state
  source
  sourceId
}
    `, {"fragmentName":"FieldOriginFields"}) as unknown as TypedDocumentString<FieldOriginFieldsFragment, unknown>;
export const DeadTimeFieldsFragmentDoc = new TypedDocumentString(`
    fragment DeadTimeFields on DeadTime {
  label
  minutes
  ringtone
}
    `, {"fragmentName":"DeadTimeFields"}) as unknown as TypedDocumentString<DeadTimeFieldsFragment, unknown>;
export const TaskFieldsFragmentDoc = new TypedDocumentString(`
    fragment TaskFields on Task {
  id
  number
  label
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
  minDate
  effectiveDeadline
  effectiveMinDate
  deadlineSource
  minDateSource
  inheritedFields
  inheritance {
    ...FieldOriginFields
  }
  effective {
    projectId
    priorityId
    milestoneId
    assigneeIds
    beneficiaryIds
    beneficiaryRelationIds
    slotCondition
    hours
    location
    locationLat
    locationLon
    minDate
    deadline
  }
  cancelled
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  beneficiaryIds
  beneficiaryRelationIds
  libraryDocumentIds
  projectResourceIds
  tagIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  closed
  closedAt
  closeReason
  githubLinked
  githubUrl
  githubNumber
  githubState
  githubSendable
  slotCondition
  hours
  location
  locationLat
  locationLon
  links {
    url
    label
  }
  reminders {
    ...ReminderFields
  }
  deadTimes {
    ...DeadTimeFields
  }
  savedCountdownIds
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment DeadTimeFields on DeadTime {
  label
  minutes
  ringtone
}
fragment FieldOriginFields on FieldOrigin {
  field
  state
  source
  sourceId
}`, {"fragmentName":"TaskFields"}) as unknown as TypedDocumentString<TaskFieldsFragment, unknown>;
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
  routines {
    id
    label
  }
  description
  startedAt
  endedAt
  pausedAt
  pausedSeconds
  duration
  taskIds
  documentId
  documentNumber
  events {
    eventId
    occurrenceDate
    label
  }
}
    `, {"fragmentName":"TimeEntryFields"}) as unknown as TypedDocumentString<TimeEntryFieldsFragment, unknown>;
export const LinkedDocumentFieldsFragmentDoc = new TypedDocumentString(`
    fragment LinkedDocumentFields on LinkedDocument {
  id
  source
  kind
  label
  url
  projectId
  place
}
    `, {"fragmentName":"LinkedDocumentFields"}) as unknown as TypedDocumentString<LinkedDocumentFieldsFragment, unknown>;
export const TreasuryEntryFieldsFragmentDoc = new TypedDocumentString(`
    fragment TreasuryEntryFields on TreasuryEntry {
  id
  archived
  accountId
  accountLabel
  status
  date
  valueDate
  label
  amount
  categoryId
  methodId
  methodLabel
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
      ...LinkedDocumentFields
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
    ...LinkedDocumentFields
  }
}
    fragment LinkedDocumentFields on LinkedDocument {
  id
  source
  kind
  label
  url
  projectId
  place
}`, {"fragmentName":"TreasuryEntryFields"}) as unknown as TypedDocumentString<TreasuryEntryFieldsFragment, unknown>;
export const TaskViewsDocument = new TypedDocumentString(`
    query TaskViews($projectId: ID, $kind: ViewKind, $tableKey: String) {
  taskViews(projectId: $projectId, kind: $kind, tableKey: $tableKey) {
    id
    label
    config
    isDefault
    position
  }
}
    `) as unknown as TypedDocumentString<TaskViewsQuery, TaskViewsQueryVariables>;
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
    mutation DuplicateTaskView($id: ID!, $label: String!) {
  duplicateTaskView(id: $id, label: $label) {
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
export const TableColumnDefaultsDocument = new TypedDocumentString(`
    query TableColumnDefaults($tableKey: String!) {
  tableColumnDefaults(tableKey: $tableKey) {
    columnOrder
    hiddenColumns
  }
}
    `) as unknown as TypedDocumentString<TableColumnDefaultsQuery, TableColumnDefaultsQueryVariables>;
export const SetTableColumnDefaultsDocument = new TypedDocumentString(`
    mutation SetTableColumnDefaults($tableKey: String!, $layout: TableColumnLayoutInput) {
  setTableColumnDefaults(tableKey: $tableKey, layout: $layout) {
    columnOrder
    hiddenColumns
  }
}
    `) as unknown as TypedDocumentString<SetTableColumnDefaultsMutation, SetTableColumnDefaultsMutationVariables>;
export const UploadAttachmentDocument = new TypedDocumentString(`
    mutation UploadAttachment($file: File!) {
  uploadAttachment(file: $file) {
    id
    filename
    url
    isImage
  }
}
    `) as unknown as TypedDocumentString<UploadAttachmentMutation, UploadAttachmentMutationVariables>;
export const SetSettingsItemLookDocument = new TypedDocumentString(`
    mutation SetSettingsItemLook($kind: SettingsListKind!, $id: ID!, $input: SettingsItemLookInput!) {
  setSettingsItemLook(kind: $kind, id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SetSettingsItemLookMutation, SetSettingsItemLookMutationVariables>;
export const ReorderSettingsItemsDocument = new TypedDocumentString(`
    mutation ReorderSettingsItems($kind: SettingsListKind!, $ids: [ID!]!) {
  reorderSettingsItems(kind: $kind, ids: $ids)
}
    `) as unknown as TypedDocumentString<ReorderSettingsItemsMutation, ReorderSettingsItemsMutationVariables>;
export const CatalogItemsDocument = new TypedDocumentString(`
    query CatalogItems {
  catalogItems {
    id
    kind
    label
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
  archived
  type
  status
  number
  issueDate
  dueDate
  clientId
  clientName
  projectId
  label
  totalNet
  totalGross
  currency
  invoicedNet
  sourceNumber
  recurringId
  trackingStatus {
    id
    archived
    label
    color
    category
  }
  paymentMethods
  balance
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
  attachments {
    id
    filename
    url
  }
}`) as unknown as TypedDocumentString<AccountingDocumentsQuery, AccountingDocumentsQueryVariables>;
export const AccountingDocumentDocument = new TypedDocumentString(`
    query AccountingDocument($id: ID!) {
  accountingDocument(id: $id) {
    ...AccountingDocumentFields
  }
}
    fragment AccountingDocumentListFields on AccountingDocument {
  id
  archived
  type
  status
  number
  issueDate
  dueDate
  clientId
  clientName
  projectId
  label
  totalNet
  totalGross
  currency
  invoicedNet
  sourceNumber
  recurringId
  trackingStatus {
    id
    archived
    label
    color
    category
  }
  paymentMethods
  balance
  paid
  overdue
  sentAt
  sentVia
  acceptedAt
  depositType
  depositValue
  attachments {
    id
    filename
    url
  }
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
  signedFilename
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
      accountLabel
      methodLabel
    }
  }
  lines {
    id
    kind
    label
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
    filename
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
    archived
    label
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
    label
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
export const SetAccountingDocumentProjectDocument = new TypedDocumentString(`
    mutation SetAccountingDocumentProject($id: ID!, $projectId: ID) {
  setAccountingDocumentProject(id: $id, projectId: $projectId)
}
    `) as unknown as TypedDocumentString<SetAccountingDocumentProjectMutation, SetAccountingDocumentProjectMutationVariables>;
export const SetImportedDocumentProjectDocument = new TypedDocumentString(`
    mutation SetImportedDocumentProject($id: ID!, $projectId: ID) {
  setImportedDocumentProject(id: $id, projectId: $projectId)
}
    `) as unknown as TypedDocumentString<SetImportedDocumentProjectMutation, SetImportedDocumentProjectMutationVariables>;
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
    mutation AddProjectLink($projectId: ID!, $label: String!, $url: String!, $note: String) {
  addProjectLink(projectId: $projectId, label: $label, url: $url, note: $note)
}
    `) as unknown as TypedDocumentString<AddProjectLinkMutation, AddProjectLinkMutationVariables>;
export const AddProjectFilesDocument = new TypedDocumentString(`
    mutation AddProjectFiles($projectId: ID!, $files: [File!]!) {
  addProjectFiles(projectId: $projectId, files: $files)
}
    `) as unknown as TypedDocumentString<AddProjectFilesMutation, AddProjectFilesMutationVariables>;
export const UpdateProjectResourceDocument = new TypedDocumentString(`
    mutation UpdateProjectResource($id: ID!, $label: String!, $url: String, $note: String) {
  updateProjectResource(id: $id, label: $label, url: $url, note: $note)
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
  archived
  type
  number
  issueDate
  dueDate
  clientId
  clientName
  projectId
  label
  totalNet
  totalVat
  totalGross
  currency
  note
  fileUrl
  filename
  settled
  paid
  balance
  trackingStatus {
    id
    archived
    label
    color
    category
  }
  fileMimeType
  sentAt
  sentVia
}`) as unknown as TypedDocumentString<ImportedDocumentsQuery, ImportedDocumentsQueryVariables>;
export const ImportedDocumentDocument = new TypedDocumentString(`
    query ImportedDocument($id: ID!) {
  importedDocument(id: $id) {
    ...ImportedDocumentFields
  }
}
    fragment ImportedDocumentFields on ImportedDocument {
  id
  archived
  type
  number
  issueDate
  dueDate
  clientId
  clientName
  projectId
  label
  totalNet
  totalVat
  totalGross
  currency
  note
  fileUrl
  filename
  settled
  paid
  balance
  trackingStatus {
    id
    archived
    label
    color
    category
  }
  fileMimeType
  sentAt
  sentVia
}`) as unknown as TypedDocumentString<ImportedDocumentQuery, ImportedDocumentQueryVariables>;
export const MarkImportedDocumentSentDocument = new TypedDocumentString(`
    mutation MarkImportedDocumentSent($id: ID!, $date: Date, $via: String, $statusId: ID!) {
  markImportedDocumentSent(id: $id, date: $date, via: $via, statusId: $statusId)
}
    `) as unknown as TypedDocumentString<MarkImportedDocumentSentMutation, MarkImportedDocumentSentMutationVariables>;
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
    archived
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
      label
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
      archived
    }
  }
}
    `) as unknown as TypedDocumentString<ClientBillingQuery, ClientBillingQueryVariables>;
export const ClientContactsDocument = new TypedDocumentString(`
    query ClientContacts {
  clientContacts {
    id
    firstName
    lastName
    email
    phones
    archived
    client {
      id
      name
      archived
    }
  }
}
    `) as unknown as TypedDocumentString<ClientContactsQuery, ClientContactsQueryVariables>;
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
export const DocumentStatusesDocument = new TypedDocumentString(`
    query DocumentStatuses {
  documentStatuses {
    id
    archived
    scope
    label
    color
    iconUrl
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
    archived
    type
    number
    clientId
    clientName
    projectId
    contactId
    serviceId
    issueDate
    dueDate
    sentAt
    sentVia
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
    mutation CreateDocumentStatus($scope: DocumentStatusScope!, $label: String!, $color: String!, $category: DocumentStatusCategory!) {
  createDocumentStatus(
    scope: $scope
    label: $label
    color: $color
    category: $category
  )
}
    `) as unknown as TypedDocumentString<CreateDocumentStatusMutation, CreateDocumentStatusMutationVariables>;
export const UpdateDocumentStatusDocument = new TypedDocumentString(`
    mutation UpdateDocumentStatus($id: ID!, $label: String, $color: String, $category: DocumentStatusCategory) {
  updateDocumentStatus(id: $id, label: $label, color: $color, category: $category)
}
    `) as unknown as TypedDocumentString<UpdateDocumentStatusMutation, UpdateDocumentStatusMutationVariables>;
export const DeleteDocumentStatusDocument = new TypedDocumentString(`
    mutation DeleteDocumentStatus($id: ID!) {
  deleteDocumentStatus(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteDocumentStatusMutation, DeleteDocumentStatusMutationVariables>;
export const SetDocumentTrackingStatusDocument = new TypedDocumentString(`
    mutation SetDocumentTrackingStatus($id: ID!, $statusId: ID!) {
  setDocumentTrackingStatus(id: $id, statusId: $statusId)
}
    `) as unknown as TypedDocumentString<SetDocumentTrackingStatusMutation, SetDocumentTrackingStatusMutationVariables>;
export const MarkDocumentSentDocument = new TypedDocumentString(`
    mutation MarkDocumentSent($id: ID!, $date: Date, $via: String, $statusId: ID) {
  markDocumentSent(id: $id, date: $date, via: $via, statusId: $statusId)
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
export const AlarmRingsDocument = new TypedDocumentString(`
    query AlarmRings {
  alarmRings {
    ...AlarmRingFields
  }
}
    fragment AlarmRingFields on AlarmRing {
  id
  key
  workspaceId
  title
  lines
  path
  linkLabel
  ringtone
  dueAt
  ringingSince
  nextAt
  stoppedAt
}`) as unknown as TypedDocumentString<AlarmRingsQuery, AlarmRingsQueryVariables>;
export const RingAlarmDocument = new TypedDocumentString(`
    mutation RingAlarm($input: AlarmRingInput!) {
  ringAlarm(input: $input) {
    ...AlarmRingFields
  }
}
    fragment AlarmRingFields on AlarmRing {
  id
  key
  workspaceId
  title
  lines
  path
  linkLabel
  ringtone
  dueAt
  ringingSince
  nextAt
  stoppedAt
}`) as unknown as TypedDocumentString<RingAlarmMutation, RingAlarmMutationVariables>;
export const SnoozeAlarmRingDocument = new TypedDocumentString(`
    mutation SnoozeAlarmRing($key: String!) {
  snoozeAlarmRing(key: $key) {
    ...AlarmRingFields
  }
}
    fragment AlarmRingFields on AlarmRing {
  id
  key
  workspaceId
  title
  lines
  path
  linkLabel
  ringtone
  dueAt
  ringingSince
  nextAt
  stoppedAt
}`) as unknown as TypedDocumentString<SnoozeAlarmRingMutation, SnoozeAlarmRingMutationVariables>;
export const StopAlarmRingDocument = new TypedDocumentString(`
    mutation StopAlarmRing($key: String!) {
  stopAlarmRing(key: $key)
}
    `) as unknown as TypedDocumentString<StopAlarmRingMutation, StopAlarmRingMutationVariables>;
export const AlarmsDocument = new TypedDocumentString(`
    query Alarms {
  alarms {
    ...AlarmFields
  }
}
    fragment AlarmFields on Alarm {
  id
  label
  note
  type
  startDate
  time
  frequency
  interval
  weekdays
  endDate
  recurrence
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
export const PushConfigDocument = new TypedDocumentString(`
    query PushConfig {
  pushPublicKey
  pushSubscriptions {
    id
    endpoint
    label
    createdAt
    lastSuccessAt
  }
}
    `) as unknown as TypedDocumentString<PushConfigQuery, PushConfigQueryVariables>;
export const RegisterPushSubscriptionDocument = new TypedDocumentString(`
    mutation RegisterPushSubscription($input: PushSubscriptionInput!) {
  registerPushSubscription(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<RegisterPushSubscriptionMutation, RegisterPushSubscriptionMutationVariables>;
export const RemovePushSubscriptionDocument = new TypedDocumentString(`
    mutation RemovePushSubscription($id: ID!) {
  removePushSubscription(id: $id)
}
    `) as unknown as TypedDocumentString<RemovePushSubscriptionMutation, RemovePushSubscriptionMutationVariables>;
export const TestPushSubscriptionDocument = new TypedDocumentString(`
    mutation TestPushSubscription($id: ID!) {
  testPushSubscription(id: $id)
}
    `) as unknown as TypedDocumentString<TestPushSubscriptionMutation, TestPushSubscriptionMutationVariables>;
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
  ringSettings {
    ringMinutes
    loop
    repeatMinutes
    ringtone
    outside
  }
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
  ringSettings {
    ringMinutes
    loop
    repeatMinutes
    ringtone
    outside
  }
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
export const UpdateRingSettingsDocument = new TypedDocumentString(`
    mutation UpdateRingSettings($input: RingSettingsInput!) {
  updateRingSettings(input: $input) {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
  contributorId
  ringSettings {
    ringMinutes
    loop
    repeatMinutes
    ringtone
    outside
  }
}`) as unknown as TypedDocumentString<UpdateRingSettingsMutation, UpdateRingSettingsMutationVariables>;
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
  ringSettings {
    ringMinutes
    loop
    repeatMinutes
    ringtone
    outside
  }
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
  ringSettings {
    ringMinutes
    loop
    repeatMinutes
    ringtone
    outside
  }
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
  ringSettings {
    ringMinutes
    loop
    repeatMinutes
    ringtone
    outside
  }
}`) as unknown as TypedDocumentString<CancelEmailChangeMutation, CancelEmailChangeMutationVariables>;
export const WorkSchedulesDocument = new TypedDocumentString(`
    query WorkSchedules {
  workSchedules {
    id
    archived
    label
    startDate
    endDate
    typeId
    ephemeris
    unavailable
    cases
    exceptions
    reminders {
      ...ReminderFields
    }
  }
  scheduleTypes {
    id
    archived
    label
    color
    iconUrl
    dayDisplay
    dayBar
    monthDisplay
    ephemeris
    unavailable
    budgetContext
    sharedContext
    position
  }
  defaultScheduleKind {
    label
    color
    dayDisplay
    dayBar
    monthDisplay
  }
  birthdayLook {
    shown
    color
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}`) as unknown as TypedDocumentString<WorkSchedulesQuery, WorkSchedulesQueryVariables>;
export const ForeignScheduleKindsDocument = new TypedDocumentString(`
    query ForeignScheduleKinds {
  foreignScheduleKinds {
    workspaceId
    workspaceLabel
    typeId
    label
    color
    sourceColor
    dayDisplay
    dayBar
    monthDisplay
    customized
    scheduleCount
    subscribed
    archived
    ephemeris
    unavailable
  }
}
    `) as unknown as TypedDocumentString<ForeignScheduleKindsQuery, ForeignScheduleKindsQueryVariables>;
export const SubscribedWorkSchedulesDocument = new TypedDocumentString(`
    query SubscribedWorkSchedules {
  subscribedWorkSchedules {
    id
    label
    startDate
    endDate
    cases
    exceptions
    typeLabel
    typeId
    ephemeris
    color
    dayDisplay
    dayBar
    monthDisplay
    workspaceId
    workspaceLabel
  }
}
    `) as unknown as TypedDocumentString<SubscribedWorkSchedulesQuery, SubscribedWorkSchedulesQueryVariables>;
export const OtherWorkspaceSchedulesDocument = new TypedDocumentString(`
    query OtherWorkspaceSchedules {
  otherWorkspaceSchedules {
    id
    archived
    label
    startDate
    endDate
    cases
    exceptions
    typeId
    ephemeris
    unavailable
    workspaceId
    workspaceLabel
  }
}
    `) as unknown as TypedDocumentString<OtherWorkspaceSchedulesQuery, OtherWorkspaceSchedulesQueryVariables>;
export const CreateScheduleTypeDocument = new TypedDocumentString(`
    mutation CreateScheduleType($input: ScheduleTypeInput!) {
  createScheduleType(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateScheduleTypeMutation, CreateScheduleTypeMutationVariables>;
export const UpdateScheduleTypeDocument = new TypedDocumentString(`
    mutation UpdateScheduleType($id: ID!, $input: ScheduleTypeInput!, $confirmLoss: Boolean) {
  updateScheduleType(id: $id, input: $input, confirmLoss: $confirmLoss) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateScheduleTypeMutation, UpdateScheduleTypeMutationVariables>;
export const DeleteScheduleTypeDocument = new TypedDocumentString(`
    mutation DeleteScheduleType($id: ID!, $confirmLoss: Boolean) {
  deleteScheduleType(id: $id, confirmLoss: $confirmLoss)
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
    label
  }
}
    `) as unknown as TypedDocumentString<SaveDefaultScheduleKindMutation, SaveDefaultScheduleKindMutationVariables>;
export const SaveBirthdayLookDocument = new TypedDocumentString(`
    mutation SaveBirthdayLook($input: BirthdayLookInput!) {
  saveBirthdayLook(input: $input) {
    shown
  }
}
    `) as unknown as TypedDocumentString<SaveBirthdayLookMutation, SaveBirthdayLookMutationVariables>;
export const SetScheduleSubscriptionLookDocument = new TypedDocumentString(`
    mutation SetScheduleSubscriptionLook($workspaceId: ID!, $typeId: ID, $input: ScheduleSubscriptionLookInput!) {
  setScheduleSubscriptionLook(
    workspaceId: $workspaceId
    typeId: $typeId
    input: $input
  )
}
    `) as unknown as TypedDocumentString<SetScheduleSubscriptionLookMutation, SetScheduleSubscriptionLookMutationVariables>;
export const SetScheduleSubscriptionUnavailableDocument = new TypedDocumentString(`
    mutation SetScheduleSubscriptionUnavailable($workspaceId: ID!, $typeId: ID, $unavailable: Boolean!, $confirmLoss: Boolean) {
  setScheduleSubscriptionUnavailable(
    workspaceId: $workspaceId
    typeId: $typeId
    unavailable: $unavailable
    confirmLoss: $confirmLoss
  )
}
    `) as unknown as TypedDocumentString<SetScheduleSubscriptionUnavailableMutation, SetScheduleSubscriptionUnavailableMutationVariables>;
export const UnsubscribeScheduleKindDocument = new TypedDocumentString(`
    mutation UnsubscribeScheduleKind($workspaceId: ID!, $typeId: ID) {
  unsubscribeScheduleKind(workspaceId: $workspaceId, typeId: $typeId)
}
    `) as unknown as TypedDocumentString<UnsubscribeScheduleKindMutation, UnsubscribeScheduleKindMutationVariables>;
export const CreateWorkScheduleDocument = new TypedDocumentString(`
    mutation CreateWorkSchedule($input: WorkScheduleInput!, $confirmLoss: Boolean) {
  createWorkSchedule(input: $input, confirmLoss: $confirmLoss)
}
    `) as unknown as TypedDocumentString<CreateWorkScheduleMutation, CreateWorkScheduleMutationVariables>;
export const UpdateWorkScheduleDocument = new TypedDocumentString(`
    mutation UpdateWorkSchedule($id: ID!, $input: WorkScheduleInput!, $confirmLoss: Boolean) {
  updateWorkSchedule(id: $id, input: $input, confirmLoss: $confirmLoss)
}
    `) as unknown as TypedDocumentString<UpdateWorkScheduleMutation, UpdateWorkScheduleMutationVariables>;
export const SetWorkScheduleEphemerisDocument = new TypedDocumentString(`
    mutation SetWorkScheduleEphemeris($id: ID!, $ephemeris: Boolean!, $confirmLoss: Boolean) {
  setWorkScheduleEphemeris(
    id: $id
    ephemeris: $ephemeris
    confirmLoss: $confirmLoss
  )
}
    `) as unknown as TypedDocumentString<SetWorkScheduleEphemerisMutation, SetWorkScheduleEphemerisMutationVariables>;
export const SetScheduleTypeEphemerisDocument = new TypedDocumentString(`
    mutation SetScheduleTypeEphemeris($id: ID!, $ephemeris: Boolean!, $confirmLoss: Boolean) {
  setScheduleTypeEphemeris(
    id: $id
    ephemeris: $ephemeris
    confirmLoss: $confirmLoss
  )
}
    `) as unknown as TypedDocumentString<SetScheduleTypeEphemerisMutation, SetScheduleTypeEphemerisMutationVariables>;
export const DeleteWorkScheduleDocument = new TypedDocumentString(`
    mutation DeleteWorkSchedule($id: ID!, $confirmLoss: Boolean) {
  deleteWorkSchedule(id: $id, confirmLoss: $confirmLoss)
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
    archived
    label
    color
    iconUrl
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
  calendars {
    id
    archived
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {
  key
  eventId
  occurrenceDate
  modified
  label
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
  start
  end
  recurrence
  seriesStartDate
  reminders {
    ...ReminderFields
  }
  travelBefore
  travelAfter
  projectId
  calendarId
  archived
  contributorIds
  relationIds
  beneficiaryIds
  beneficiaryRelationIds
  categoryIds
  taskIds
  libraryDocumentIds
  projectResourceIds
  savedCountdownIds
  routineLinks {
    routineId
    date
    shownDate
  }
  calledOff
  postponedFrom {
    eventId
    date
    label
  }
  postponedTo {
    eventId
    label
    startDate
    startTime
  }
  trackedSeconds
  series {
    label
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
    travelBefore
    travelAfter
  }
}`) as unknown as TypedDocumentString<CalendarEventsQuery, CalendarEventsQueryVariables>;
export const CalendarsDocument = new TypedDocumentString(`
    query Calendars {
  calendars {
    id
    archived
    label
    color
    iconUrl
    position
  }
  calendarSubscriptions {
    id
    calendarId
    label
    color
    workspace {
      id
      label
      kind
    }
  }
}
    `) as unknown as TypedDocumentString<CalendarsQuery, CalendarsQueryVariables>;
export const SubscribableCalendarsDocument = new TypedDocumentString(`
    query SubscribableCalendars {
  subscribableCalendars {
    id
    label
    color
    subscribed
    workspace {
      id
      label
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
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {
  key
  eventId
  occurrenceDate
  modified
  label
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
  start
  end
  recurrence
  seriesStartDate
  reminders {
    ...ReminderFields
  }
  travelBefore
  travelAfter
  projectId
  calendarId
  archived
  contributorIds
  relationIds
  beneficiaryIds
  beneficiaryRelationIds
  categoryIds
  taskIds
  libraryDocumentIds
  projectResourceIds
  savedCountdownIds
  routineLinks {
    routineId
    date
    shownDate
  }
  calledOff
  postponedFrom {
    eventId
    date
    label
  }
  postponedTo {
    eventId
    label
    startDate
    startTime
  }
  trackedSeconds
  series {
    label
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
    travelBefore
    travelAfter
  }
}`) as unknown as TypedDocumentString<SubscribedCalendarEventsQuery, SubscribedCalendarEventsQueryVariables>;
export const CreateCalendarDocument = new TypedDocumentString(`
    mutation CreateCalendar($input: LabelColorInput!) {
  createCalendar(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateCalendarMutation, CreateCalendarMutationVariables>;
export const UpdateCalendarDocument = new TypedDocumentString(`
    mutation UpdateCalendar($id: ID!, $input: LabelColorInput!) {
  updateCalendar(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateCalendarMutation, UpdateCalendarMutationVariables>;
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
    mutation MoveCalendarCategory($id: ID!, $index: Int!, $parentId: ID) {
  moveCalendarCategory(id: $id, index: $index, parentId: $parentId)
}
    `) as unknown as TypedDocumentString<MoveCalendarCategoryMutation, MoveCalendarCategoryMutationVariables>;
export const CreateCalendarEventDocument = new TypedDocumentString(`
    mutation CreateCalendarEvent($input: CalendarEventInput!) {
  createCalendarEvent(input: $input)
}
    `) as unknown as TypedDocumentString<CreateCalendarEventMutation, CreateCalendarEventMutationVariables>;
export const UpdateCalendarEventDocument = new TypedDocumentString(`
    mutation UpdateCalendarEvent($id: ID!, $input: CalendarEventInput!, $scope: CalendarEventScope!, $occurrenceDate: Date, $confirmLoss: Boolean, $movedRule: JSON) {
  updateCalendarEvent(
    id: $id
    input: $input
    scope: $scope
    occurrenceDate: $occurrenceDate
    confirmLoss: $confirmLoss
    movedRule: $movedRule
  )
}
    `) as unknown as TypedDocumentString<UpdateCalendarEventMutation, UpdateCalendarEventMutationVariables>;
export const DeleteCalendarEventDocument = new TypedDocumentString(`
    mutation DeleteCalendarEvent($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date) {
  deleteCalendarEvent(id: $id, scope: $scope, occurrenceDate: $occurrenceDate)
}
    `) as unknown as TypedDocumentString<DeleteCalendarEventMutation, DeleteCalendarEventMutationVariables>;
export const BirthdaysDocument = new TypedDocumentString(`
    query Birthdays {
  birthdays(archived: true) {
    id
    contributorId
    relationId
    name
    birthDate
    archived
    aliases
    reminders {
      ...ReminderFields
    }
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}`) as unknown as TypedDocumentString<BirthdaysQuery, BirthdaysQueryVariables>;
export const BirthdayPersonNamesDocument = new TypedDocumentString(`
    query BirthdayPersonNames {
  birthdayPersonNames {
    id
    name
    archived
  }
}
    `) as unknown as TypedDocumentString<BirthdayPersonNamesQuery, BirthdayPersonNamesQueryVariables>;
export const CommentsDocument = new TypedDocumentString(`
    query Comments($target: CommentTarget!, $id: String!, $occurrenceDate: Date) {
  comments(target: $target, id: $id, occurrenceDate: $occurrenceDate) {
    id
    body
    createdAt
  }
}
    `) as unknown as TypedDocumentString<CommentsQuery, CommentsQueryVariables>;
export const CommentCountsDocument = new TypedDocumentString(`
    query CommentCounts($target: CommentTarget!, $ids: [String!]!) {
  commentCounts(target: $target, ids: $ids) {
    id
    count
  }
}
    `) as unknown as TypedDocumentString<CommentCountsQuery, CommentCountsQueryVariables>;
export const AddCommentDocument = new TypedDocumentString(`
    mutation AddComment($target: CommentTarget!, $id: String!, $body: String!, $occurrenceDate: Date) {
  addComment(
    target: $target
    id: $id
    body: $body
    occurrenceDate: $occurrenceDate
  ) {
    id
  }
}
    `) as unknown as TypedDocumentString<AddCommentMutation, AddCommentMutationVariables>;
export const UpdateCommentDocument = new TypedDocumentString(`
    mutation UpdateComment($id: ID!, $body: String!) {
  updateComment(id: $id, body: $body) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateCommentMutation, UpdateCommentMutationVariables>;
export const DeleteCommentDocument = new TypedDocumentString(`
    mutation DeleteComment($id: ID!) {
  deleteComment(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteCommentMutation, DeleteCommentMutationVariables>;
export const CountdownsDocument = new TypedDocumentString(`
    query Countdowns {
  countdowns {
    ...CountdownFields
  }
}
    fragment CountdownFields on Countdown {
  id
  label
  durationSeconds
  endsAt
  remainingSeconds
  ringtone
  workspaceId
  taskId
  routineId
  eventId
  sheetId
  occurrenceDate
  subject
  path
  linkLabel
  createdAt
}`) as unknown as TypedDocumentString<CountdownsQuery, CountdownsQueryVariables>;
export const StartCountdownDocument = new TypedDocumentString(`
    mutation StartCountdown($input: CountdownInput!) {
  startCountdown(input: $input) {
    ...CountdownFields
  }
}
    fragment CountdownFields on Countdown {
  id
  label
  durationSeconds
  endsAt
  remainingSeconds
  ringtone
  workspaceId
  taskId
  routineId
  eventId
  sheetId
  occurrenceDate
  subject
  path
  linkLabel
  createdAt
}`) as unknown as TypedDocumentString<StartCountdownMutation, StartCountdownMutationVariables>;
export const SetCountdownPausedDocument = new TypedDocumentString(`
    mutation SetCountdownPaused($id: ID!, $paused: Boolean!) {
  setCountdownPaused(id: $id, paused: $paused) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetCountdownPausedMutation, SetCountdownPausedMutationVariables>;
export const ExtendCountdownDocument = new TypedDocumentString(`
    mutation ExtendCountdown($id: ID!, $minutes: Int!) {
  extendCountdown(id: $id, minutes: $minutes) {
    id
  }
}
    `) as unknown as TypedDocumentString<ExtendCountdownMutation, ExtendCountdownMutationVariables>;
export const RingCountdownDocument = new TypedDocumentString(`
    mutation RingCountdown($id: ID!) {
  ringCountdown(id: $id)
}
    `) as unknown as TypedDocumentString<RingCountdownMutation, RingCountdownMutationVariables>;
export const CancelCountdownDocument = new TypedDocumentString(`
    mutation CancelCountdown($id: ID!) {
  cancelCountdown(id: $id)
}
    `) as unknown as TypedDocumentString<CancelCountdownMutation, CancelCountdownMutationVariables>;
export const SavedCountdownsDocument = new TypedDocumentString(`
    query SavedCountdowns {
  savedCountdowns {
    ...SavedCountdownFields
  }
}
    fragment SavedCountdownFields on SavedCountdown {
  id
  label
  color
  iconUrl
  position
  archived
  minutes
  ringtone
}`) as unknown as TypedDocumentString<SavedCountdownsQuery, SavedCountdownsQueryVariables>;
export const CreateSavedCountdownDocument = new TypedDocumentString(`
    mutation CreateSavedCountdown($input: SavedCountdownInput!) {
  createSavedCountdown(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateSavedCountdownMutation, CreateSavedCountdownMutationVariables>;
export const UpdateSavedCountdownDocument = new TypedDocumentString(`
    mutation UpdateSavedCountdown($id: ID!, $input: SavedCountdownPatch!) {
  updateSavedCountdown(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateSavedCountdownMutation, UpdateSavedCountdownMutationVariables>;
export const DeleteSavedCountdownDocument = new TypedDocumentString(`
    mutation DeleteSavedCountdown($id: ID!) {
  deleteSavedCountdown(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteSavedCountdownMutation, DeleteSavedCountdownMutationVariables>;
export const SetSavedCountdownLinksDocument = new TypedDocumentString(`
    mutation SetSavedCountdownLinks($target: SavedCountdownTarget!, $id: ID!, $savedCountdownIds: [ID!]!) {
  setSavedCountdownLinks(
    target: $target
    id: $id
    savedCountdownIds: $savedCountdownIds
  )
}
    `) as unknown as TypedDocumentString<SetSavedCountdownLinksMutation, SetSavedCountdownLinksMutationVariables>;
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
    archived
    label
    position
    charts {
      id
      dashboardId
      label
      config
      wide
      position
    }
  }
}
    `) as unknown as TypedDocumentString<DashboardsQuery, DashboardsQueryVariables>;
export const CreateDashboardDocument = new TypedDocumentString(`
    mutation CreateDashboard($label: String!, $projectId: ID) {
  createDashboard(label: $label, projectId: $projectId)
}
    `) as unknown as TypedDocumentString<CreateDashboardMutation, CreateDashboardMutationVariables>;
export const RenameDashboardDocument = new TypedDocumentString(`
    mutation RenameDashboard($id: ID!, $label: String!) {
  renameDashboard(id: $id, label: $label)
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
export const DocumentOptionsDocument = new TypedDocumentString(`
    query DocumentOptions {
  documentOptions {
    ...LinkedDocumentFields
  }
}
    fragment LinkedDocumentFields on LinkedDocument {
  id
  source
  kind
  label
  url
  projectId
  place
}`) as unknown as TypedDocumentString<DocumentOptionsQuery, DocumentOptionsQueryVariables>;
export const PlacesDocument = new TypedDocumentString(`
    query Places {
  places {
    id
    archived
    label
    address
    parentId
    lat
    lon
    path
    color
    iconUrl
    position
  }
}
    `) as unknown as TypedDocumentString<PlacesQuery, PlacesQueryVariables>;
export const SearchAddressesDocument = new TypedDocumentString(`
    query SearchAddresses($text: String!, $near: GeoPointInput) {
  searchAddresses(text: $text, near: $near) {
    address
    label
    lat
    lon
  }
}
    `) as unknown as TypedDocumentString<SearchAddressesQuery, SearchAddressesQueryVariables>;
export const ReverseAddressDocument = new TypedDocumentString(`
    query ReverseAddress($point: GeoPointInput!) {
  reverseAddress(point: $point) {
    address
    label
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
export const MovePlaceDocument = new TypedDocumentString(`
    mutation MovePlace($id: ID!, $parentId: ID, $index: Int!) {
  movePlace(id: $id, parentId: $parentId, index: $index)
}
    `) as unknown as TypedDocumentString<MovePlaceMutation, MovePlaceMutationVariables>;
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
      issueField
      options {
        id
        name
      }
    }
    issueTypes {
      id
      name
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
    label
    statusFieldId
    priorityFieldId
    iterationFieldId
    startFieldId
    endFieldId
    effortFieldId
    deadlineFieldId
    timeSpentFieldId
    typeSource
    typeFieldId
    statusOptions
    priorityOptions
    typeOptions
    syncAssignees
    syncLabels
    repositoryName
    pushExisting
    writeIterations
    iterationWriteRefusal
    enabled
    lastSyncAt
    lastSyncError
    lastSyncSummary
    iterationWriteError
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
export const ResumeGithubIterationsDocument = new TypedDocumentString(`
    mutation ResumeGithubIterations($projectId: ID!) {
  resumeGithubIterations(projectId: $projectId)
}
    `) as unknown as TypedDocumentString<ResumeGithubIterationsMutation, ResumeGithubIterationsMutationVariables>;
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
    failed
    sprints
    sprintsPushed
    sprintsSkipped
    sprintsBlocked
    sprintsUnpaired
    renumbered
    comments
  }
}
    `) as unknown as TypedDocumentString<SyncGithubProjectMutation, SyncGithubProjectMutationVariables>;
export const SendTasksToGithubDocument = new TypedDocumentString(`
    mutation SendTasksToGithub($ids: [ID!]!) {
  sendTasksToGithub(ids: $ids) {
    sent
    errors
  }
}
    `) as unknown as TypedDocumentString<SendTasksToGithubMutation, SendTasksToGithubMutationVariables>;
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
export const ReorderDocumentFolderDocument = new TypedDocumentString(`
    mutation ReorderDocumentFolder($id: ID!, $parentId: ID, $index: Int!) {
  reorderDocumentFolder(id: $id, parentId: $parentId, index: $index)
}
    `) as unknown as TypedDocumentString<ReorderDocumentFolderMutation, ReorderDocumentFolderMutationVariables>;
export const ReorderLibraryDocumentDocument = new TypedDocumentString(`
    mutation ReorderLibraryDocument($id: ID!, $folderId: ID, $index: Int!) {
  reorderLibraryDocument(id: $id, folderId: $folderId, index: $index)
}
    `) as unknown as TypedDocumentString<ReorderLibraryDocumentMutation, ReorderLibraryDocumentMutationVariables>;
export const DeleteLibraryDocumentsDocument = new TypedDocumentString(`
    mutation DeleteLibraryDocuments($ids: [ID!]!) {
  deleteLibraryDocuments(ids: $ids)
}
    `) as unknown as TypedDocumentString<DeleteLibraryDocumentsMutation, DeleteLibraryDocumentsMutationVariables>;
export const MailAccountsDocument = new TypedDocumentString(`
    query MailAccounts {
  mailAccounts {
    ...MailAccountFields
  }
}
    fragment MailAccountFields on MailAccount {
  id
  archived
  label
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
    filename
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
    archived
    label
    color
    iconUrl
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
    mutation CreateMailLabel($input: LabelColorInput!) {
  createMailLabel(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateMailLabelMutation, CreateMailLabelMutationVariables>;
export const UpdateMailLabelDocument = new TypedDocumentString(`
    mutation UpdateMailLabel($id: ID!, $input: LabelColorPatch!) {
  updateMailLabel(id: $id, input: $input) {
    id
  }
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
    label
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
    query MailAdvancedSearch($criteria: JSON!, $page: Int!, $sort: String, $ascending: Boolean) {
  mailAdvancedSearch(
    criteria: $criteria
    page: $page
    sort: $sort
    ascending: $ascending
  ) {
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
export const WatchedMailAccountsDocument = new TypedDocumentString(`
    query WatchedMailAccounts {
  mailAccounts {
    id
    archived
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
export const ProjectTreeDocument = new TypedDocumentString(`
    query ProjectTree {
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
  archived
  label
  color
  position
  iconUrl
}
fragment ProjectStatusFields on ProjectStatus {
  id
  archived
  label
  color
  iconUrl
  position
}
fragment ProjectFields on Project {
  id
  label
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
}`) as unknown as TypedDocumentString<ProjectTreeQuery, ProjectTreeQueryVariables>;
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
  archived
  label
  color
  position
  iconUrl
}
fragment ProjectFields on Project {
  id
  label
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
  archived
  label
  color
  position
  iconUrl
}
fragment ProjectFields on Project {
  id
  label
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
  archived
  label
  color
  position
  iconUrl
}
fragment ProjectFields on Project {
  id
  label
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
  archived
  label
  color
  position
  iconUrl
}
fragment ProjectFields on Project {
  id
  label
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
    mutation CreateProjectCategory($input: LabelColorInput!) {
  createProjectCategory(input: $input) {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  archived
  label
  color
  position
  iconUrl
}`) as unknown as TypedDocumentString<CreateProjectCategoryMutation, CreateProjectCategoryMutationVariables>;
export const UpdateProjectCategoryDocument = new TypedDocumentString(`
    mutation UpdateProjectCategory($id: ID!, $input: LabelColorPatch!) {
  updateProjectCategory(id: $id, input: $input) {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  archived
  label
  color
  position
  iconUrl
}`) as unknown as TypedDocumentString<UpdateProjectCategoryMutation, UpdateProjectCategoryMutationVariables>;
export const DeleteProjectCategoryDocument = new TypedDocumentString(`
    mutation DeleteProjectCategory($id: ID!) {
  deleteProjectCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectCategoryMutation, DeleteProjectCategoryMutationVariables>;
export const CreateProjectStatusDocument = new TypedDocumentString(`
    mutation CreateProjectStatus($input: LabelColorInput!) {
  createProjectStatus(input: $input) {
    ...ProjectStatusFields
  }
}
    fragment ProjectStatusFields on ProjectStatus {
  id
  archived
  label
  color
  iconUrl
  position
}`) as unknown as TypedDocumentString<CreateProjectStatusMutation, CreateProjectStatusMutationVariables>;
export const UpdateProjectStatusDocument = new TypedDocumentString(`
    mutation UpdateProjectStatus($id: ID!, $input: LabelColorPatch!) {
  updateProjectStatus(id: $id, input: $input) {
    ...ProjectStatusFields
  }
}
    fragment ProjectStatusFields on ProjectStatus {
  id
  archived
  label
  color
  iconUrl
  position
}`) as unknown as TypedDocumentString<UpdateProjectStatusMutation, UpdateProjectStatusMutationVariables>;
export const DeleteProjectStatusDocument = new TypedDocumentString(`
    mutation DeleteProjectStatus($id: ID!) {
  deleteProjectStatus(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectStatusMutation, DeleteProjectStatusMutationVariables>;
export const RoutinesDataDocument = new TypedDocumentString(`
    query RoutinesData {
  routineCategories {
    id
    archived
    label
    color
    iconUrl
    parentId
    position
  }
  routines {
    id
    label
    description
    categoryIds
    priorityId
    typeId
    parentId
    startDate
    recurrence
    estimate
    fromTime
    dueTime
    slotCondition
    moments
    reminders {
      ...ReminderFields
    }
    deadTimes {
      ...DeadTimeFields
    }
    savedCountdownIds
    reminderOccurrences {
      date
      dueDate
      day
      slots {
        slot
        fromTime
        dueTime
      }
    }
    cases
    moves
    done
    slots {
      index
      fromTime
      dueTime
      optional
      done
      doneAt
      windows
    }
    windowFrom
    windowTo
    location
    locationLat
    locationLon
    links {
      url
      label
    }
    travelBefore
    travelAfter
    projectId
    position
    archived
    assigneeIds
    beneficiaryIds
    beneficiaryRelationIds
    libraryDocumentIds
    projectResourceIds
    requiredIds
    relatedIds
    currentDate
    currentDueDate
    firstDate
    nextDate
    nextDueDate
    doneDates
    lastDoneAt
    trackedSeconds
    opensOn
    inheritedFields
    inheritance {
      ...FieldOriginFields
    }
    effective {
      projectId
      assigneeIds
      beneficiaryIds
      beneficiaryRelationIds
      categoryIds
      priorityId
      slotCondition
      opensOn
      location
      locationLat
      locationLon
      startDate
      recurrence
      cases
      moments
      moves
    }
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment DeadTimeFields on DeadTime {
  label
  minutes
  ringtone
}
fragment FieldOriginFields on FieldOrigin {
  field
  state
  source
  sourceId
}`) as unknown as TypedDocumentString<RoutinesDataQuery, RoutinesDataQueryVariables>;
export const CreateRoutineCategoryDocument = new TypedDocumentString(`
    mutation CreateRoutineCategory($input: RoutineCategoryInput!) {
  createRoutineCategory(input: $input)
}
    `) as unknown as TypedDocumentString<CreateRoutineCategoryMutation, CreateRoutineCategoryMutationVariables>;
export const UpdateRoutineCategoryDocument = new TypedDocumentString(`
    mutation UpdateRoutineCategory($id: ID!, $input: RoutineCategoryInput!) {
  updateRoutineCategory(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateRoutineCategoryMutation, UpdateRoutineCategoryMutationVariables>;
export const MoveRoutineCategoryDocument = new TypedDocumentString(`
    mutation MoveRoutineCategory($id: ID!, $parentId: ID, $index: Int) {
  moveRoutineCategory(id: $id, parentId: $parentId, index: $index)
}
    `) as unknown as TypedDocumentString<MoveRoutineCategoryMutation, MoveRoutineCategoryMutationVariables>;
export const DeleteRoutineCategoryDocument = new TypedDocumentString(`
    mutation DeleteRoutineCategory($id: ID!) {
  deleteRoutineCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteRoutineCategoryMutation, DeleteRoutineCategoryMutationVariables>;
export const CopySubRoutinesDocument = new TypedDocumentString(`
    mutation CopySubRoutines($fromId: ID!, $toId: ID!) {
  copySubRoutines(fromId: $fromId, toId: $toId)
}
    `) as unknown as TypedDocumentString<CopySubRoutinesMutation, CopySubRoutinesMutationVariables>;
export const ConvertTaskToRoutineDocument = new TypedDocumentString(`
    mutation ConvertTaskToRoutine($id: ID!, $confirm: Boolean) {
  convertTaskToRoutine(id: $id, confirm: $confirm)
}
    `) as unknown as TypedDocumentString<ConvertTaskToRoutineMutation, ConvertTaskToRoutineMutationVariables>;
export const ConvertRoutineToTaskDocument = new TypedDocumentString(`
    mutation ConvertRoutineToTask($id: ID!, $confirm: Boolean) {
  convertRoutineToTask(id: $id, confirm: $confirm)
}
    `) as unknown as TypedDocumentString<ConvertRoutineToTaskMutation, ConvertRoutineToTaskMutationVariables>;
export const CreateRoutineDocument = new TypedDocumentString(`
    mutation CreateRoutine($input: RoutineInput!, $copyOf: ID) {
  createRoutine(input: $input, copyOf: $copyOf)
}
    `) as unknown as TypedDocumentString<CreateRoutineMutation, CreateRoutineMutationVariables>;
export const UpdateRoutineDocument = new TypedDocumentString(`
    mutation UpdateRoutine($id: ID!, $input: RoutineInput!, $restoring: Boolean, $confirmLoss: Boolean) {
  updateRoutine(
    id: $id
    input: $input
    restoring: $restoring
    confirmLoss: $confirmLoss
  ) {
    removedLinks
  }
}
    `) as unknown as TypedDocumentString<UpdateRoutineMutation, UpdateRoutineMutationVariables>;
export const PatchRoutineDocument = new TypedDocumentString(`
    mutation PatchRoutine($id: ID!, $input: RoutinePatch!, $confirmLoss: Boolean) {
  patchRoutine(id: $id, input: $input, confirmLoss: $confirmLoss) {
    removedLinks
  }
}
    `) as unknown as TypedDocumentString<PatchRoutineMutation, PatchRoutineMutationVariables>;
export const MoveRoutineDocument = new TypedDocumentString(`
    mutation MoveRoutine($id: ID!, $beforeId: ID, $parentId: ID, $categoryIds: [ID!], $confirmLoss: Boolean) {
  moveRoutine(
    id: $id
    beforeId: $beforeId
    parentId: $parentId
    categoryIds: $categoryIds
    confirmLoss: $confirmLoss
  )
}
    `) as unknown as TypedDocumentString<MoveRoutineMutation, MoveRoutineMutationVariables>;
export const BulkUpdateRoutinesDocument = new TypedDocumentString(`
    mutation BulkUpdateRoutines($ids: [ID!]!, $changes: RoutineBulkChanges!, $confirmLoss: Boolean) {
  bulkUpdateRoutines(ids: $ids, changes: $changes, confirmLoss: $confirmLoss) {
    removedLinks
  }
}
    `) as unknown as TypedDocumentString<BulkUpdateRoutinesMutation, BulkUpdateRoutinesMutationVariables>;
export const BulkSetRoutinesArchivedDocument = new TypedDocumentString(`
    mutation BulkSetRoutinesArchived($ids: [ID!]!, $archived: Boolean!) {
  bulkSetRoutinesArchived(ids: $ids, archived: $archived)
}
    `) as unknown as TypedDocumentString<BulkSetRoutinesArchivedMutation, BulkSetRoutinesArchivedMutationVariables>;
export const BulkSetRoutinesDoneDocument = new TypedDocumentString(`
    mutation BulkSetRoutinesDone($ids: [ID!]!, $done: Boolean!, $doneOn: Date, $dates: [Date!]) {
  bulkSetRoutinesDone(ids: $ids, done: $done, doneOn: $doneOn, dates: $dates)
}
    `) as unknown as TypedDocumentString<BulkSetRoutinesDoneMutation, BulkSetRoutinesDoneMutationVariables>;
export const BulkDeleteRoutinesDocument = new TypedDocumentString(`
    mutation BulkDeleteRoutines($ids: [ID!]!, $deleteSubRoutines: Boolean!) {
  bulkDeleteRoutines(ids: $ids, deleteSubRoutines: $deleteSubRoutines)
}
    `) as unknown as TypedDocumentString<BulkDeleteRoutinesMutation, BulkDeleteRoutinesMutationVariables>;
export const SetRoutineDoneDocument = new TypedDocumentString(`
    mutation SetRoutineDone($id: ID!, $done: Boolean!, $date: Date, $slot: Int, $doneAt: DateTime) {
  setRoutineDone(id: $id, done: $done, date: $date, slot: $slot, doneAt: $doneAt)
}
    `) as unknown as TypedDocumentString<SetRoutineDoneMutation, SetRoutineDoneMutationVariables>;
export const MoveRoutineOccurrenceDocument = new TypedDocumentString(`
    mutation MoveRoutineOccurrence($id: ID!, $date: Date!, $to: Date!, $times: JSON, $sameDay: RoutineSameDayChoice) {
  moveRoutineOccurrence(
    id: $id
    date: $date
    to: $to
    times: $times
    sameDay: $sameDay
  )
}
    `) as unknown as TypedDocumentString<MoveRoutineOccurrenceMutation, MoveRoutineOccurrenceMutationVariables>;
export const ChangeRoutineOccurrenceDocument = new TypedDocumentString(`
    mutation ChangeRoutineOccurrence($id: ID!, $date: Date!, $scope: CalendarEventScope!, $to: Date!, $slot: Int!, $fromTime: String, $dueTime: String, $confirmLoss: Boolean, $sameDay: RoutineSameDayChoice, $movedRule: JSON) {
  changeRoutineOccurrence(
    id: $id
    date: $date
    scope: $scope
    to: $to
    slot: $slot
    fromTime: $fromTime
    dueTime: $dueTime
    confirmLoss: $confirmLoss
    sameDay: $sameDay
    movedRule: $movedRule
  )
}
    `) as unknown as TypedDocumentString<ChangeRoutineOccurrenceMutation, ChangeRoutineOccurrenceMutationVariables>;
export const DeleteRoutineOccurrenceDocument = new TypedDocumentString(`
    mutation DeleteRoutineOccurrence($id: ID!, $date: Date!, $scope: CalendarEventScope!) {
  deleteRoutineOccurrence(id: $id, date: $date, scope: $scope) {
    archived
    comments {
      body
      createdAt
      updatedAt
    }
  }
}
    `) as unknown as TypedDocumentString<DeleteRoutineOccurrenceMutation, DeleteRoutineOccurrenceMutationVariables>;
export const RemoveRoutineMoveDocument = new TypedDocumentString(`
    mutation RemoveRoutineMove($id: ID!, $from: Date!, $comments: [CommentSnapshotInput!], $undo: Boolean) {
  removeRoutineMove(id: $id, from: $from, comments: $comments, undo: $undo)
}
    `) as unknown as TypedDocumentString<RemoveRoutineMoveMutation, RemoveRoutineMoveMutationVariables>;
export const RoutineOccurrencesDocument = new TypedDocumentString(`
    query RoutineOccurrences($from: Date!, $to: Date!, $doneInPeriod: Boolean) {
  routineOccurrences(from: $from, to: $to, doneInPeriod: $doneInPeriod) {
    routineId
    date
    dueDate
    startDate
    shownDate
    movedFrom
    cancelled
    archived
    slots {
      index
      fromTime
      dueTime
      optional
      done
      doneAt
      windows
    }
  }
}
    `) as unknown as TypedDocumentString<RoutineOccurrencesQuery, RoutineOccurrencesQueryVariables>;
export const SheetsDocument = new TypedDocumentString(`
    query Sheets($projectId: ID) {
  sheets(projectId: $projectId) {
    id
    archived
    label
    note
    projectId
    categoryIds
    position
    createdAt
    updatedAt
    usedBy
    items {
      id
      productId
      label
      categoryId
      quantity
      unit
      note
      consumable
      storeId
      url
      perishable
      storageId
      memberIds
      relationIds
      optional
      position
    }
  }
}
    `) as unknown as TypedDocumentString<SheetsQuery, SheetsQueryVariables>;
export const SheetDocument = new TypedDocumentString(`
    query Sheet($id: ID!) {
  sheet(id: $id) {
    id
    archived
    label
    note
    projectId
    categoryIds
    savedCountdownIds
    usedBy
    updatedAt
    items {
      id
      productId
      label
      categoryId
      quantity
      unit
      note
      consumable
      storeId
      url
      perishable
      storageId
      memberIds
      relationIds
      optional
      position
    }
  }
}
    `) as unknown as TypedDocumentString<SheetQuery, SheetQueryVariables>;
export const SheetCategoriesDocument = new TypedDocumentString(`
    query SheetCategories {
  sheetCategories {
    id
    archived
    label
    color
    iconUrl
    position
  }
}
    `) as unknown as TypedDocumentString<SheetCategoriesQuery, SheetCategoriesQueryVariables>;
export const SheetLinksDocument = new TypedDocumentString(`
    query SheetLinks($routineId: ID, $eventId: ID, $taskId: ID) {
  sheetLinks(routineId: $routineId, eventId: $eventId, taskId: $taskId) {
    id
    sheetId
    multiplier
  }
}
    `) as unknown as TypedDocumentString<SheetLinksQuery, SheetLinksQueryVariables>;
export const ChecklistDocument = new TypedDocumentString(`
    query Checklist($routineId: ID, $eventId: ID, $taskId: ID, $occurrenceDate: Date) {
  checklist(
    routineId: $routineId
    eventId: $eventId
    taskId: $taskId
    occurrenceDate: $occurrenceDate
  ) {
    id
    routineId
    eventId
    taskId
    occurrenceDate
    items {
      id
      productId
      label
      categoryId
      quantity
      unit
      note
      consumable
      checkedAt
      position
      sources {
        sheetId
        label
        quantity
      }
    }
  }
}
    `) as unknown as TypedDocumentString<ChecklistQuery, ChecklistQueryVariables>;
export const CreateSheetDocument = new TypedDocumentString(`
    mutation CreateSheet($input: SheetInput!) {
  createSheet(input: $input)
}
    `) as unknown as TypedDocumentString<CreateSheetMutation, CreateSheetMutationVariables>;
export const UpdateSheetDocument = new TypedDocumentString(`
    mutation UpdateSheet($id: ID!, $input: SheetInput!) {
  updateSheet(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateSheetMutation, UpdateSheetMutationVariables>;
export const AddSheetItemDocument = new TypedDocumentString(`
    mutation AddSheetItem($sheetId: ID!, $input: SheetItemInput!) {
  addSheetItem(sheetId: $sheetId, input: $input)
}
    `) as unknown as TypedDocumentString<AddSheetItemMutation, AddSheetItemMutationVariables>;
export const AddSheetProductsDocument = new TypedDocumentString(`
    mutation AddSheetProducts($sheetId: ID!, $productIds: [ID!]!) {
  addSheetProducts(sheetId: $sheetId, productIds: $productIds)
}
    `) as unknown as TypedDocumentString<AddSheetProductsMutation, AddSheetProductsMutationVariables>;
export const UpdateSheetItemDocument = new TypedDocumentString(`
    mutation UpdateSheetItem($id: ID!, $input: SheetItemInput!) {
  updateSheetItem(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateSheetItemMutation, UpdateSheetItemMutationVariables>;
export const DeleteSheetItemsDocument = new TypedDocumentString(`
    mutation DeleteSheetItems($ids: [ID!]!) {
  deleteSheetItems(ids: $ids)
}
    `) as unknown as TypedDocumentString<DeleteSheetItemsMutation, DeleteSheetItemsMutationVariables>;
export const UseSheetDocument = new TypedDocumentString(`
    mutation UseSheet($id: ID!, $multiplier: Float!) {
  useSheet(id: $id, multiplier: $multiplier) {
    taken
    short
  }
}
    `) as unknown as TypedDocumentString<UseSheetMutation, UseSheetMutationVariables>;
export const CreateSheetCategoryDocument = new TypedDocumentString(`
    mutation CreateSheetCategory($input: LabelColorInput!) {
  createSheetCategory(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateSheetCategoryMutation, CreateSheetCategoryMutationVariables>;
export const UpdateSheetCategoryDocument = new TypedDocumentString(`
    mutation UpdateSheetCategory($id: ID!, $input: LabelColorPatch!) {
  updateSheetCategory(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateSheetCategoryMutation, UpdateSheetCategoryMutationVariables>;
export const DeleteSheetCategoryDocument = new TypedDocumentString(`
    mutation DeleteSheetCategory($id: ID!) {
  deleteSheetCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteSheetCategoryMutation, DeleteSheetCategoryMutationVariables>;
export const DuplicateSheetDocument = new TypedDocumentString(`
    mutation DuplicateSheet($id: ID!) {
  duplicateSheet(id: $id)
}
    `) as unknown as TypedDocumentString<DuplicateSheetMutation, DuplicateSheetMutationVariables>;
export const DeleteSheetDocument = new TypedDocumentString(`
    mutation DeleteSheet($id: ID!) {
  deleteSheet(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteSheetMutation, DeleteSheetMutationVariables>;
export const AddSheetToShoppingListDocument = new TypedDocumentString(`
    mutation AddSheetToShoppingList($listId: ID!, $sheetId: ID!, $multiplier: Float!) {
  addSheetToShoppingList(
    listId: $listId
    sheetId: $sheetId
    multiplier: $multiplier
  )
}
    `) as unknown as TypedDocumentString<AddSheetToShoppingListMutation, AddSheetToShoppingListMutationVariables>;
export const RemoveSheetFromShoppingListDocument = new TypedDocumentString(`
    mutation RemoveSheetFromShoppingList($listId: ID!, $sheetId: ID!) {
  removeSheetFromShoppingList(listId: $listId, sheetId: $sheetId)
}
    `) as unknown as TypedDocumentString<RemoveSheetFromShoppingListMutation, RemoveSheetFromShoppingListMutationVariables>;
export const SetSheetLinksDocument = new TypedDocumentString(`
    mutation SetSheetLinks($routineId: ID, $eventId: ID, $taskId: ID, $links: [SheetLinkInput!]!) {
  setSheetLinks(
    routineId: $routineId
    eventId: $eventId
    taskId: $taskId
    links: $links
  )
}
    `) as unknown as TypedDocumentString<SetSheetLinksMutation, SetSheetLinksMutationVariables>;
export const ResetChecklistDocument = new TypedDocumentString(`
    mutation ResetChecklist($id: ID!) {
  resetChecklist(id: $id)
}
    `) as unknown as TypedDocumentString<ResetChecklistMutation, ResetChecklistMutationVariables>;
export const AddSheetToChecklistDocument = new TypedDocumentString(`
    mutation AddSheetToChecklist($id: ID!, $sheetId: ID!, $multiplier: Float!) {
  addSheetToChecklist(id: $id, sheetId: $sheetId, multiplier: $multiplier)
}
    `) as unknown as TypedDocumentString<AddSheetToChecklistMutation, AddSheetToChecklistMutationVariables>;
export const AddChecklistItemDocument = new TypedDocumentString(`
    mutation AddChecklistItem($listId: ID!, $input: SheetItemInput!) {
  addChecklistItem(listId: $listId, input: $input)
}
    `) as unknown as TypedDocumentString<AddChecklistItemMutation, AddChecklistItemMutationVariables>;
export const UpdateChecklistItemDocument = new TypedDocumentString(`
    mutation UpdateChecklistItem($id: ID!, $input: SheetItemInput!) {
  updateChecklistItem(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateChecklistItemMutation, UpdateChecklistItemMutationVariables>;
export const SetChecklistItemsCheckedDocument = new TypedDocumentString(`
    mutation SetChecklistItemsChecked($ids: [ID!]!, $checked: Boolean!) {
  setChecklistItemsChecked(ids: $ids, checked: $checked)
}
    `) as unknown as TypedDocumentString<SetChecklistItemsCheckedMutation, SetChecklistItemsCheckedMutationVariables>;
export const DeleteChecklistItemDocument = new TypedDocumentString(`
    mutation DeleteChecklistItem($id: ID!) {
  deleteChecklistItem(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteChecklistItemMutation, DeleteChecklistItemMutationVariables>;
export const ShoppingDataDocument = new TypedDocumentString(`
    query ShoppingData {
  shoppingCategories {
    id
    archived
    label
    color
    iconUrl
    parentId
    position
    baseListIds
  }
  shoppingStorages {
    id
    archived
    label
    color
    iconUrl
    position
  }
  shoppingUnits {
    id
    archived
    label
    color
    iconUrl
    position
  }
  shoppingStores {
    id
    archived
    label
    color
    iconUrl
    position
  }
  shoppingBaseLists {
    id
    archived
    label
    color
    iconUrl
    position
  }
  shoppingProducts {
    id
    archived
    baseListId
    label
    categoryId
    storeId
    url
    note
    quantity
    unit
    unitPrice
    perishable
    storageId
    expiresAt
    missing
    lastPurchasedAt
    lastPrice
    memberIds
    relationIds
    stockTracked
    consumable
    autoStock
    stockLocationId
  }
}
    `) as unknown as TypedDocumentString<ShoppingDataQuery, ShoppingDataQueryVariables>;
export const ShoppingListsDocument = new TypedDocumentString(`
    query ShoppingLists($taskId: ID) {
  shoppingLists(taskId: $taskId) {
    id
    archived
    label
    taskIds
    entryId
    entry {
      id
      date
      label
      amount
    }
    closed
    closedAt
    remote
    deliveryAddress
    deliveryLat
    deliveryLon
    deliveries {
      id
      label
      trackingUrl
      pickup
      windowFrom
      windowTo
      address
      lat
      lon
      receivedAt
      position
    }
    createdAt
    items {
      id
      listId
      productId
      label
      categoryId
      storeId
      url
      note
      quantity
      unit
      unitPrice
      perishable
      storageId
      expiresAt
      purchasedAt
      optional
      deliveryId
      sheetSources {
        sheetId
        label
        quantity
      }
      position
      memberIds
      relationIds
    }
  }
}
    `) as unknown as TypedDocumentString<ShoppingListsQuery, ShoppingListsQueryVariables>;
export const CreateShoppingCategoryDocument = new TypedDocumentString(`
    mutation CreateShoppingCategory($input: ShoppingCategoryInput!) {
  createShoppingCategory(input: $input)
}
    `) as unknown as TypedDocumentString<CreateShoppingCategoryMutation, CreateShoppingCategoryMutationVariables>;
export const UpdateShoppingCategoryDocument = new TypedDocumentString(`
    mutation UpdateShoppingCategory($id: ID!, $input: ShoppingCategoryInput!) {
  updateShoppingCategory(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateShoppingCategoryMutation, UpdateShoppingCategoryMutationVariables>;
export const DeleteShoppingCategoryDocument = new TypedDocumentString(`
    mutation DeleteShoppingCategory($id: ID!) {
  deleteShoppingCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingCategoryMutation, DeleteShoppingCategoryMutationVariables>;
export const MoveShoppingCategoryDocument = new TypedDocumentString(`
    mutation MoveShoppingCategory($id: ID!, $parentId: ID, $index: Int) {
  moveShoppingCategory(id: $id, parentId: $parentId, index: $index)
}
    `) as unknown as TypedDocumentString<MoveShoppingCategoryMutation, MoveShoppingCategoryMutationVariables>;
export const CreateShoppingUnitDocument = new TypedDocumentString(`
    mutation CreateShoppingUnit($input: LabelColorInput!) {
  createShoppingUnit(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateShoppingUnitMutation, CreateShoppingUnitMutationVariables>;
export const UpdateShoppingUnitDocument = new TypedDocumentString(`
    mutation UpdateShoppingUnit($id: ID!, $input: LabelColorPatch!) {
  updateShoppingUnit(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateShoppingUnitMutation, UpdateShoppingUnitMutationVariables>;
export const DeleteShoppingUnitDocument = new TypedDocumentString(`
    mutation DeleteShoppingUnit($id: ID!) {
  deleteShoppingUnit(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingUnitMutation, DeleteShoppingUnitMutationVariables>;
export const MoveShoppingProductsDocument = new TypedDocumentString(`
    mutation MoveShoppingProducts($ids: [ID!]!, $baseListId: ID!) {
  moveShoppingProducts(ids: $ids, baseListId: $baseListId)
}
    `) as unknown as TypedDocumentString<MoveShoppingProductsMutation, MoveShoppingProductsMutationVariables>;
export const CreateShoppingStorageDocument = new TypedDocumentString(`
    mutation CreateShoppingStorage($input: LabelColorInput!) {
  createShoppingStorage(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateShoppingStorageMutation, CreateShoppingStorageMutationVariables>;
export const UpdateShoppingStorageDocument = new TypedDocumentString(`
    mutation UpdateShoppingStorage($id: ID!, $input: LabelColorPatch!) {
  updateShoppingStorage(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateShoppingStorageMutation, UpdateShoppingStorageMutationVariables>;
export const DeleteShoppingStorageDocument = new TypedDocumentString(`
    mutation DeleteShoppingStorage($id: ID!) {
  deleteShoppingStorage(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingStorageMutation, DeleteShoppingStorageMutationVariables>;
export const DuplicateShoppingItemDocument = new TypedDocumentString(`
    mutation DuplicateShoppingItem($id: ID!) {
  duplicateShoppingItem(id: $id)
}
    `) as unknown as TypedDocumentString<DuplicateShoppingItemMutation, DuplicateShoppingItemMutationVariables>;
export const CreateShoppingStoreDocument = new TypedDocumentString(`
    mutation CreateShoppingStore($input: LabelColorInput!) {
  createShoppingStore(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateShoppingStoreMutation, CreateShoppingStoreMutationVariables>;
export const UpdateShoppingStoreDocument = new TypedDocumentString(`
    mutation UpdateShoppingStore($id: ID!, $input: LabelColorPatch!) {
  updateShoppingStore(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateShoppingStoreMutation, UpdateShoppingStoreMutationVariables>;
export const DeleteShoppingStoreDocument = new TypedDocumentString(`
    mutation DeleteShoppingStore($id: ID!) {
  deleteShoppingStore(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingStoreMutation, DeleteShoppingStoreMutationVariables>;
export const CreateShoppingBaseListDocument = new TypedDocumentString(`
    mutation CreateShoppingBaseList($label: String!) {
  createShoppingBaseList(label: $label)
}
    `) as unknown as TypedDocumentString<CreateShoppingBaseListMutation, CreateShoppingBaseListMutationVariables>;
export const RenameShoppingBaseListDocument = new TypedDocumentString(`
    mutation RenameShoppingBaseList($id: ID!, $label: String!) {
  renameShoppingBaseList(id: $id, label: $label)
}
    `) as unknown as TypedDocumentString<RenameShoppingBaseListMutation, RenameShoppingBaseListMutationVariables>;
export const DeleteShoppingBaseListDocument = new TypedDocumentString(`
    mutation DeleteShoppingBaseList($id: ID!) {
  deleteShoppingBaseList(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingBaseListMutation, DeleteShoppingBaseListMutationVariables>;
export const CreateShoppingProductDocument = new TypedDocumentString(`
    mutation CreateShoppingProduct($input: ShoppingProductInput!) {
  createShoppingProduct(input: $input)
}
    `) as unknown as TypedDocumentString<CreateShoppingProductMutation, CreateShoppingProductMutationVariables>;
export const UpdateShoppingProductDocument = new TypedDocumentString(`
    mutation UpdateShoppingProduct($id: ID!, $input: ShoppingProductInput!) {
  updateShoppingProduct(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateShoppingProductMutation, UpdateShoppingProductMutationVariables>;
export const SetShoppingProductsMissingDocument = new TypedDocumentString(`
    mutation SetShoppingProductsMissing($ids: [ID!]!, $missing: Boolean!) {
  setShoppingProductsMissing(ids: $ids, missing: $missing)
}
    `) as unknown as TypedDocumentString<SetShoppingProductsMissingMutation, SetShoppingProductsMissingMutationVariables>;
export const DeleteShoppingProductDocument = new TypedDocumentString(`
    mutation DeleteShoppingProduct($id: ID!) {
  deleteShoppingProduct(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingProductMutation, DeleteShoppingProductMutationVariables>;
export const CreateShoppingListDocument = new TypedDocumentString(`
    mutation CreateShoppingList($label: String!, $taskIds: [ID!]!, $baseListIds: [ID!]!) {
  createShoppingList(label: $label, taskIds: $taskIds, baseListIds: $baseListIds)
}
    `) as unknown as TypedDocumentString<CreateShoppingListMutation, CreateShoppingListMutationVariables>;
export const UpdateShoppingListDocument = new TypedDocumentString(`
    mutation UpdateShoppingList($id: ID!, $label: String!, $taskIds: [ID!]!) {
  updateShoppingList(id: $id, label: $label, taskIds: $taskIds)
}
    `) as unknown as TypedDocumentString<UpdateShoppingListMutation, UpdateShoppingListMutationVariables>;
export const SetShoppingListClosedDocument = new TypedDocumentString(`
    mutation SetShoppingListClosed($id: ID!, $closed: Boolean!) {
  setShoppingListClosed(id: $id, closed: $closed)
}
    `) as unknown as TypedDocumentString<SetShoppingListClosedMutation, SetShoppingListClosedMutationVariables>;
export const DuplicateShoppingListDocument = new TypedDocumentString(`
    mutation DuplicateShoppingList($id: ID!) {
  duplicateShoppingList(id: $id)
}
    `) as unknown as TypedDocumentString<DuplicateShoppingListMutation, DuplicateShoppingListMutationVariables>;
export const DeleteShoppingListDocument = new TypedDocumentString(`
    mutation DeleteShoppingList($id: ID!) {
  deleteShoppingList(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingListMutation, DeleteShoppingListMutationVariables>;
export const AttachShoppingListEntryDocument = new TypedDocumentString(`
    mutation AttachShoppingListEntry($id: ID!, $entryId: ID) {
  attachShoppingListEntry(id: $id, entryId: $entryId)
}
    `) as unknown as TypedDocumentString<AttachShoppingListEntryMutation, AttachShoppingListEntryMutationVariables>;
export const AddShoppingItemDocument = new TypedDocumentString(`
    mutation AddShoppingItem($listId: ID!, $input: ShoppingItemInput!) {
  addShoppingItem(listId: $listId, input: $input)
}
    `) as unknown as TypedDocumentString<AddShoppingItemMutation, AddShoppingItemMutationVariables>;
export const AddShoppingProductsDocument = new TypedDocumentString(`
    mutation AddShoppingProducts($listId: ID!, $productIds: [ID!]!) {
  addShoppingProducts(listId: $listId, productIds: $productIds)
}
    `) as unknown as TypedDocumentString<AddShoppingProductsMutation, AddShoppingProductsMutationVariables>;
export const UpdateShoppingItemDocument = new TypedDocumentString(`
    mutation UpdateShoppingItem($id: ID!, $input: ShoppingItemInput!) {
  updateShoppingItem(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateShoppingItemMutation, UpdateShoppingItemMutationVariables>;
export const SetShoppingItemPurchasedDocument = new TypedDocumentString(`
    mutation SetShoppingItemPurchased($id: ID!, $purchased: Boolean!) {
  setShoppingItemPurchased(id: $id, purchased: $purchased)
}
    `) as unknown as TypedDocumentString<SetShoppingItemPurchasedMutation, SetShoppingItemPurchasedMutationVariables>;
export const SaveShoppingItemToBaseDocument = new TypedDocumentString(`
    mutation SaveShoppingItemToBase($id: ID!, $baseListId: ID!) {
  saveShoppingItemToBase(id: $id, baseListId: $baseListId)
}
    `) as unknown as TypedDocumentString<SaveShoppingItemToBaseMutation, SaveShoppingItemToBaseMutationVariables>;
export const DeleteShoppingItemDocument = new TypedDocumentString(`
    mutation DeleteShoppingItem($id: ID!) {
  deleteShoppingItem(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingItemMutation, DeleteShoppingItemMutationVariables>;
export const StockLocationsDocument = new TypedDocumentString(`
    query StockLocations {
  stockLocations {
    id
    archived
    label
    color
    iconUrl
    parentId
    position
  }
}
    `) as unknown as TypedDocumentString<StockLocationsQuery, StockLocationsQueryVariables>;
export const StockItemsDocument = new TypedDocumentString(`
    query StockItems {
  stockItems {
    id
    archived
    productId
    label
    categoryId
    unit
    locationId
    note
    perishable
    position
    createdAt
    updatedAt
    quantity
    consumable
    memberIds
    relationIds
    lots {
      id
      quantity
      expiresAt
      createdAt
    }
  }
}
    `) as unknown as TypedDocumentString<StockItemsQuery, StockItemsQueryVariables>;
export const StockMovementsDocument = new TypedDocumentString(`
    query StockMovements($itemId: ID) {
  stockMovements(itemId: $itemId) {
    id
    itemId
    itemLabel
    lotId
    kind
    quantity
    date
    note
    source
    shoppingListId
    sheetId
    countId
  }
}
    `) as unknown as TypedDocumentString<StockMovementsQuery, StockMovementsQueryVariables>;
export const StockCountsDocument = new TypedDocumentString(`
    query StockCounts {
  stockCounts {
    id
    date
    locationId
    note
    lines
  }
}
    `) as unknown as TypedDocumentString<StockCountsQuery, StockCountsQueryVariables>;
export const ProductStockDocument = new TypedDocumentString(`
    query ProductStock {
  productStock {
    productId
    quantity
  }
}
    `) as unknown as TypedDocumentString<ProductStockQuery, ProductStockQueryVariables>;
export const CreateStockLocationDocument = new TypedDocumentString(`
    mutation CreateStockLocation($input: StockLocationInput!) {
  createStockLocation(input: $input)
}
    `) as unknown as TypedDocumentString<CreateStockLocationMutation, CreateStockLocationMutationVariables>;
export const UpdateStockLocationDocument = new TypedDocumentString(`
    mutation UpdateStockLocation($id: ID!, $input: StockLocationInput!) {
  updateStockLocation(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateStockLocationMutation, UpdateStockLocationMutationVariables>;
export const MoveStockLocationDocument = new TypedDocumentString(`
    mutation MoveStockLocation($id: ID!, $parentId: ID, $index: Int) {
  moveStockLocation(id: $id, parentId: $parentId, index: $index)
}
    `) as unknown as TypedDocumentString<MoveStockLocationMutation, MoveStockLocationMutationVariables>;
export const DeleteStockLocationDocument = new TypedDocumentString(`
    mutation DeleteStockLocation($id: ID!) {
  deleteStockLocation(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteStockLocationMutation, DeleteStockLocationMutationVariables>;
export const CreateStockItemDocument = new TypedDocumentString(`
    mutation CreateStockItem($input: StockItemInput!) {
  createStockItem(input: $input)
}
    `) as unknown as TypedDocumentString<CreateStockItemMutation, CreateStockItemMutationVariables>;
export const UpdateStockItemDocument = new TypedDocumentString(`
    mutation UpdateStockItem($id: ID!, $input: StockItemInput!) {
  updateStockItem(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateStockItemMutation, UpdateStockItemMutationVariables>;
export const DeleteStockItemDocument = new TypedDocumentString(`
    mutation DeleteStockItem($id: ID!) {
  deleteStockItem(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteStockItemMutation, DeleteStockItemMutationVariables>;
export const MoveStockDocument = new TypedDocumentString(`
    mutation MoveStock($input: StockMoveInput!) {
  moveStock(input: $input)
}
    `) as unknown as TypedDocumentString<MoveStockMutation, MoveStockMutationVariables>;
export const SetStockLotExpiryDocument = new TypedDocumentString(`
    mutation SetStockLotExpiry($id: ID!, $expiresAt: Date) {
  setStockLotExpiry(id: $id, expiresAt: $expiresAt)
}
    `) as unknown as TypedDocumentString<SetStockLotExpiryMutation, SetStockLotExpiryMutationVariables>;
export const RecordStockCountDocument = new TypedDocumentString(`
    mutation RecordStockCount($input: StockCountInput!) {
  recordStockCount(input: $input)
}
    `) as unknown as TypedDocumentString<RecordStockCountMutation, RecordStockCountMutationVariables>;
export const SetProductStockDocument = new TypedDocumentString(`
    mutation SetProductStock($id: ID!, $input: ProductStockInput!) {
  setProductStock(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SetProductStockMutation, SetProductStockMutationVariables>;
export const AddStockPurchaseDocument = new TypedDocumentString(`
    mutation AddStockPurchase($input: StockPurchaseInput!) {
  addStockPurchase(input: $input)
}
    `) as unknown as TypedDocumentString<AddStockPurchaseMutation, AddStockPurchaseMutationVariables>;
export const SetShoppingOrderDocument = new TypedDocumentString(`
    mutation SetShoppingOrder($listId: ID!, $input: ShoppingOrderInput!) {
  setShoppingOrder(listId: $listId, input: $input)
}
    `) as unknown as TypedDocumentString<SetShoppingOrderMutation, SetShoppingOrderMutationVariables>;
export const CreateShoppingDeliveryDocument = new TypedDocumentString(`
    mutation CreateShoppingDelivery($listId: ID!, $input: ShoppingDeliveryInput!) {
  createShoppingDelivery(listId: $listId, input: $input)
}
    `) as unknown as TypedDocumentString<CreateShoppingDeliveryMutation, CreateShoppingDeliveryMutationVariables>;
export const UpdateShoppingDeliveryDocument = new TypedDocumentString(`
    mutation UpdateShoppingDelivery($id: ID!, $input: ShoppingDeliveryInput!) {
  updateShoppingDelivery(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<UpdateShoppingDeliveryMutation, UpdateShoppingDeliveryMutationVariables>;
export const DeleteShoppingDeliveryDocument = new TypedDocumentString(`
    mutation DeleteShoppingDelivery($id: ID!) {
  deleteShoppingDelivery(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteShoppingDeliveryMutation, DeleteShoppingDeliveryMutationVariables>;
export const SetShoppingDeliveryReceivedDocument = new TypedDocumentString(`
    mutation SetShoppingDeliveryReceived($id: ID!, $received: Boolean!) {
  setShoppingDeliveryReceived(id: $id, received: $received)
}
    `) as unknown as TypedDocumentString<SetShoppingDeliveryReceivedMutation, SetShoppingDeliveryReceivedMutationVariables>;
export const TaskAutomationsDocument = new TypedDocumentString(`
    query TaskAutomations {
  taskAutomations {
    ...TaskAutomationFields
  }
}
    fragment TaskAutomationFields on TaskAutomation {
  id
  label
  color
  iconUrl
  position
  archived
  enabled
  trigger
  condition
  actions
}`) as unknown as TypedDocumentString<TaskAutomationsQuery, TaskAutomationsQueryVariables>;
export const CreateTaskAutomationDocument = new TypedDocumentString(`
    mutation CreateTaskAutomation($input: TaskAutomationInput!) {
  createTaskAutomation(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<CreateTaskAutomationMutation, CreateTaskAutomationMutationVariables>;
export const UpdateTaskAutomationDocument = new TypedDocumentString(`
    mutation UpdateTaskAutomation($id: ID!, $input: TaskAutomationPatch!) {
  updateTaskAutomation(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTaskAutomationMutation, UpdateTaskAutomationMutationVariables>;
export const DeleteTaskAutomationDocument = new TypedDocumentString(`
    mutation DeleteTaskAutomation($id: ID!) {
  deleteTaskAutomation(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTaskAutomationMutation, DeleteTaskAutomationMutationVariables>;
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
    archived
    label
    color
    iconUrl
    position
  }
  taskTypes {
    id
    archived
    label
    color
    iconUrl
    position
  }
  taskTags {
    id
    archived
    label
    color
    iconUrl
    position
  }
  milestones {
    ...MilestoneFields
  }
  sprints {
    ...SprintFields
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment DeadTimeFields on DeadTime {
  label
  minutes
  ringtone
}
fragment ContributorFields on Contributor {
  id
  archived
  name
  handle
  avatarUrl
  isMe
  projectIds
  link
  relationId
  contactId
  linkName
  birthDate
  birthdayReminders {
    ...ReminderFields
  }
  emails
  phones
}
fragment SprintFields on Sprint {
  id
  archived
  projectId
  label
  goal
  startDate
  endDate
}
fragment MilestoneFields on Milestone {
  id
  archived
  projectId
  label
  description
  dueDate
  position
}
fragment TaskLabelFields on TaskStatus {
  id
  archived
  label
  color
  iconUrl
  position
}
fragment FieldOriginFields on FieldOrigin {
  field
  state
  source
  sourceId
}
fragment TaskFields on Task {
  id
  number
  label
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
  minDate
  effectiveDeadline
  effectiveMinDate
  deadlineSource
  minDateSource
  inheritedFields
  inheritance {
    ...FieldOriginFields
  }
  effective {
    projectId
    priorityId
    milestoneId
    assigneeIds
    beneficiaryIds
    beneficiaryRelationIds
    slotCondition
    hours
    location
    locationLat
    locationLon
    minDate
    deadline
  }
  cancelled
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  beneficiaryIds
  beneficiaryRelationIds
  libraryDocumentIds
  projectResourceIds
  tagIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  closed
  closedAt
  closeReason
  githubLinked
  githubUrl
  githubNumber
  githubState
  githubSendable
  slotCondition
  hours
  location
  locationLat
  locationLon
  links {
    url
    label
  }
  reminders {
    ...ReminderFields
  }
  deadTimes {
    ...DeadTimeFields
  }
  savedCountdownIds
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
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment DeadTimeFields on DeadTime {
  label
  minutes
  ringtone
}
fragment FieldOriginFields on FieldOrigin {
  field
  state
  source
  sourceId
}
fragment TaskFields on Task {
  id
  number
  label
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
  minDate
  effectiveDeadline
  effectiveMinDate
  deadlineSource
  minDateSource
  inheritedFields
  inheritance {
    ...FieldOriginFields
  }
  effective {
    projectId
    priorityId
    milestoneId
    assigneeIds
    beneficiaryIds
    beneficiaryRelationIds
    slotCondition
    hours
    location
    locationLat
    locationLon
    minDate
    deadline
  }
  cancelled
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  beneficiaryIds
  beneficiaryRelationIds
  libraryDocumentIds
  projectResourceIds
  tagIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  closed
  closedAt
  closeReason
  githubLinked
  githubUrl
  githubNumber
  githubState
  githubSendable
  slotCondition
  hours
  location
  locationLat
  locationLon
  links {
    url
    label
  }
  reminders {
    ...ReminderFields
  }
  deadTimes {
    ...DeadTimeFields
  }
  savedCountdownIds
}`) as unknown as TypedDocumentString<CreateTaskMutation, CreateTaskMutationVariables>;
export const UpdateTaskDocument = new TypedDocumentString(`
    mutation UpdateTask($id: ID!, $input: TaskUpdateInput!, $restoring: Boolean) {
  updateTask(id: $id, input: $input, restoring: $restoring) {
    ...TaskFields
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment DeadTimeFields on DeadTime {
  label
  minutes
  ringtone
}
fragment FieldOriginFields on FieldOrigin {
  field
  state
  source
  sourceId
}
fragment TaskFields on Task {
  id
  number
  label
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
  minDate
  effectiveDeadline
  effectiveMinDate
  deadlineSource
  minDateSource
  inheritedFields
  inheritance {
    ...FieldOriginFields
  }
  effective {
    projectId
    priorityId
    milestoneId
    assigneeIds
    beneficiaryIds
    beneficiaryRelationIds
    slotCondition
    hours
    location
    locationLat
    locationLon
    minDate
    deadline
  }
  cancelled
  position
  archived
  createdAt
  updatedAt
  assigneeIds
  beneficiaryIds
  beneficiaryRelationIds
  libraryDocumentIds
  projectResourceIds
  tagIds
  blockingIds
  blockedByIds
  relatedIds
  commentCount
  trackedSeconds
  closed
  closedAt
  closeReason
  githubLinked
  githubUrl
  githubNumber
  githubState
  githubSendable
  slotCondition
  hours
  location
  locationLat
  locationLon
  links {
    url
    label
  }
  reminders {
    ...ReminderFields
  }
  deadTimes {
    ...DeadTimeFields
  }
  savedCountdownIds
}`) as unknown as TypedDocumentString<UpdateTaskMutation, UpdateTaskMutationVariables>;
export const DuplicateTaskDocument = new TypedDocumentString(`
    mutation DuplicateTask($id: ID!, $includeSubtasks: Boolean!) {
  duplicateTask(id: $id, includeSubtasks: $includeSubtasks) {
    id
    number
  }
}
    `) as unknown as TypedDocumentString<DuplicateTaskMutation, DuplicateTaskMutationVariables>;
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
    mutation CreateContributor($input: ContributorInput!, $confirmLoss: Boolean) {
  createContributor(input: $input, confirmLoss: $confirmLoss) {
    ...ContributorFields
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment ContributorFields on Contributor {
  id
  archived
  name
  handle
  avatarUrl
  isMe
  projectIds
  link
  relationId
  contactId
  linkName
  birthDate
  birthdayReminders {
    ...ReminderFields
  }
  emails
  phones
}`) as unknown as TypedDocumentString<CreateContributorMutation, CreateContributorMutationVariables>;
export const UpdateContributorDocument = new TypedDocumentString(`
    mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!, $confirmLoss: Boolean) {
  updateContributor(id: $id, input: $input, confirmLoss: $confirmLoss) {
    ...ContributorFields
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}
fragment ContributorFields on Contributor {
  id
  archived
  name
  handle
  avatarUrl
  isMe
  projectIds
  link
  relationId
  contactId
  linkName
  birthDate
  birthdayReminders {
    ...ReminderFields
  }
  emails
  phones
}`) as unknown as TypedDocumentString<UpdateContributorMutation, UpdateContributorMutationVariables>;
export const SetProjectContributorsDocument = new TypedDocumentString(`
    mutation SetProjectContributors($projectId: ID!, $contributorIds: [ID!]!) {
  setProjectContributors(projectId: $projectId, contributorIds: $contributorIds)
}
    `) as unknown as TypedDocumentString<SetProjectContributorsMutation, SetProjectContributorsMutationVariables>;
export const DeleteContributorDocument = new TypedDocumentString(`
    mutation DeleteContributor($id: ID!, $confirmLoss: Boolean) {
  deleteContributor(id: $id, confirmLoss: $confirmLoss)
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
export const SetTasksClosedDocument = new TypedDocumentString(`
    mutation SetTasksClosed($ids: [ID!]!, $closed: Boolean!, $reason: TaskCloseReason, $restoring: Boolean) {
  setTasksClosed(
    ids: $ids
    closed: $closed
    reason: $reason
    restoring: $restoring
  )
}
    `) as unknown as TypedDocumentString<SetTasksClosedMutation, SetTasksClosedMutationVariables>;
export const BulkUpdateTasksDocument = new TypedDocumentString(`
    mutation BulkUpdateTasks($ids: [ID!]!, $changes: BulkTaskInput!, $restoring: Boolean) {
  bulkUpdateTasks(ids: $ids, changes: $changes, restoring: $restoring)
}
    `) as unknown as TypedDocumentString<BulkUpdateTasksMutation, BulkUpdateTasksMutationVariables>;
export const BulkTransferTasksDocument = new TypedDocumentString(`
    mutation BulkTransferTasks($ids: [ID!]!, $projectId: ID) {
  bulkTransferTasks(ids: $ids, projectId: $projectId) {
    removedLinks
    lost
  }
}
    `) as unknown as TypedDocumentString<BulkTransferTasksMutation, BulkTransferTasksMutationVariables>;
export const UndoTaskTransferDocument = new TypedDocumentString(`
    mutation UndoTaskTransfer($moves: [TaskProjectMoveInput!]!, $links: JSON!) {
  undoTaskTransfer(moves: $moves, links: $links)
}
    `) as unknown as TypedDocumentString<UndoTaskTransferMutation, UndoTaskTransferMutationVariables>;
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
export const DoableTasksDocument = new TypedDocumentString(`
    query DoableTasks {
  doableTasks {
    id
    reason
  }
}
    `) as unknown as TypedDocumentString<DoableTasksQuery, DoableTasksQueryVariables>;
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
  routines {
    id
    label
  }
  description
  startedAt
  endedAt
  pausedAt
  pausedSeconds
  duration
  taskIds
  documentId
  documentNumber
  events {
    eventId
    occurrenceDate
    label
  }
}`) as unknown as TypedDocumentString<TimeEntriesQuery, TimeEntriesQueryVariables>;
export const RunningTimeEntriesDocument = new TypedDocumentString(`
    query RunningTimeEntries {
  runningTimeEntries {
    ...TimeEntryFields
  }
}
    fragment TimeEntryFields on TimeEntry {
  id
  projectId
  routines {
    id
    label
  }
  description
  startedAt
  endedAt
  pausedAt
  pausedSeconds
  duration
  taskIds
  documentId
  documentNumber
  events {
    eventId
    occurrenceDate
    label
  }
}`) as unknown as TypedDocumentString<RunningTimeEntriesQuery, RunningTimeEntriesQueryVariables>;
export const StartTimerDocument = new TypedDocumentString(`
    mutation StartTimer($input: TimerInput!) {
  startTimer(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<StartTimerMutation, StartTimerMutationVariables>;
export const SetTimerPausedDocument = new TypedDocumentString(`
    mutation SetTimerPaused($id: ID!, $paused: Boolean!) {
  setTimerPaused(id: $id, paused: $paused) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetTimerPausedMutation, SetTimerPausedMutationVariables>;
export const StopTimerDocument = new TypedDocumentString(`
    mutation StopTimer($id: ID!) {
  stopTimer(id: $id) {
    id
    duration
  }
}
    `) as unknown as TypedDocumentString<StopTimerMutation, StopTimerMutationVariables>;
export const StopAllTimersDocument = new TypedDocumentString(`
    mutation StopAllTimers {
  stopAllTimers {
    id
    duration
  }
}
    `) as unknown as TypedDocumentString<StopAllTimersMutation, StopAllTimersMutationVariables>;
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
export const LostOnDeleteDocument = new TypedDocumentString(`
    query LostOnDelete($taskIds: [ID!], $routineIds: [ID!], $withSubtree: Boolean, $eventId: ID, $scope: CalendarEventScope, $occurrenceDate: Date, $calendarId: ID, $routineOccurrence: RoutineOccurrenceGoneInput) {
  lostOnDelete(
    taskIds: $taskIds
    routineIds: $routineIds
    withSubtree: $withSubtree
    eventId: $eventId
    scope: $scope
    occurrenceDate: $occurrenceDate
    calendarId: $calendarId
    routineOccurrence: $routineOccurrence
  ) {
    times
    comments
  }
}
    `) as unknown as TypedDocumentString<LostOnDeleteQuery, LostOnDeleteQueryVariables>;
export const DeleteTimeEntryDocument = new TypedDocumentString(`
    mutation DeleteTimeEntry($id: ID!) {
  deleteTimeEntry(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteTimeEntryMutation, DeleteTimeEntryMutationVariables>;
export const TreasuryAccountsDocument = new TypedDocumentString(`
    query TreasuryAccounts {
  treasuryAccounts {
    id
    label
    color
    iconUrl
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
    fragment LinkedDocumentFields on LinkedDocument {
  id
  source
  kind
  label
  url
  projectId
  place
}
fragment TreasuryEntryFields on TreasuryEntry {
  id
  archived
  accountId
  accountLabel
  status
  date
  valueDate
  label
  amount
  categoryId
  methodId
  methodLabel
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
      ...LinkedDocumentFields
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
    ...LinkedDocumentFields
  }
}`) as unknown as TypedDocumentString<TreasuryEntriesQuery, TreasuryEntriesQueryVariables>;
export const ForecastEntriesDocument = new TypedDocumentString(`
    query ForecastEntries {
  forecastEntries {
    ...TreasuryEntryFields
  }
}
    fragment LinkedDocumentFields on LinkedDocument {
  id
  source
  kind
  label
  url
  projectId
  place
}
fragment TreasuryEntryFields on TreasuryEntry {
  id
  archived
  accountId
  accountLabel
  status
  date
  valueDate
  label
  amount
  categoryId
  methodId
  methodLabel
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
      ...LinkedDocumentFields
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
    ...LinkedDocumentFields
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
      payerName
      amount
      kind
      overdue
      entryId
      documentId
      importedDocumentId
      recurringInvoiceId
      accountId
      archived
    }
  }
}
    `) as unknown as TypedDocumentString<TreasuryProjectionQuery, TreasuryProjectionQueryVariables>;
export const TreasurySettingsDocument = new TypedDocumentString(`
    query TreasurySettings {
  treasuryCategories {
    id
    archived
    label
    color
    iconUrl
    direction
    parentId
    position
    entryCount
  }
  treasuryPaymentMethods {
    id
    archived
    label
    color
    iconUrl
    position
    incoming
    outgoing
    entryCount
  }
  treasuryCounterparties {
    id
    name
    color
    iconUrl
    position
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
    scheduleTypeId
    archived
    label
    color
    iconUrl
    position
    workspaceLabel
  }
  treasuryRelations {
    id
    archived
    name
    note
    contributorId
    birthDate
    birthdayReminders {
      ...ReminderFields
    }
    emails
    phones
    lineCount
    budgetCount
  }
  treasuryContextEphemerides {
    contextId
    schedule {
      id
      label
      startDate
      endDate
      cases
      exceptions
    }
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}`) as unknown as TypedDocumentString<TreasurySettingsQuery, TreasurySettingsQueryVariables>;
export const TreasuryEntrySearchDocument = new TypedDocumentString(`
    query TreasuryEntrySearch($text: String!) {
  treasuryEntrySearch(text: $text, limit: 20) {
    id
    date
    label
    amount
    status
    accountLabel
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
export const MoveTreasuryCategoryDocument = new TypedDocumentString(`
    mutation MoveTreasuryCategory($id: ID!, $parentId: ID, $index: Int) {
  moveTreasuryCategory(id: $id, parentId: $parentId, index: $index)
}
    `) as unknown as TypedDocumentString<MoveTreasuryCategoryMutation, MoveTreasuryCategoryMutationVariables>;
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
export const InvoiceTreasuryCategoriesDocument = new TypedDocumentString(`
    query InvoiceTreasuryCategories {
  invoiceTreasuryCategories {
    invoiceCategoryId
    creditNoteCategoryId
  }
}
    `) as unknown as TypedDocumentString<InvoiceTreasuryCategoriesQuery, InvoiceTreasuryCategoriesQueryVariables>;
export const SetInvoiceTreasuryCategoriesDocument = new TypedDocumentString(`
    mutation SetInvoiceTreasuryCategories($invoiceCategoryId: ID, $creditNoteCategoryId: ID) {
  setInvoiceTreasuryCategories(
    invoiceCategoryId: $invoiceCategoryId
    creditNoteCategoryId: $creditNoteCategoryId
  )
}
    `) as unknown as TypedDocumentString<SetInvoiceTreasuryCategoriesMutation, SetInvoiceTreasuryCategoriesMutationVariables>;
export const AddTreasuryMemberDocument = new TypedDocumentString(`
    mutation AddTreasuryMember($contributorId: ID, $name: String, $confirmLoss: Boolean) {
  addTreasuryMember(
    contributorId: $contributorId
    name: $name
    confirmLoss: $confirmLoss
  )
}
    `) as unknown as TypedDocumentString<AddTreasuryMemberMutation, AddTreasuryMemberMutationVariables>;
export const RemoveTreasuryMemberDocument = new TypedDocumentString(`
    mutation RemoveTreasuryMember($contributorId: ID!, $confirmLoss: Boolean) {
  removeTreasuryMember(contributorId: $contributorId, confirmLoss: $confirmLoss)
}
    `) as unknown as TypedDocumentString<RemoveTreasuryMemberMutation, RemoveTreasuryMemberMutationVariables>;
export const UpdateTreasuryMemberDocument = new TypedDocumentString(`
    mutation UpdateTreasuryMember($contributorId: ID!, $input: TreasuryMemberDetailsInput!, $confirmLoss: Boolean) {
  updateTreasuryMember(
    contributorId: $contributorId
    input: $input
    confirmLoss: $confirmLoss
  ) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateTreasuryMemberMutation, UpdateTreasuryMemberMutationVariables>;
export const SaveTreasuryRelationDocument = new TypedDocumentString(`
    mutation SaveTreasuryRelation($id: ID, $input: TreasuryRelationInput!, $confirmLoss: Boolean) {
  saveTreasuryRelation(id: $id, input: $input, confirmLoss: $confirmLoss)
}
    `) as unknown as TypedDocumentString<SaveTreasuryRelationMutation, SaveTreasuryRelationMutationVariables>;
export const DeleteTreasuryRelationDocument = new TypedDocumentString(`
    mutation DeleteTreasuryRelation($id: ID!, $confirmLoss: Boolean) {
  deleteTreasuryRelation(id: $id, confirmLoss: $confirmLoss)
}
    `) as unknown as TypedDocumentString<DeleteTreasuryRelationMutation, DeleteTreasuryRelationMutationVariables>;
export const SaveTreasuryContextDocument = new TypedDocumentString(`
    mutation SaveTreasuryContext($id: ID, $input: LabelColorInput!) {
  saveTreasuryContext(id: $id, input: $input)
}
    `) as unknown as TypedDocumentString<SaveTreasuryContextMutation, SaveTreasuryContextMutationVariables>;
export const TreasuryBudgetsDocument = new TypedDocumentString(`
    query TreasuryBudgets($from: String!, $to: String!) {
  treasuryBudgets {
    id
    archived
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
export const WorkspacesDocument = new TypedDocumentString(`
    query Workspaces {
  workspaces {
    id
    label
    kind
    position
    notifyElsewhere
    weekStart
    weekEnd
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
export const SetWorkspaceWeekDocument = new TypedDocumentString(`
    mutation SetWorkspaceWeek($id: ID!, $start: Int!, $end: Int!) {
  setWorkspaceWeek(id: $id, start: $start, end: $end) {
    id
  }
}
    `) as unknown as TypedDocumentString<SetWorkspaceWeekMutation, SetWorkspaceWeekMutationVariables>;
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
export const ElsewhereAlarmsDocument = new TypedDocumentString(`
    query ElsewhereAlarms {
  alarms {
    ...AlarmFields
    task {
      id
      number
      label
      projectId
    }
    project {
      id
      label
    }
  }
  projects {
    id
    label
    parentId
  }
  runningTimeEntries {
    id
    projectId
    taskIds
    startedAt
    endedAt
    pausedAt
    pausedSeconds
    duration
  }
}
    fragment AlarmFields on Alarm {
  id
  label
  note
  type
  startDate
  time
  frequency
  interval
  weekdays
  endDate
  recurrence
  minutes
  projectId
  taskId
  enabled
  lastFiredAt
  createdAt
}`) as unknown as TypedDocumentString<ElsewhereAlarmsQuery, ElsewhereAlarmsQueryVariables>;
export const ElsewhereRemindersDocument = new TypedDocumentString(`
    query ElsewhereReminders {
  tasks {
    id
    number
    label
    projectId
    closed
    archived
    effectiveMinDate
    effectiveDeadline
    reminders {
      ...ReminderFields
    }
  }
  routines {
    id
    label
    archived
    location
    estimate
    currentDate
    reminders {
      ...ReminderFields
    }
    reminderOccurrences {
      date
      dueDate
      day
      slots {
        slot
        fromTime
        dueTime
      }
    }
    slots {
      index
      fromTime
      dueTime
      optional
      done
      doneAt
      windows
    }
  }
  workSchedules {
    id
    archived
    label
    startDate
    endDate
    typeId
    ephemeris
    cases
    exceptions
    reminders {
      ...ReminderFields
    }
  }
  birthdays {
    id
    name
    birthDate
    reminders {
      ...ReminderFields
    }
  }
}
    fragment ReminderFields on Reminder {
  before
  at
  days
  anchor
  ringtone
}`) as unknown as TypedDocumentString<ElsewhereRemindersQuery, ElsewhereRemindersQueryVariables>;
export const ElsewhereMarkAlarmFiredDocument = new TypedDocumentString(`
    mutation ElsewhereMarkAlarmFired($id: ID!, $at: DateTime!) {
  markAlarmFired(id: $id, at: $at)
}
    `) as unknown as TypedDocumentString<ElsewhereMarkAlarmFiredMutation, ElsewhereMarkAlarmFiredMutationVariables>;
export const SetArchivedDocument = new TypedDocumentString(`
    mutation SetArchived($kind: ArchivableKind!, $ids: [ID!]!, $archived: Boolean!, $confirmLoss: Boolean) {
  setArchived(
    kind: $kind
    ids: $ids
    archived: $archived
    confirmLoss: $confirmLoss
  )
}
    `) as unknown as TypedDocumentString<SetArchivedMutation, SetArchivedMutationVariables>;