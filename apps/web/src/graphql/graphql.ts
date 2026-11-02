/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
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

export type ClientInput = {
  color?: string | null | undefined;
  icon?: File | null | undefined;
  name: string;
};

export type ClientUpdateInput = {
  /** null clears the color. */
  color?: string | null | undefined;
  /** Replaces the current icon. */
  icon?: File | null | undefined;
  name?: string | null | undefined;
  removeIcon?: boolean | null | undefined;
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

export type TaskInput = {
  assigneeIds?: Array<string | number> | null | undefined;
  description?: string | null | undefined;
  effort?: number | null | undefined;
  endDate?: string | null | undefined;
  milestoneId?: string | number | null | undefined;
  parentId?: string | number | null | undefined;
  priorityId?: string | number | null | undefined;
  projectId: string | number;
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

export type MilestoneFieldsFragment = { id: string, projectId: string, title: string, description: string | null, dueDate: string | null, position: number };

export type TaskLabelFieldsFragment = { id: string, name: string, color: string, position: number };

export type TaskFieldsFragment = { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean };

export type TaskCommentFieldsFragment = { id: string, body: string, createdAt: string };

export type TasksDataQueryVariables = Exact<{ [key: string]: never; }>;


export type TasksDataQuery = { tasks: Array<{ id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean }>, contributors: Array<{ id: string, name: string, handle: string, avatarUrl: string | null, isMe: boolean, projectIds: Array<string> }>, taskStatuses: Array<{ category: TaskStatusCategory, id: string, name: string, color: string, position: number }>, taskPriorities: Array<{ id: string, name: string, color: string, position: number }>, taskTypes: Array<{ id: string, name: string, color: string, position: number }>, milestones: Array<{ id: string, projectId: string, title: string, description: string | null, dueDate: string | null, position: number }> };

export type TaskCommentsQueryVariables = Exact<{
  number: number;
}>;


export type TaskCommentsQuery = { task: { id: string, comments: Array<{ id: string, body: string, createdAt: string }> } | null };

export type CreateTaskMutationVariables = Exact<{
  input: TaskInput;
}>;


export type CreateTaskMutation = { createTask: { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean } };

export type UpdateTaskMutationVariables = Exact<{
  id: string | number;
  input: TaskUpdateInput;
}>;


export type UpdateTaskMutation = { updateTask: { id: string, number: number, title: string, description: string | null, projectId: string, statusId: string | null, priorityId: string | null, typeId: string | null, effort: number | null, startDate: string | null, endDate: string | null, parentId: string | null, milestoneId: string | null, position: number, archived: boolean, createdAt: string, updatedAt: string, assigneeIds: Array<string>, blockingIds: Array<string>, blockedByIds: Array<string>, relatedIds: Array<string>, commentCount: number, trackedSeconds: number, recurrence: unknown, seriesId: string | null, occurrenceDate: string | null, closed: boolean } };

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

export type TimeEntryFieldsFragment = { id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string> };

export type TimeEntriesQueryVariables = Exact<{
  projectId?: string | number | null | undefined;
}>;


export type TimeEntriesQuery = { timeEntries: Array<{ id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string> }> };

export type RunningTimeEntryQueryVariables = Exact<{ [key: string]: never; }>;


export type RunningTimeEntryQuery = { runningTimeEntry: { id: string, projectId: string, description: string | null, startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null, taskIds: Array<string> } | null };

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
}
    `, {"fragmentName":"TimeEntryFields"}) as unknown as TypedDocumentString<TimeEntryFieldsFragment, unknown>;
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
}
    fragment ContributorFields on Contributor {
  id
  name
  handle
  avatarUrl
  isMe
  projectIds
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