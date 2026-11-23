import { taskLinksLostCount, type TaskLinksLost } from '@ordo/shared';
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

/** Result of a transfer of tasks: the links it removed, counted and told (to put them back). */
export const TaskTransferResult = builder.objectRef<{ removedLinks: number; lost: TaskLinksLost }>('TaskTransferResult').implement({
  description: 'Outcome of a transfer of tasks: the links removed because they left the project tree.',
  fields: (t) => ({
    removedLinks: t.exposeInt('removedLinks', { description: 'Links removed because they left the project tree.' }),
    lost: t.field({
      type: 'JSON',
      description: '{ blocks, relations, parents, milestones, sprints, resources }: the links removed, as restoreTaskLinks takes them back.',
      resolve: (result) => result.lost,
    }),
  }),
});

/**
 * Result of a transfer of tasks, from the links it removed.
 * @param {Promise<TaskLinksLost>} work Transfer, giving the links it removed.
 * @returns {Promise<{ removedLinks: number, lost: TaskLinksLost }>} Result.
 */
export async function transferResult(work: Promise<TaskLinksLost>): Promise<{ removedLinks: number; lost: TaskLinksLost }> {
  const lost = await work;
  return { removedLinks: taskLinksLostCount(lost), lost };
}
