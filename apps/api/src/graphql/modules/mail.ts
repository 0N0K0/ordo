import { prisma } from '../../db';
import * as accounts from '../../services/mail/accounts';
import * as drafts from '../../services/mail/drafts';
import * as linked from '../../services/mail/linked';
import * as reader from '../../services/mail/reader';
import * as organize from '../../services/mail/organize';
import * as scheduled from '../../services/mail/scheduled';
import * as searches from '../../services/mail/searches';
import { sendMail } from '../../services/mail/sender';
import { builder } from '../builder';

builder.prismaObject('MailLabel', {
  description: 'Flag of mails (name, color).',
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('name'), color: t.exposeString('color'), position: t.exposeInt('position') }),
});

builder.prismaObject('MailSearch', {
  description: 'Search folder, kept in Ordo (not on the mail server).',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    criteria: t.field({ type: 'JSON', description: 'accountIds, scope, state, labelIds, unread, text.', resolve: (search) => searches.searchCriteria(search) }),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('ScheduledMail', {
  description: 'Mail waiting to be sent at its time (or failed).',
  fields: (t) => ({
    id: t.exposeID('id'),
    accountId: t.exposeID('accountId'),
    sendAt: t.expose('sendAt', { type: 'DateTime' }),
    subject: t.exposeString('subject'),
    to: t.exposeStringList('to'),
    status: t.exposeString('status', { description: 'PENDING, SENDING or FAILED.' }),
    error: t.exposeString('error', { nullable: true }),
  }),
});

builder.prismaObject('MailAccount', {
  description: 'Mailbox settings (passwords are never returned).',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    email: t.exposeString('email'),
    displayName: t.exposeString('displayName', { nullable: true }),
    imapHost: t.exposeString('imapHost'),
    imapPort: t.exposeInt('imapPort'),
    imapSecure: t.exposeBoolean('imapSecure'),
    imapUser: t.exposeString('imapUser'),
    smtpHost: t.exposeString('smtpHost'),
    smtpPort: t.exposeInt('smtpPort'),
    smtpSecure: t.exposeBoolean('smtpSecure'),
    smtpUser: t.exposeString('smtpUser'),
    saveSent: t.exposeBoolean('saveSent'),
    signature: t.exposeString('signature', { nullable: true }),
  }),
});

const MailAddress = builder.objectRef<reader.MailAddress>('MailAddress').implement({
  fields: (t) => ({ name: t.exposeString('name', { nullable: true }), address: t.exposeString('address') }),
});

const MailFolder = builder.objectRef<reader.MailFolder>('MailFolder').implement({
  fields: (t) => ({
    path: t.exposeString('path'),
    name: t.exposeString('name'),
    specialUse: t.exposeString('specialUse', { nullable: true }),
    unseen: t.exposeInt('unseen'),
    depth: t.exposeInt('depth'),
    parent: t.exposeString('parent', { nullable: true }),
    todo: t.exposeInt('todo', { nullable: true, description: 'Mails to do; null for the sent, drafts, archive, trash and junk folders.' }),
  }),
});

const MailSummary = builder.objectRef<reader.MailSummary>('MailSummary').implement({
  fields: (t) => ({
    uid: t.exposeInt('uid'),
    subject: t.exposeString('subject'),
    from: t.field({ type: [MailAddress], resolve: (mail) => mail.from }),
    to: t.field({ type: [MailAddress], resolve: (mail) => mail.to }),
    date: t.expose('date', { type: 'DateTime' }),
    seen: t.exposeBoolean('seen'),
    flagged: t.exposeBoolean('flagged'),
    hasAttachments: t.exposeBoolean('hasAttachments'),
    labelIds: t.exposeIDList('labelIds', { description: 'Flags set by the user.' }),
    done: t.exposeBoolean('done', { description: 'Marked as done.' }),
  }),
});

const MailPage = builder.objectRef<{ messages: reader.MailSummary[]; total: number }>('MailPage').implement({
  fields: (t) => ({
    messages: t.field({ type: [MailSummary], resolve: (page) => page.messages }),
    total: t.exposeInt('total'),
    pageSize: t.int({ resolve: () => reader.PAGE_SIZE }),
  }),
});

const MailAttachmentInfo = builder.objectRef<reader.MailAttachmentInfo>('MailAttachmentInfo').implement({
  fields: (t) => ({
    index: t.exposeInt('index'),
    filename: t.exposeString('filename'),
    contentType: t.exposeString('contentType'),
    size: t.exposeInt('size'),
    inline: t.exposeBoolean('inline'),
  }),
});

const MailView = builder.objectRef<reader.MailView>('MailView').implement({
  description: 'Message read from the server.',
  fields: (t) => ({
    accountId: t.exposeID('accountId'),
    folder: t.exposeString('folder'),
    uid: t.exposeInt('uid'),
    messageId: t.exposeString('messageId', { nullable: true }),
    inReplyTo: t.exposeString('inReplyTo', { nullable: true }),
    references: t.exposeStringList('references'),
    subject: t.exposeString('subject'),
    from: t.field({ type: [MailAddress], resolve: (mail) => mail.from }),
    to: t.field({ type: [MailAddress], resolve: (mail) => mail.to }),
    cc: t.field({ type: [MailAddress], resolve: (mail) => mail.cc }),
    replyTo: t.field({ type: [MailAddress], resolve: (mail) => mail.replyTo }),
    date: t.expose('date', { type: 'DateTime' }),
    html: t.exposeString('html', { nullable: true }),
    text: t.exposeString('text', { nullable: true }),
    attachments: t.field({ type: [MailAttachmentInfo], resolve: (mail) => mail.attachments }),
    labelIds: t.exposeIDList('labelIds'),
    done: t.exposeBoolean('done'),
    linkedProjectIds: t.idList({
      description: 'Projects this message is linked to.',
      resolve: async (mail) =>
        mail.messageId
          ? (await prisma.mailMessage.findMany({ where: { messageId: mail.messageId }, select: { projectId: true } })).map(
              (item) => item.projectId,
            )
          : [],
    }),
  }),
});

const LinkedMailAttachment = builder
  .objectRef<{ id: string; name: string; size: number; contentId: string | null }>('LinkedMailAttachment')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      size: t.exposeInt('size'),
      inline: t.boolean({ resolve: (attachment) => attachment.contentId !== null }),
      url: t.string({ resolve: (attachment) => `/api/attachments/${attachment.id}/${encodeURIComponent(attachment.name)}` }),
    }),
  });

/**
 * Addresses stored as JSON.
 * @param {unknown} value JSON value.
 * @returns {reader.MailAddress[]} Addresses.
 */
const jsonAddresses = (value: unknown) => (Array.isArray(value) ? (value as reader.MailAddress[]) : []);

builder.prismaObject('MailMessage', {
  name: 'LinkedMail',
  description: 'Copy of a mail linked to a project.',
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    accountId: t.exposeID('accountId', { nullable: true }),
    messageId: t.exposeString('messageId'),
    inReplyTo: t.exposeString('inReplyTo', { nullable: true }),
    references: t.exposeStringList('references'),
    subject: t.exposeString('subject'),
    from: t.field({
      type: [MailAddress],
      resolve: (mail) => [{ name: mail.fromName, address: mail.fromAddress }],
    }),
    to: t.field({ type: [MailAddress], resolve: (mail) => jsonAddresses(mail.to) }),
    cc: t.field({ type: [MailAddress], resolve: (mail) => jsonAddresses(mail.cc) }),
    date: t.expose('date', { type: 'DateTime' }),
    html: t.exposeString('html', { nullable: true }),
    text: t.exposeString('text', { nullable: true }),
    sent: t.exposeBoolean('sent'),
    attachments: t.field({
      type: [LinkedMailAttachment],
      select: { attachments: { select: { id: true, name: true, size: true, contentId: true } } },
      resolve: (mail) => mail.attachments,
    }),
  }),
});

const MailAccountInput = builder.inputType('MailAccountInput', {
  description: 'Empty passwords keep the saved ones on edition.',
  fields: (t) => ({
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    displayName: t.string({ required: true }),
    imapHost: t.string({ required: true }),
    imapPort: t.int({ required: true }),
    imapSecure: t.boolean({ required: true }),
    imapUser: t.string({ required: true }),
    imapPassword: t.string({ required: true }),
    smtpHost: t.string({ required: true }),
    smtpPort: t.int({ required: true }),
    smtpSecure: t.boolean({ required: true }),
    smtpUser: t.string({ required: true }),
    smtpPassword: t.string({ required: true }),
    saveSent: t.boolean({ required: true }),
  }),
});

const AttachmentsFromInput = builder.inputType('MailAttachmentsFromInput', {
  description: 'Files of another message to attach again (forward, or files kept from a draft).',
  fields: (t) => ({
    accountId: t.id({ required: true }),
    folder: t.string({ required: true }),
    uid: t.int({ required: true }),
    indexes: t.intList({ description: 'Attachment numbers; omitted: every file that is not an inline image.' }),
  }),
});

const MailLocationInput = builder.inputType('MailLocationInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    folder: t.string({ required: true }),
    uid: t.int({ required: true }),
  }),
});

const SendMailInput = builder.inputType('SendMailInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    to: t.stringList({ required: true }),
    cc: t.stringList(),
    bcc: t.stringList(),
    subject: t.string({ required: true }),
    html: t.string({ required: true, description: 'Body, signature and quote included.' }),
    attachments: t.field({ type: ['File'] }),
    attachmentsFrom: t.field({ type: AttachmentsFromInput }),
    inReplyTo: t.string(),
    references: t.stringList(),
    projectId: t.id({ description: 'Project the mail is written from: the sent mail is linked to it.' }),
    draft: t.field({ type: MailLocationInput, description: 'Draft the mail comes from, deleted once sent.' }),
  }),
});

const SaveDraftInput = builder.inputType('SaveMailDraftInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    to: t.stringList({ required: true }),
    cc: t.stringList(),
    bcc: t.stringList(),
    subject: t.string({ required: true }),
    html: t.string({ required: true }),
    attachments: t.field({ type: ['File'] }),
    attachmentsFrom: t.field({ type: AttachmentsFromInput }),
    inReplyTo: t.string(),
    references: t.stringList(),
    projectId: t.id(),
    replace: t.field({ type: MailLocationInput, description: 'Previous version of the draft, replaced.' }),
  }),
});

const SavedDraft = builder.objectRef<drafts.SavedDraft>('SavedMailDraft').implement({
  fields: (t) => ({
    accountId: t.exposeID('accountId'),
    folder: t.exposeString('folder'),
    uid: t.exposeInt('uid'),
    attachments: t.field({ type: [MailAttachmentInfo], resolve: (draft) => draft.attachments }),
  }),
});

const MailDraft = builder.objectRef<drafts.DraftView>('MailDraft').implement({
  fields: (t) => ({
    accountId: t.exposeID('accountId'),
    folder: t.exposeString('folder'),
    uid: t.exposeInt('uid'),
    to: t.field({ type: [MailAddress], resolve: (draft) => draft.to }),
    cc: t.field({ type: [MailAddress], resolve: (draft) => draft.cc }),
    bcc: t.field({ type: [MailAddress], resolve: (draft) => draft.bcc }),
    subject: t.exposeString('subject'),
    html: t.exposeString('html', { nullable: true }),
    text: t.exposeString('text', { nullable: true }),
    inReplyTo: t.exposeString('inReplyTo', { nullable: true }),
    references: t.exposeStringList('references'),
    projectId: t.exposeID('projectId', { nullable: true }),
    attachments: t.field({ type: [MailAttachmentInfo], resolve: (draft) => draft.attachments }),
  }),
});

const MailSearchHit = builder.objectRef<searches.MailSearchHit>('MailSearchHit').implement({
  description: 'Mail found by a search folder, with its account and folder.',
  fields: (t) => ({
    accountId: t.exposeID('accountId'),
    folder: t.exposeString('folder'),
    folderName: t.exposeString('folderName'),
    uid: t.exposeInt('uid'),
    subject: t.exposeString('subject'),
    from: t.field({ type: [MailAddress], resolve: (mail) => mail.from }),
    to: t.field({ type: [MailAddress], resolve: (mail) => mail.to }),
    date: t.expose('date', { type: 'DateTime' }),
    seen: t.exposeBoolean('seen'),
    flagged: t.exposeBoolean('flagged'),
    hasAttachments: t.exposeBoolean('hasAttachments'),
    labelIds: t.exposeIDList('labelIds'),
    done: t.exposeBoolean('done'),
  }),
});

const MailSearchPage = builder.objectRef<{ messages: searches.MailSearchHit[]; total: number }>('MailSearchPage').implement({
  fields: (t) => ({
    messages: t.field({ type: [MailSearchHit], resolve: (page) => page.messages }),
    total: t.exposeInt('total'),
    pageSize: t.int({ resolve: () => reader.PAGE_SIZE }),
  }),
});

const MailSearchInput = builder.inputType('MailSearchInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    accountIds: t.idList({ required: true }),
    scope: t.string({ required: true, description: 'inbox, all or folder.' }),
    folder: t.string({ description: 'Folder path, with the folder scope.' }),
    state: t.string({ required: true, description: 'all, todo or done.' }),
    labelIds: t.idList({ required: true }),
    unread: t.boolean({ required: true }),
    text: t.string({ required: true }),
    from: t.string(),
    to: t.string(),
    subject: t.string(),
    body: t.string(),
    since: t.field({ type: 'Date' }),
    until: t.field({ type: 'Date' }),
    attachments: t.boolean(),
  }),
});

builder.queryFields((t) => ({
  mailAccounts: t.prismaField({
    type: ['MailAccount'],
    resolve: (query) => prisma.mailAccount.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  mailFolders: t.field({
    type: [MailFolder],
    args: { accountId: t.arg.id({ required: true }) },
    resolve: (_root, { accountId }) => reader.listFolders(accountId),
  }),
  mailMessages: t.field({
    type: MailPage,
    description: 'A page of a folder, latest first (optionally the unread messages only).',
    args: {
      accountId: t.arg.id({ required: true }),
      folder: t.arg.string({ required: true }),
      page: t.arg.int({ required: true }),
      search: t.arg.string(),
      unread: t.arg.boolean(),
      state: t.arg.string({ description: 'all (default), todo or done.' }),
      sort: t.arg.string({ description: 'date (default), correspondent, subject or size.' }),
      ascending: t.arg.boolean({ description: 'Ascending order (descending by default).' }),
    },
    resolve: (_root, { accountId, folder, page, search, unread, state, sort, ascending }) =>
      reader.listMessages(accountId, folder, Math.max(0, page), search ?? '', unread ?? false, state === 'todo' || state === 'done' ? state : 'all', {
        by: sort === 'correspondent' || sort === 'subject' || sort === 'size' ? sort : 'date',
        ascending: ascending ?? false,
      }),
  }),
  mailSearches: t.prismaField({
    type: ['MailSearch'],
    resolve: (query) => prisma.mailSearch.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  mailSearchResults: t.field({
    type: MailSearchPage,
    description: 'A page of the mails of a search folder, latest first.',
    args: { id: t.arg.id({ required: true }), page: t.arg.int({ required: true }) },
    resolve: (_root, { id, page }) => searches.searchResults(id, Math.max(0, page)),
  }),
  mailAdvancedSearch: t.field({
    type: MailSearchPage,
    description: 'A page of the mails matching criteria (shared mail search criteria), latest first; not saved.',
    args: { criteria: t.arg({ type: 'JSON', required: true }), page: t.arg.int({ required: true }) },
    resolve: (_root, { criteria, page }) => searches.advancedSearch(criteria, Math.max(0, page)),
  }),
  mailLabels: t.prismaField({
    type: ['MailLabel'],
    resolve: (query) => prisma.mailLabel.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  scheduledMails: t.prismaField({
    type: ['ScheduledMail'],
    description: 'Mails waiting to be sent, and those that failed.',
    resolve: (query) => prisma.scheduledMail.findMany({ ...query, where: { status: { in: ['PENDING', 'SENDING', 'FAILED'] } }, orderBy: { sendAt: 'asc' } }),
  }),
  mailMessage: t.field({
    type: MailView,
    description: 'Opens a message (and marks it as read).',
    args: { accountId: t.arg.id({ required: true }), folder: t.arg.string({ required: true }), uid: t.arg.int({ required: true }) },
    resolve: (_root, { accountId, folder, uid }) => reader.readMessage(accountId, folder, uid),
  }),
  mailDraft: t.field({
    type: MailDraft,
    description: 'Opens a draft to go on writing it.',
    args: { accountId: t.arg.id({ required: true }), folder: t.arg.string({ required: true }), uid: t.arg.int({ required: true }) },
    resolve: (_root, { accountId, folder, uid }) => drafts.readDraft(accountId, folder, uid),
  }),
  todoMailCount: t.int({
    description: 'Mails to do (not marked as done) of every account, in every folder but drafts, sent, archive, junk and trash.',
    resolve: () => reader.todoMails(),
  }),
  unreadMailCount: t.int({
    description: 'Unread mails in the inbox of every account.',
    resolve: () => reader.unreadInboxes(),
  }),
  projectMails: t.prismaField({
    type: ['MailMessage'],
    description: 'Mails linked to a project, latest first.',
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (query, _root, { projectId }) => prisma.mailMessage.findMany({ ...query, where: { projectId }, orderBy: { date: 'desc' } }),
  }),
}));

builder.mutationFields((t) => ({
  testMailAccount: t.boolean({
    description: 'Connects to the IMAP and SMTP servers; empty passwords use those saved for `id`.',
    args: { input: t.arg({ type: MailAccountInput, required: true }), id: t.arg.id() },
    resolve: async (_root, { input, id }) => {
      await accounts.testMailAccount({ ...input, id: id ?? undefined });
      return true;
    },
  }),
  createMailAccount: t.prismaField({
    type: 'MailAccount',
    args: { input: t.arg({ type: MailAccountInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.mailAccount.findUniqueOrThrow({ ...query, where: { id: (await accounts.createMailAccount(input)).id } }),
  }),
  updateMailAccount: t.prismaField({
    type: 'MailAccount',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: MailAccountInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.mailAccount.findUniqueOrThrow({ ...query, where: { id: (await accounts.updateMailAccount(id, input)).id } }),
  }),
  setMailSignature: t.prismaField({
    type: 'MailAccount',
    args: { id: t.arg.id({ required: true }), signature: t.arg.string({ required: true }) },
    resolve: async (query, _root, { id, signature }) =>
      prisma.mailAccount.findUniqueOrThrow({ ...query, where: { id: (await accounts.setMailSignature(id, signature)).id } }),
  }),
  deleteMailAccount: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await accounts.deleteMailAccount(id);
      return true;
    },
  }),
  moveMailAccount: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await accounts.moveMailAccount(id, index);
      return true;
    },
  }),
  setMailSeen: t.boolean({
    args: {
      accountId: t.arg.id({ required: true }),
      folder: t.arg.string({ required: true }),
      uids: t.arg.intList({ required: true }),
      seen: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, { accountId, folder, uids, seen }) => {
      await reader.setSeen(accountId, folder, uids, seen);
      return true;
    },
  }),
  markMails: t.boolean({
    description: 'Adds or removes a flag (labelId and on), or sets the done state (done), on mails.',
    args: {
      accountId: t.arg.id({ required: true }),
      folder: t.arg.string({ required: true }),
      uids: t.arg.intList({ required: true }),
      labelId: t.arg.id(),
      on: t.arg.boolean(),
      done: t.arg.boolean(),
    },
    resolve: async (_root, { accountId, folder, uids, labelId, on, done }) => {
      await organize.markMails(accountId, folder, uids, labelId ? { labelId: String(labelId), on: on ?? true } : { done: done ?? true });
      return true;
    },
  }),
  reportMailSpam: t.string({
    description: 'Reports mails as spam (to the junk folder) or not (back to the inbox); returns the folder they are in.',
    args: { accountId: t.arg.id({ required: true }), folder: t.arg.string({ required: true }), uids: t.arg.intList({ required: true }), spam: t.arg.boolean({ required: true }) },
    resolve: (_root, { accountId, folder, uids, spam }) => organize.reportSpam(accountId, folder, uids, spam),
  }),
  moveMails: t.boolean({
    args: { accountId: t.arg.id({ required: true }), folder: t.arg.string({ required: true }), uids: t.arg.intList({ required: true }), target: t.arg.string({ required: true }) },
    resolve: async (_root, { accountId, folder, uids, target }) => {
      await organize.moveMails(accountId, folder, uids, target);
      return true;
    },
  }),
  createMailFolder: t.string({
    description: 'Creates a folder (under another one, or at the top); returns its path.',
    args: { accountId: t.arg.id({ required: true }), parent: t.arg.string(), name: t.arg.string({ required: true }) },
    resolve: (_root, { accountId, parent, name }) => organize.createFolder(accountId, parent ?? null, name),
  }),
  renameMailFolder: t.string({
    description: 'Renames a folder; returns its new path.',
    args: { accountId: t.arg.id({ required: true }), path: t.arg.string({ required: true }), name: t.arg.string({ required: true }) },
    resolve: (_root, { accountId, path, name }) => organize.renameFolder(accountId, path, name),
  }),
  moveMailFolder: t.string({
    description: 'Moves a folder (and its sub-folders) under another one, or to the top; returns its new path.',
    args: { accountId: t.arg.id({ required: true }), path: t.arg.string({ required: true }), parent: t.arg.string() },
    resolve: (_root, { accountId, path, parent }) => organize.moveFolder(accountId, path, parent ?? null),
  }),
  deleteMailFolder: t.boolean({
    description: 'Deletes a folder and its mails.',
    args: { accountId: t.arg.id({ required: true }), path: t.arg.string({ required: true }) },
    resolve: async (_root, { accountId, path }) => {
      await organize.deleteFolder(accountId, path);
      return true;
    },
  }),
  createMailLabel: t.id({
    args: { name: t.arg.string({ required: true }), color: t.arg.string({ required: true }) },
    resolve: async (_root, args) => (await organize.createLabel(args)).id,
  }),
  updateMailLabel: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }), color: t.arg.string({ required: true }) },
    resolve: async (_root, { id, ...input }) => {
      await organize.updateLabel(id, input);
      return true;
    },
  }),
  deleteMailLabel: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await organize.deleteLabel(id);
      return true;
    },
  }),
  createMailSearch: t.id({
    args: { input: t.arg({ type: MailSearchInput, required: true }) },
    resolve: async (_root, { input }) => (await searches.createSearch(input as never)).id,
  }),
  updateMailSearch: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: MailSearchInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await searches.updateSearch(id, input as never);
      return true;
    },
  }),
  deleteMailSearch: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await searches.deleteSearch(id);
      return true;
    },
  }),
  scheduleMail: t.id({
    description: 'Schedules a mail (built now, sent at its time); its draft is removed.',
    args: { input: t.arg({ type: SendMailInput, required: true }), sendAt: t.arg({ type: 'DateTime', required: true }) },
    resolve: async (_root, { input, sendAt }) => (await scheduled.scheduleMail(input, sendAt)).id,
  }),
  sendScheduledMail: t.boolean({
    description: 'Sends a scheduled (or failed) mail now.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await scheduled.sendScheduled(id);
      return true;
    },
  }),
  cancelScheduledMail: t.boolean({
    description: 'Cancels a scheduled mail: it goes back to the drafts.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await scheduled.cancelScheduled(id);
      return true;
    },
  }),
  deleteMails: t.boolean({
    description: 'Moves mails to the trash (deletes them for good from the trash).',
    args: { accountId: t.arg.id({ required: true }), folder: t.arg.string({ required: true }), uids: t.arg.intList({ required: true }) },
    resolve: async (_root, { accountId, folder, uids }) => {
      await reader.deleteMessages(accountId, folder, uids);
      return true;
    },
  }),
  linkMail: t.prismaField({
    type: 'MailMessage',
    description: 'Links a mail to a project (a copy is kept in Ordo).',
    args: {
      accountId: t.arg.id({ required: true }),
      folder: t.arg.string({ required: true }),
      uid: t.arg.int({ required: true }),
      projectId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, { accountId, folder, uid, projectId }) =>
      prisma.mailMessage.findUniqueOrThrow({
        ...query,
        where: { id: (await linked.linkMessage(accountId, folder, uid, projectId)).id },
      }),
  }),
  unlinkMail: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await linked.unlinkMail(id);
      return true;
    },
  }),
  saveMailDraft: t.field({
    type: SavedDraft,
    description: 'Saves a draft in the drafts folder of its account, replacing its previous version.',
    args: { input: t.arg({ type: SaveDraftInput, required: true }) },
    resolve: (_root, { input }) => drafts.saveDraft(input),
  }),
  deleteMailDraft: t.boolean({
    description: 'Deletes a draft for good.',
    args: { location: t.arg({ type: MailLocationInput, required: true }) },
    resolve: async (_root, { location }) => {
      await drafts.deleteDraft(location.accountId, location.folder, location.uid);
      return true;
    },
  }),
  sendMail: t.idList({
    description: 'Sends a mail; returns the projects it was linked to.',
    args: { input: t.arg({ type: SendMailInput, required: true }) },
    resolve: async (_root, { input }) => (await sendMail(input)).projectIds,
  }),
}));
