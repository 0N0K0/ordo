import { ON_ERROR } from '../../lib/notify';
import type { ThreadActions } from './CommentThread';

/** Mutation of a comment, as TanStack Query gives it (its result unused). */
interface CommentMutation<V> {
  mutate: (variables: V, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void;
  isPending: boolean;
}

/**
 * Saves of a thread from its three mutations, their errors told (onMutationError).
 * @param {{ add: CommentMutation<A>, update: CommentMutation<{ id: string, body: string }>, remove: CommentMutation<R> }} mutations Mutations.
 * @param {{ add: (body: string) => A, remove: (id: string) => R }} variables Variables of an addition and of a removal.
 * @returns {ThreadActions} Saves.
 */
export function threadActions<A, R>(
  { add, update, remove }: { add: CommentMutation<A>; update: CommentMutation<{ id: string; body: string }>; remove: CommentMutation<R> },
  variables: { add: (body: string) => A; remove: (id: string) => R },
): ThreadActions {
  return {
    add: (body, done) => add.mutate(variables.add(body), { onSuccess: done, ...ON_ERROR }),
    update: (id, body, done) => update.mutate({ id, body }, { onSuccess: done, ...ON_ERROR }),
    remove: (id) => remove.mutate(variables.remove(id), ON_ERROR),
    adding: add.isPending,
    updating: update.isPending,
  };
}
