import { prisma } from '../../db';

/**
 * Delegate of a model by its name (`prisma.task`…), typed as the few methods the caller uses: the one cast of the
 * generic services (ordering, trees, archiving, settings lists, comments).
 * @param {string} model Name of the model on the client (`task`, `taskPriority`…).
 * @param {object} [client] Client or transaction. Optional. Default = the client scoped to the current workspace.
 * @returns {D} Delegate.
 */
export function modelDelegate<D>(model: string, client: object = prisma): D {
  return (client as Record<string, unknown>)[model] as D;
}
