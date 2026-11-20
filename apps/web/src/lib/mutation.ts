import { movedTo } from '@ordo/shared';
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** What a mutation refreshes once done, and what it shows before. */
interface InvalidatingOptions<V> {
  /** Queries refreshed once the mutation is done (with what starts with these keys). */
  invalidate: readonly QueryKey[];
  /** Changes the data shown at once, before the answer; put back as it was on an error. Optional. */
  optimistic?: (queryClient: QueryClient, variables: V) => void;
  /** Refreshed in the background: the mutation does not wait for the reload (the change is shown already). Optional. Default = false. */
  background?: boolean;
}

/**
 * Mutation of the app: its request, then the queries it changes refreshed; optionally, the data shown at once before
 * the answer (optimistic), put back as it was when the request fails.
 * @param {(variables: V) => Promise<R>} mutationFn Request.
 * @param {InvalidatingOptions<V>} options Queries refreshed, optimistic change, refresh in the background.
 * @returns {UseMutationResult<R, Error, V>} Mutation state.
 */
export function useInvalidatingMutation<V, R>(mutationFn: (variables: V) => Promise<R>, { invalidate, optimistic, background = false }: InvalidatingOptions<V>) {
  const queryClient = useQueryClient();
  return useMutation<R, Error, V, { previous: (readonly [QueryKey, unknown])[] }>({
    mutationFn,
    onMutate: async (variables) => {
      if (!optimistic) return { previous: [] };
      await Promise.all(invalidate.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      const previous = invalidate.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));
      optimistic(queryClient, variables);
      return { previous };
    },
    onError: (_error, _variables, context) => context?.previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data)),
    onSettled: async () => {
      const refreshed = Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (!background) await refreshed;
    },
  });
}

/**
 * Changes the data of one query in place (an optimistic change), when it is loaded.
 * @param {QueryClient} queryClient Query client.
 * @param {QueryKey} queryKey Query.
 * @param {(data: D) => D} patch New data, from the current one.
 * @returns {void}
 */
export function patchQuery<D>(queryClient: QueryClient, queryKey: QueryKey, patch: (data: D) => D): void {
  const data = queryClient.getQueryData<D>(queryKey);
  if (data !== undefined) queryClient.setQueryData(queryKey, patch(data));
}

/**
 * List with an item moved to an index (the optimistic order of a drag and drop), null when the item is not in it.
 * @param {readonly T[]} list Items in their order.
 * @param {string} id Item moved.
 * @param {number} index Its new index.
 * @returns {T[] | null} New order.
 */
export function moveToIndex<T extends { id: string }>(list: readonly T[], id: string, index: number): T[] | null {
  const moved = list.find((item) => item.id === id);
  if (!moved) return null;
  // Bounded as the server does (moveInOrder, on the same movedTo): the order shown is the one saved.
  return movedTo(
    list.filter((item) => item.id !== id),
    moved,
    index,
  );
}

/**
 * First item matching in the queries of a key (the key and those it prefixes), as the cache holds them now.
 * @param {QueryClient} queryClient Query client.
 * @param {QueryKey} queryKey Queries (a prefix).
 * @param {(data: D) => readonly T[] | undefined} items Items of the data of a query.
 * @param {(item: T) => boolean} match Item looked for.
 * @returns {T | undefined} Item, none when not (yet) loaded.
 */
function cachedFind<D, T>(queryClient: QueryClient, queryKey: QueryKey, items: (data: D) => readonly T[] | undefined, match: (item: T) => boolean): T | undefined {
  for (const [, data] of queryClient.getQueriesData<D>({ queryKey })) {
    const found = data === undefined ? undefined : items(data)?.find(match);
    if (found) return found;
  }
  return undefined;
}

/**
 * Item by id in the queries of a key (the key and those it prefixes), as the cache holds them now: a copy just saved,
 * once its mutation refreshed them (decision D20 opens it).
 * @param {QueryClient} queryClient Query client.
 * @param {QueryKey} queryKey Queries (a prefix).
 * @param {string} id Item.
 * @param {(data: D) => readonly T[] | undefined} items Items of the data of a query.
 * @returns {T | undefined} Item, none when not (yet) loaded.
 */
export function cachedItem<D, T extends { id: string }>(queryClient: QueryClient, queryKey: QueryKey, id: string, items: (data: D) => readonly T[] | undefined): T | undefined {
  return cachedFind(queryClient, queryKey, items, (item: T) => item.id === id);
}

/**
 * Item of the cache, followed as it changes (refreshed, changed elsewhere): the item of a detail panel saved field by
 * field opened on a copy of it (`useFieldSave`'s `saved`), whatever query holds it.
 * @param {QueryKey} queryKey Queries (a prefix).
 * @param {(data: D) => readonly T[] | undefined} items Items of the data of a query.
 * @param {(item: T) => boolean} match Item looked for.
 * @returns {T | undefined} Item as the cache holds it now, none when not (or no longer) there.
 */
export function useCachedItem<D, T>(queryKey: QueryKey, items: (data: D) => readonly T[] | undefined, match: (item: T) => boolean): T | undefined {
  const queryClient = useQueryClient();
  return useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => cachedFind(queryClient, queryKey, items, match),
  );
}
