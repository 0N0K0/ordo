import type { ItemLink } from '@ordo/shared';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Links of an item (event, task, routine), as stored in its JSON column (none: an empty list).
 * @param {Prisma.JsonValue | null | undefined} links Stored value.
 * @returns {ItemLink[]} Links.
 */
// eslint-disable-next-line no-restricted-syntax -- readLinks itself.
export const readLinks = (links: Prisma.JsonValue | null | undefined): ItemLink[] => (links as unknown as ItemLink[] | null) ?? [];
