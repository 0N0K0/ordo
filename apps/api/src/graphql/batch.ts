import type { Context } from './context';

/** Rows of one request waiting for the same computation. */
interface Batch<K, V> {
  keys: K[];
  waiting: { resolve: (value: V) => void; reject: (error: unknown) => void }[];
}

/**
 * Field computed for all the rows of a request at once, not row by row: each row asks for its value, and the values of
 * every row asked in the same pass are loaded together (one query for a list, not one per row).
 * @template K, V
 * @param {(keys: K[]) => Promise<V[]>} load Loads the values of several rows, in their order.
 * @returns {(ctx: Context, key: K) => Promise<V>} Value of one row.
 */
export function batchedBy<K, V>(load: (keys: K[]) => Promise<V[]>): (ctx: Context, key: K) => Promise<V> {
  const pending = new WeakMap<Context, Batch<K, V>>();
  return (ctx, key) =>
    new Promise<V>((resolve, reject) => {
      let batch = pending.get(ctx);
      if (!batch) {
        const created: Batch<K, V> = { keys: [], waiting: [] };
        batch = created;
        pending.set(ctx, created);
        // Once every row of the pass has asked (their resolvers run in the same turn, some after a promise).
        void Promise.resolve().then(() =>
          process.nextTick(() => {
            pending.delete(ctx);
            load(created.keys).then(
              (values) => created.waiting.forEach((row, index) => row.resolve(values[index])),
              (error: unknown) => created.waiting.forEach((row) => row.reject(error)),
            );
          }),
        );
      }
      batch.keys.push(key);
      batch.waiting.push({ resolve, reject });
    });
}
