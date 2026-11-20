import type { ItemLink } from '@ordo/shared';

/**
 * Links of an item (event, task, routine) as given by the API, as an input: their address and label only.
 * @param {readonly ItemLink[]} links Links.
 * @returns {ItemLink[]} Input.
 */
export function linkInputs(links: readonly ItemLink[]): ItemLink[] {
  // eslint-disable-next-line no-restricted-syntax -- linkInputs itself.
  return links.map(({ url, label }) => ({ url, label }));
}
