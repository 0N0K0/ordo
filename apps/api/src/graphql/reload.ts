/** Model delegate able to find one record by id, or throw (`prisma.task`…). */
interface ReloadDelegate<T> {
  findUniqueOrThrow(args: { where: { id: string } }): PromiseLike<T>;
}

/**
 * Saved record reloaded with the fields the query asks for (the answer of a create or update mutation).
 * @param {ReloadDelegate} model Model delegate (`prisma.task`…).
 * @param {object} query Pothos Prisma selection.
 * @param {{ id: string } | PromiseLike<{ id: string }>} saved Saved record, or its saving.
 * @returns {Promise<T>} Record.
 */
export async function reloaded<T>(model: ReloadDelegate<T>, query: object, saved: { id: string } | PromiseLike<{ id: string }>): Promise<T> {
  const { id } = await saved;
  return model.findUniqueOrThrow({ ...query, where: { id } });
}
