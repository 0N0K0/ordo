/** Selection of the ids of the records of a list relation. */
type IdsSelection<Relation extends string> = Record<Relation, { select: { id: true } }>;

/**
 * Options of a `t.idList` field listing the ids of the records of a list relation, selecting only their ids.
 * Pothos checks the selection against the model of the object, so an unknown relation or one without `id` does not compile.
 * @param {string} relation Name of the list relation.
 * @param {string} [description] Description of the field.
 * @returns {{ description?: string; select: IdsSelection; resolve: Function }} Options for `t.idList`.
 */
export function relationIds<Relation extends string>(relation: Relation, description?: string) {
  return {
    ...(description === undefined ? {} : { description }),
    select: { [relation]: { select: { id: true } } } as IdsSelection<Relation>,
    resolve: (parent: Record<Relation, { id: string }[]>) => parent[relation].map((related) => related.id),
  };
}
