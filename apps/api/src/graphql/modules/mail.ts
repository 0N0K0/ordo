import { prisma } from '../../db';
import * as accounts from '../../services/mail/accounts';
import * as drafts from '../../services/mail/drafts';
import * as linked from '../../services/mail/linked';
import * as reader from '../../services/mail/reader';
import { sendMail } from '../../services/mail/sender';
import { builder } from '../builder';

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
    },
    resolve: (_root, { accountId, folder, page, search, unread }) => reader.listMessages(accountId, folder, Math.max(0, page), search ?? '', unread ?? false),
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
