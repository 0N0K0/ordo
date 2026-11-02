/** Address of a mail, as returned by the API. */
export interface Address {
  name?: string | null;
  address: string;
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
const shortTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

/**
 * "Name <address>", or the address alone.
 * @param {Address} address Address.
 * @returns {string} Label.
 */
export function addressLabel(address: Address): string {
  return address.name ? `${address.name} <${address.address}>` : address.address;
}

/**
 * Short name of a sender: its name, or its address.
 * @param {Address[]} addresses Addresses.
 * @returns {string} Label.
 */
export function senderName(addresses: Address[]): string {
  const first = addresses[0];
  return first ? first.name || first.address : '(inconnu)';
}

/**
 * Date of a mail in a list: time today, day this year, full date before.
 * @param {string} iso Date.
 * @returns {string} Label.
 */
export function listDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return shortTime.format(date);
  if (date.getFullYear() === now.getFullYear()) return shortDay.format(date);
  return shortDate.format(date);
}

/**
 * Full date of an open mail.
 * @param {string} iso Date.
 * @returns {string} Label.
 */
export function fullDate(iso: string): string {
  return dateTime.format(new Date(iso));
}

/**
 * File size: "12 Ko", "1,2 Mo".
 * @param {number} bytes Size.
 * @returns {string} Label.
 */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Escapes text for HTML.
 * @param {string} text Text.
 * @returns {string} Escaped text.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Subject with a prefix ("Re :", "Tr :"), without stacking it.
 * @param {string} subject Subject.
 * @param {'Re' | 'Tr'} prefix Prefix.
 * @returns {string} Subject.
 */
export function prefixedSubject(subject: string, prefix: 'Re' | 'Tr'): string {
  const pattern = prefix === 'Re' ? /^(re|ré|aw)\s*:/i : /^(tr|fwd?)\s*:/i;
  return pattern.test(subject.trim()) ? subject : `${prefix} : ${subject}`;
}
