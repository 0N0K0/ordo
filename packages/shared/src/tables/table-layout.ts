import { z } from 'zod';

/** Layout of the columns of a table: their order, those hidden, their widths (px). Unknown ids are ignored. */
export const columnLayoutSchema = z.object({
  columnOrder: z.array(z.string().max(64)).max(100).default([]),
  hiddenColumns: z.array(z.string().max(64)).max(100).default([]),
  columnSizing: z.record(z.string().max(64), z.number().min(40).max(1200)).default({}),
});
export type ColumnLayout = z.infer<typeof columnLayoutSchema>;

/** Sort of a table on one of its columns. */
export const tableSortSchema = z.object({ id: z.string().max(64), desc: z.boolean() });
export type TableSort = z.infer<typeof tableSortSchema>;
