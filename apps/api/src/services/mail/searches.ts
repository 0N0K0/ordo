import { addDays, collator, compareMailDates, EMPTY_MAIL_SEARCH, type MailSearchCriteria, mailSearchCriteriaSchema, type MailSearchSortBy, type MailSearchInput, mailSearchSchema, parseDay } from '@ordo/shared';
import { prisma } from '../../db';
import { nextPositionIn } from '../core/ordering';
import type { MailSearch } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';
import { folderLabel, isInbox, selectableFolders, withImap, withMailbox } from './imap';
import { DONE_KEYWORD, labelKeyword, messageIdsOf, takesKeywords } from './keywords';
import { PAGE_SIZE, sortedUids, SUMMARY_FETCH, toSummary, type MailSummary } from './reader';
import { assertActive } from '../core/archive';
import { deleteOrNotFound, findOrNotFound } from '../core/lookup';

/** Folders a search does not look into, with "every folder". */
const SKIPPED = new Set(['\\Trash', '\\Junk', '\\Drafts', '\\Sent']);
/** Folders a search of the mails of a project does not look into: its sent mails are part of it. */
const SKIPPED_FOR_PROJECT = new Set(['\\Trash', '\\Junk', '\\Drafts']);
/** Message-IDs looked for in one IMAP search. */
const IDS_PER_SEARCH = 25;

/** Order of the mails found: latest first by default. */
interface SearchSort {
  by: MailSearchSortBy;
  ascending: boolean;
}
/** Latest mails looked at in each folder. */
const PER_FOLDER = 200;

/** Mail found by a search folder, with where it is. */
export interface MailSearchHit extends MailSummary {
  accountId: string;
  folder: string;
  folderName: string;
}

/**
 * Criteria of a stored search (missing fields at their default).
 * @param {MailSearch} search Stored search.
 * @returns {MailSearchCriteria} Criteria.
 */
export function searchCriteria(search: MailSearch): MailSearchCriteria {
  const parsed = mailSearchCriteriaSchema.safeParse(search.criteria);
  return parsed.success ? parsed.data : { ...EMPTY_MAIL_SEARCH, state: 'todo' };
}

/**
 * Label and criteria of a search folder, validated.
 * @param {MailSearchInput} input Search.
 * @returns {{ label: string, criteria: MailSearchCriteria }} Label and criteria.
 */
function parseSearch(input: MailSearchInput): { label: string; criteria: MailSearchCriteria } {
  const { label, ...criteria } = parseInput(mailSearchSchema, input) as MailSearchCriteria & { label: string };
  return { label, criteria };
}

/**
 * Creates a search folder at the end of the list; its project, if any, must exist and not be archived.
 * @param {MailSearchInput} input Search.
 * @returns {Promise<MailSearch>} Search.
 */
export async function createSearch(input: MailSearchInput): Promise<MailSearch> {
  const { label, criteria } = parseSearch(input);
  await assertActive(prisma.project, criteria.projectId, 'Projet');
  const position = await nextPositionIn('mailSearch');
  return prisma.mailSearch.create({ data: { label, criteria, position } });
}

/**
 * Updates a search folder; a project newly chosen must exist and not be archived.
 * @param {string} id Search id.
 * @param {MailSearchInput} input Search.
 * @returns {Promise<MailSearch>} Search.
 */
export async function updateSearch(id: string, input: MailSearchInput): Promise<MailSearch> {
  const { label, criteria } = parseSearch(input);
  const current = await findOrNotFound(prisma.mailSearch, id, 'Dossier de recherche');
  // The project it already had stays valid, even archived or deleted.
  if (criteria.projectId !== searchCriteria(current).projectId) await assertActive(prisma.project, criteria.projectId, 'Projet');
  return prisma.mailSearch.update({ where: { id }, data: { label, criteria } });
}

/**
 * Deletes a search folder (the mails are not touched).
 * @param {string} id Search id.
 * @returns {Promise<void>}
 */
export async function deleteSearch(id: string): Promise<void> {
  await deleteOrNotFound(prisma.mailSearch, id, 'Dossier de recherche');
}

/**
 * Mails of a folder matching criteria: the latest ones, with the IMAP keywords, or with the marks kept in Ordo
 * for servers without keywords.
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {string} folderName Folder name.
 * @param {MailSearchCriteria} criteria Criteria.
 * @param {ReadonlyMap<string, { labelIds: string[], done: boolean }>} marks Marks kept in Ordo for the account.
 * @param {string[] | null} messageIds Message-IDs the mails must have (those of a project), or null.
 * @returns {Promise<MailSearchHit[]>} Mails found.
 */
async function searchFolder(
  accountId: string,
  folder: string,
  folderName: string,
  criteria: MailSearchCriteria,
  marks: ReadonlyMap<string, { labelIds: string[]; done: boolean }>,
  messageIds: string[] | null,
): Promise<MailSearchHit[]> {
  return withImap(accountId, async (client) => {
    return withMailbox(client, folder, async () => {
      const keywords = takesKeywords(client);
      const search = async (query: object) => new Set(((await client.search(Object.keys(query).length ? query : { all: true }, { uid: true })) || []) as number[]);
      let uids = await search({
        ...(criteria.unread ? { seen: false } : {}),
        ...(criteria.from ? { from: criteria.from } : {}),
        ...(criteria.to ? { to: criteria.to } : {}),
        ...(criteria.subject ? { subject: criteria.subject } : {}),
        ...(criteria.body ? { body: criteria.body } : {}),
        ...(criteria.since ? { since: parseDay(criteria.since) } : {}),
        // BEFORE excludes its day.
        ...(criteria.until ? { before: parseDay(addDays(criteria.until, 1)) } : {}),
        ...(keywords && criteria.state === 'done' ? { keyword: DONE_KEYWORD } : {}),
        ...(keywords && criteria.state === 'todo' ? { unKeyword: DONE_KEYWORD } : {}),
        ...(keywords && criteria.labelIds.length ? { or: criteria.labelIds.map((id) => ({ keyword: labelKeyword(id) })) } : {}),
      });
      // The mails of a project, by their Message-ID header (a few at a time: one "or" per search).
      if (messageIds && uids.size) {
        const linked = new Set<number>();
        for (let start = 0; start < messageIds.length; start += IDS_PER_SEARCH) {
          const headers = messageIds.slice(start, start + IDS_PER_SEARCH).map((id) => ({ header: { 'message-id': id } }));
          for (const uid of await search(headers.length > 1 ? { or: headers } : headers[0]!)) linked.add(uid);
        }
        uids = new Set([...uids].filter((uid) => linked.has(uid)));
      }
      // The text, searched apart (one "or" per search).
      if (criteria.text && uids.size) {
        const text = criteria.text;
        const matching = await search({ or: [{ subject: text }, { from: text }, { to: text }, { body: text }] });
        uids = new Set([...uids].filter((uid) => matching.has(uid)));
      }
      // Latest first by date (not by UID: a mail moved or copied into the folder gets a new one).
      let latest = await sortedUids(client, [...uids], { by: 'date', ascending: false });
      // Without keywords, the state and flags from the marks kept in Ordo.
      if (!keywords && (criteria.state !== 'all' || criteria.labelIds.length)) {
        const ids = await messageIdsOf(client, latest.slice(0, PER_FOLDER * 5));
        latest = latest.filter((uid) => {
          const mark = marks.get(ids.get(uid) ?? '');
          const done = mark?.done ?? false;
          if (criteria.state === 'done' && !done) return false;
          if (criteria.state === 'todo' && done) return false;
          return !criteria.labelIds.length || criteria.labelIds.some((id) => mark?.labelIds.includes(id));
        });
      }
      // Every mail of a project (they are few), the latest ones otherwise.
      if (!messageIds) latest = latest.slice(0, PER_FOLDER);
      const hits: MailSearchHit[] = [];
      if (!latest.length) return hits;
      for await (const message of client.fetch(latest, SUMMARY_FETCH, { uid: true })) hits.push({ ...toSummary(message, keywords, marks), accountId, folder, folderName });
      // Attachments are seen in the structure of the mails.
      return criteria.attachments ? hits.filter((hit) => hit.hasAttachments) : hits;
    });
  });
}

/**
 * A page of the mails of a search folder, latest first.
 * @param {string} id Search id.
 * @param {number} page Page, from 0.
 * @returns {Promise<{ messages: MailSearchHit[], total: number }>} Mails and total count.
 */
export async function searchResults(id: string, page: number): Promise<{ messages: MailSearchHit[]; total: number }> {
  const search = await findOrNotFound(prisma.mailSearch, id, 'Dossier de recherche');
  return runSearch(searchCriteria(search), page);
}

/**
 * A page of the mails matching criteria (advanced search, not saved), latest first.
 * @param {unknown} input Criteria.
 * @param {number} page Page, from 0.
 * @param {SearchSort} [sort] Order of the mails. Optional. Default = latest first.
 * @returns {Promise<{ messages: MailSearchHit[], total: number }>} Mails and total count.
 */
export async function advancedSearch(input: unknown, page: number, sort?: SearchSort): Promise<{ messages: MailSearchHit[]; total: number }> {
  return runSearch(parseInput(mailSearchCriteriaSchema, input), page, sort);
}

/**
 * Text a mail found is sorted on.
 * @param {MailSearchHit} hit Mail.
 * @param {Exclude<MailSearchSortBy, 'date'>} by Field.
 * @returns {string} Text.
 */
function sortText(hit: MailSearchHit, by: Exclude<MailSearchSortBy, 'date'>): string {
  if (by === 'subject') return hit.subject;
  const first = hit.from[0];
  return first?.name || first?.address || '';
}

/**
 * Runs a search across its accounts and folders (the latest mails of each folder; every mail of a project, in
 * the accounts it has mails of); unreachable accounts are left out.
 * @param {MailSearchCriteria} criteria Criteria.
 * @param {number} page Page, from 0.
 * @param {SearchSort} [sort] Order of the mails. Optional. Default = latest first.
 * @returns {Promise<{ messages: MailSearchHit[], total: number }>} Mails and total count.
 */
async function runSearch(criteria: MailSearchCriteria, page: number, sort: SearchSort = { by: 'date', ascending: false }): Promise<{ messages: MailSearchHit[]; total: number }> {
  // The copies of the mails of a project: their Message-IDs, by account.
  const linked = criteria.projectId ? await prisma.mailMessage.findMany({ where: { projectId: criteria.projectId, accountId: { not: null } }, select: { accountId: true, messageId: true } }) : null;
  const linkedIds = new Map<string, string[]>();
  for (const copy of linked ?? []) linkedIds.set(copy.accountId!, [...(linkedIds.get(copy.accountId!) ?? []), copy.messageId]);
  if (linked && !linkedIds.size) return { messages: [], total: 0 };
  const accountFilter = [...(criteria.accountIds.length ? [criteria.accountIds] : []), ...(linked ? [[...linkedIds.keys()]] : [])];
  // The archived accounts are left out of the searches across accounts (searched only when asked by name).
  const accounts = await prisma.mailAccount.findMany({
    where: { AND: [...accountFilter.map((ids) => ({ id: { in: ids } })), ...(criteria.accountIds.length ? [] : [{ archivedAt: null }])] },
    select: { id: true },
  });
  const skipped = linked ? SKIPPED_FOR_PROJECT : SKIPPED;
  const found = await Promise.all(
    accounts.map(async ({ id: accountId }) => {
      try {
        const marks = new Map((await prisma.mailMark.findMany({ where: { accountId } })).map((mark) => [mark.messageId, mark]));
        const folders = await withImap(accountId, async (client) =>
          selectableFolders(await client.list())
            .filter((folder) => (criteria.scope === 'folder' ? folder.path === criteria.folder : criteria.scope === 'inbox' ? isInbox(folder.path) : !skipped.has(folder.specialUse ?? '')))
            .map((folder) => ({ path: folder.path, name: folderLabel(folder) })),
        );
        const hits: MailSearchHit[] = [];
        for (const folder of folders) hits.push(...(await searchFolder(accountId, folder.path, folder.name, criteria, marks, linked ? (linkedIds.get(accountId) ?? []) : null)));
        return hits;
      } catch (error) {
        console.warn('Dossier de recherche : boîte injoignable.', error);
        return [];
      }
    }),
  );
  const dateKey = (hit: MailSearchHit) => ({ time: hit.date.getTime(), uid: hit.uid });
  // Latest first between equals.
  const all = found.flat().sort((a, b) => {
    if (sort.by === 'date') return compareMailDates(dateKey(a), dateKey(b), sort.ascending);
    const order = collator.compare(sortText(a, sort.by), sortText(b, sort.by));
    return (sort.ascending ? order : -order) || compareMailDates(dateKey(a), dateKey(b));
  });
  return { messages: all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), total: all.length };
}
