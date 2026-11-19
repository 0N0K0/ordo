/** Drag and drop of the mail page (`components/dnd`): mails of the list to a folder, a folder in the tree of its account. */

/** Mails being dragged, from the list to a folder. */
export interface DraggedMails {
  accountId: string;
  folder: string;
  uids: number[];
}

/** Folder being dragged to another place of the tree of its account. */
export interface DraggedFolder {
  path: string;
  name: string;
  parent: string | null;
}

/** What is dragged in the mail page (`components/dnd`): mails of the list, or a folder. */
export type MailDrag = { kind: 'mails'; mails: DraggedMails } | { kind: 'folder'; accountId: string; folder: DraggedFolder };

/** Where it is dropped: a folder, or the account (the top level of its folders). */
export type MailDrop = { kind: 'folder'; accountId: string; path: string; name: string } | { kind: 'account'; accountId: string };

/**
 * Drag data of mails of the list.
 * @param {DraggedMails} mails Mails.
 * @returns {MailDrag} Data.
 */
export const mailsDrag = (mails: DraggedMails): MailDrag => ({ kind: 'mails', mails });
