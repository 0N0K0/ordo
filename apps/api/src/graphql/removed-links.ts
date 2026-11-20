import { builder } from './builder';

/** Result of a change that may move items to another project tree: the links it removed (they left the tree). */
export const RemovedLinksResult = builder.objectRef<{ removedLinks: number }>('RemovedLinksResult').implement({
  description: 'Outcome of a change of project: the links removed because they left the project tree.',
  fields: (t) => ({
    removedLinks: t.exposeInt('removedLinks', { description: 'Links removed because they left the project tree.' }),
  }),
});

/**
 * Result of a change, from the links it removed.
 * @param {Promise<number>} work Change, giving the links it removed.
 * @returns {Promise<{ removedLinks: number }>} Result.
 */
export async function removedLinks(work: Promise<number>): Promise<{ removedLinks: number }> {
  return { removedLinks: await work };
}
