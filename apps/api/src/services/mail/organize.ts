import type { ImapFlow, ListResponse } from 'imapflow';
import { mailFolderNameSchema } from '@ordo/shared';
import { prisma } from '../../db';
import { assertActive, assertNotArchived } from '../core/archive';
import type { MailLabel } from '../../generated/prisma/client';
import { clientError, notFound, parseInput } from '../../graphql/errors';
import { INBOX, isInbox, withImap, withMailbox } from './imap';
import { DONE_KEYWORD, labelKeyword, messageIdsOf, takesKeywords } from './keywords';
import { assertExists } from '../core/lookup';
import { createLabelService } from '../core/labels';

/** Keywords of the spam state, as most clients and servers read them. */
const JUNK = '$Junk';
const NOT_JUNK = '$NotJunk';

/** Change of the marks of mails: a flag added or removed, or the done state. */
type MarkChange = { labelId: string; on: boolean } | { done: boolean };

/**
 * Sets a flag or the done state on mails: IMAP keywords when the folder takes them, else marks kept in Ordo
 * (by Message-ID, so they follow the mail across folders).
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number[]} uids Message UIDs.
 * @param {MarkChange} change Change.
 * @returns {Promise<void>}
 */
export async function markMails(accountId: string, folder: string, uids: number[], change: MarkChange): Promise<void> {
  await assertNotArchived('MAIL_ACCOUNT', accountId);
  // An archived label is not put on mails anymore (it can still be taken off).
  if ('labelId' in change) await (change.on ? assertActive(prisma.mailLabel, change.labelId, 'Drapeau') : assertExists(prisma.mailLabel, change.labelId, 'Drapeau'));
  const fallback = await withImap(accountId, async (client) => {
    return withMailbox(client, folder, async () => {
      if (!takesKeywords(client)) return messageIdsOf(client, uids);
      const keyword = 'labelId' in change ? labelKeyword(change.labelId) : DONE_KEYWORD;
      const on = 'labelId' in change ? change.on : change.done;
      if (on) await client.messageFlagsAdd(uids, [keyword], { uid: true });
      else await client.messageFlagsRemove(uids, [keyword], { uid: true });
      return null;
    });
  });
  if (!fallback) return;
  for (const messageId of fallback.values()) {
    const mark = await prisma.mailMark.findUnique({ where: { accountId_messageId: { accountId, messageId } } });
    const labelIds = new Set(mark?.labelIds ?? []);
    if ('labelId' in change) {
      if (change.on) labelIds.add(change.labelId);
      else labelIds.delete(change.labelId);
    }
    const done = 'done' in change ? change.done : (mark?.done ?? false);
    await prisma.mailMark.upsert({
      where: { accountId_messageId: { accountId, messageId } },
      create: { accountId, messageId, labelIds: [...labelIds], done },
      update: { labelIds: [...labelIds], done },
    });
  }
}

/** Usual names of the special folders, for servers that do not flag them. */
const SPECIAL_NAMES = {
  '\\Drafts': /^(drafts|brouillons)$/i,
  '\\Sent': /^(sent|sent items|sent messages|envoy[ée]s|[ée]l[ée]ments envoy[ée]s|messages envoy[ée]s)$/i,
  '\\Trash': /^(trash|deleted|deleted items|deleted messages|corbeille|[ée]l[ée]ments supprim[ée]s)$/i,
  '\\Junk': /^(junk|spam|courrier ind[ée]sirable|ind[ée]sirables?)$/i,
} as const;

/** Special use of a folder (RFC 6154). */
export type SpecialUse = keyof typeof SPECIAL_NAMES;

/**
 * Path of the folder of an account having a special use, found by its flag or else by its usual name.
 * @param {ImapFlow} client Connected client.
 * @param {SpecialUse} specialUse Special use (\Junk…).
 * @returns {Promise<string | null>} Path, or null when the account has none.
 */
export async function findSpecialFolder(client: ImapFlow, specialUse: SpecialUse): Promise<string | null> {
  const folders = await client.list();
  const found = folders.find((item) => item.specialUse === specialUse) ?? folders.find((item) => SPECIAL_NAMES[specialUse].test(item.name));
  return found ? found.path : null;
}

/**
 * Path of the folder of an account having a special use, created when missing.
 * @param {ImapFlow} client Connected client.
 * @param {SpecialUse} specialUse Special use (\Junk…).
 * @param {string} create Name of the folder to create.
 * @returns {Promise<string>} Path.
 */
export async function specialFolder(client: ImapFlow, specialUse: SpecialUse, create: string): Promise<string> {
  return (await findSpecialFolder(client, specialUse)) ?? (await client.mailboxCreate([create])).path;
}

/**
 * Reports mails as spam (moved to the junk folder, "$Junk" keyword for the server's filter) or as not spam
 * (back to the inbox, "$NotJunk").
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number[]} uids Message UIDs.
 * @param {boolean} spam Spam or not.
 * @returns {Promise<string>} Folder the mails are now in.
 */
export async function reportSpam(accountId: string, folder: string, uids: number[], spam: boolean): Promise<string> {
  await assertNotArchived('MAIL_ACCOUNT', accountId);
  return withImap(accountId, async (client) => {
    const target = spam ? await specialFolder(client, '\\Junk', 'Junk') : INBOX;
    return withMailbox(client, folder, async () => {
      // The keywords are a hint: servers without keywords just move the mails.
      await client.messageFlagsAdd(uids, [spam ? JUNK : NOT_JUNK], { uid: true }).catch(() => undefined);
      await client.messageFlagsRemove(uids, [spam ? NOT_JUNK : JUNK], { uid: true }).catch(() => undefined);
      if (target !== folder) await client.messageMove(uids, target, { uid: true });
      return target;
    });
  });
}

/**
 * Moves mails to another folder of the account.
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number[]} uids Message UIDs.
 * @param {string} target Target folder path.
 * @returns {Promise<void>}
 */
export async function moveMails(accountId: string, folder: string, uids: number[], target: string): Promise<void> {
  if (target === folder || !uids.length) return;
  await assertNotArchived('MAIL_ACCOUNT', accountId);
  await withImap(accountId, async (client) => {
    if (!(await client.list()).some((item) => item.path === target)) throw notFound('Dossier');
    await withMailbox(client, folder, async () => {
      await client.messageMove(uids, target, { uid: true });
    });
  });
}

/**
 * Folder of the user (not the inbox nor a special folder) among the folders of an account.
 * @param {ListResponse[]} folders Folders of the account.
 * @param {string} path Folder path.
 * @param {string} refused Message when it is the inbox or a special folder (« Les dossiers spéciaux ne se renomment pas. »).
 * @returns {ListResponse} Folder.
 */
function userFolder(folders: ListResponse[], path: string, refused: string): ListResponse {
  const folder = folders.find((item) => item.path === path);
  if (!folder) throw notFound('Dossier');
  if (isInbox(folder.path) || folder.specialUse) throw clientError('BAD_USER_INPUT', refused);
  return folder;
}

/**
 * Creates a folder, at the top or under another one.
 * @param {string} accountId Account.
 * @param {string | null} parent Parent folder path, or null at the top.
 * @param {string} name Name.
 * @returns {Promise<string>} Path of the new folder.
 */
export async function createFolder(accountId: string, parent: string | null, name: string): Promise<string> {
  await assertNotArchived('MAIL_ACCOUNT', accountId);
  const clean = parseInput(mailFolderNameSchema, name);
  return withImap(accountId, async (client) => {
    if (!parent) return (await client.mailboxCreate([clean])).path;
    const folder = (await client.list()).find((item) => item.path === parent);
    if (!folder) throw notFound('Dossier parent');
    if (clean.includes(folder.delimiter)) throw clientError('BAD_USER_INPUT', `Le nom ne peut pas contenir « ${folder.delimiter} ».`);
    return (await client.mailboxCreate(`${parent}${folder.delimiter}${clean}`)).path;
  });
}

/**
 * Renames a folder (it stays under its parent). Special folders cannot be renamed.
 * @param {string} accountId Account.
 * @param {string} path Folder path.
 * @param {string} name New name.
 * @returns {Promise<string>} New path.
 */
export async function renameFolder(accountId: string, path: string, name: string): Promise<string> {
  await assertNotArchived('MAIL_ACCOUNT', accountId);
  const clean = parseInput(mailFolderNameSchema, name);
  return withImap(accountId, async (client) => {
    const folder = userFolder(await client.list(), path, 'Les dossiers spéciaux ne se renomment pas.');
    if (clean.includes(folder.delimiter)) throw clientError('BAD_USER_INPUT', `Le nom ne peut pas contenir « ${folder.delimiter} ».`);
    const parentPath = folder.parentPath;
    const target = parentPath ? `${parentPath}${folder.delimiter}${clean}` : (client.namespace?.prefix ?? '') + clean;
    return (await client.mailboxRename(path, target)).newPath;
  });
}

/**
 * Moves a folder (with its sub-folders) under another one, or to the top. Special folders stay in place, and
 * a folder cannot go under itself or one of its sub-folders.
 * @param {string} accountId Account.
 * @param {string} path Folder path.
 * @param {string | null} parent New parent folder path, or null for the top.
 * @returns {Promise<string>} New path.
 */
export async function moveFolder(accountId: string, path: string, parent: string | null): Promise<string> {
  await assertNotArchived('MAIL_ACCOUNT', accountId);
  return withImap(accountId, async (client) => {
    const folders = await client.list();
    const folder = userFolder(folders, path, 'Les dossiers spéciaux ne se déplacent pas.');
    if ((folder.parentPath || null) === parent) return path;
    let target: string;
    if (parent) {
      const destination = folders.find((item) => item.path === parent);
      if (!destination) throw notFound('Dossier de destination');
      if (parent === path || parent.startsWith(`${path}${folder.delimiter}`)) throw clientError('BAD_USER_INPUT', 'Un dossier ne peut pas aller dans lui-même ou dans un de ses sous-dossiers.');
      target = `${parent}${destination.delimiter}${folder.name}`;
    } else target = (client.namespace?.prefix ?? '') + folder.name;
    if (folders.some((item) => item.path === target)) throw clientError('BAD_USER_INPUT', `Un dossier « ${folder.name} » existe déjà à cet endroit.`);
    return (await client.mailboxRename(path, target)).newPath;
  });
}

/**
 * Deletes a folder, its sub-folders and the mails in them. Special folders cannot be deleted.
 * @param {string} accountId Account.
 * @param {string} path Folder path.
 * @returns {Promise<void>}
 */
export async function deleteFolder(accountId: string, path: string): Promise<void> {
  await assertNotArchived('MAIL_ACCOUNT', accountId);
  await withImap(accountId, async (client) => {
    const folder = userFolder(await client.list(), path, 'Les dossiers spéciaux ne se suppriment pas.');
    // Its sub-folders first, the deepest first (servers refuse or keep them otherwise).
    const descendants = (await client.list()).filter((item) => item.path.startsWith(`${path}${folder.delimiter}`)).sort((a, b) => b.path.length - a.path.length);
    for (const descendant of descendants) await client.mailboxDelete(descendant.path);
    await client.mailboxDelete(path);
  });
}

/** Flags of the mails: a label of TEXT_MAX characters like the other labels, unique in the workspace. */
export const mailLabels = createLabelService<MailLabel>('mailLabel', { notFound: 'Drapeau', conflict: 'Un drapeau porte déjà ce libellé.' });

/**
 * Deletes a flag (its keyword stays on the mails, unused; the marks kept in Ordo lose it).
 * @param {string} id Flag id.
 * @returns {Promise<void>}
 */
export async function deleteLabel(id: string): Promise<void> {
  await mailLabels.remove(id);
  const marks = await prisma.mailMark.findMany({ where: { labelIds: { has: id } } });
  for (const mark of marks) {
    await prisma.mailMark.update({
      where: { accountId_messageId: { accountId: mark.accountId, messageId: mark.messageId } },
      data: { labelIds: mark.labelIds.filter((labelId) => labelId !== id) },
    });
  }
}
