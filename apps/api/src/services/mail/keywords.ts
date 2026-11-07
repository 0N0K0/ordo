import type { ImapFlow } from 'imapflow';

/** IMAP keyword of the "done" state. */
export const DONE_KEYWORD = '$OrdoDone';

/**
 * IMAP keyword of a flag.
 * @param {string} labelId Flag id.
 * @returns {string} Keyword.
 */
export const labelKeyword = (labelId: string) => `$Ordo_${labelId}`;

/**
 * Flag of a keyword, if it is one.
 * @param {string} keyword Keyword (servers may change its case).
 * @returns {string | null} Flag id.
 */
export const keywordLabel = (keyword: string) => (keyword.toLowerCase().startsWith('$ordo_') ? keyword.slice(6) : null);

/**
 * Whether the open folder takes any IMAP keyword (PERMANENTFLAGS with "\*").
 * @param {ImapFlow} client Client with a folder open.
 * @returns {boolean} Keywords kept by the server.
 */
export function takesKeywords(client: ImapFlow): boolean {
  const mailbox = client.mailbox;
  return Boolean(mailbox && typeof mailbox === 'object' && mailbox.permanentFlags?.has('\\*'));
}

/**
 * Message-IDs of messages of the open folder, by UID.
 * @param {ImapFlow} client Client with the folder open.
 * @param {number[]} uids UIDs.
 * @returns {Promise<Map<number, string>>} Message-IDs (messages without one left out).
 */
export async function messageIdsOf(client: ImapFlow, uids: number[]): Promise<Map<number, string>> {
  const ids = new Map<number, string>();
  if (!uids.length) return ids;
  for await (const message of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
    const id = message.envelope?.messageId?.trim().replace(/^<|>$/g, '');
    if (id) ids.set(message.uid, id);
  }
  return ids;
}
