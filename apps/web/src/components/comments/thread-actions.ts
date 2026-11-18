import { onMutationError } from '../../lib/notify';
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
  const onError = { onError: onMutationError };
  return {
    add: (body, done) => add.mutate(variables.add(body), { onSuccess: done, ...onError }),
    update: (id, body, done) => update.mutate({ id, body }, { onSuccess: done, ...onError }),
    remove: (id) => remove.mutate(variables.remove(id), onError),
    adding: add.isPending,
    updating: update.isPending,
  };
}
