/** Mails are fetched from the servers this often (new ones are announced at each fetch). */
export const MAIL_CHECK_MS = 10 * 60_000;

const EVENT = 'ordo:mail-check';

/**
 * Asks for a fetch of the mails now (the "Relever" button): the mail views reload and new mails are announced.
 * @returns {void}
 */
export function requestMailCheck(): void {
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Runs a function on every fetch asked for.
 * @param {() => void} fn Function.
 * @returns {() => void} Stops listening.
 */
export function onMailCheck(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
