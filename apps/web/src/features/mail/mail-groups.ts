/** Mails of one folder of one account. */
export interface MailGroup {
  accountId: string;
  folder: string;
  uids: number[];
}

/**
 * Groups selected mails by account and folder.
 * @param {{ accountId: string, folder: string, uid: number }[]} mails Mails.
 * @returns {MailGroup[]} Groups.
 */
export function groupMails(mails: readonly { accountId: string; folder: string; uid: number }[]): MailGroup[] {
  const groups = new Map<string, MailGroup>();
  for (const mail of mails) {
    const key = `${mail.accountId}|${mail.folder}`;
    const group = groups.get(key) ?? { accountId: mail.accountId, folder: mail.folder, uids: [] };
    group.uids.push(mail.uid);
    groups.set(key, group);
  }
  return [...groups.values()];
}
