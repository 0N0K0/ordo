import type { ReactNode } from 'react';
import { originOf, type InheritingRow } from './inheritance';
import { HeirsMark, InheritedField } from './InheritedField';

/** Fields of a parent item its sub-items inherit, marked in its cells (`HeirsMark`). */
export interface InheritedByHeirs {
  /** Fields inherited by at least one of its sub-items (not archived). */
  fields: ReadonlySet<string>;
  /** What the mark says (« Hérité par ses sous-routines »). */
  mention: string;
}

/**
 * Cells of a row of a table, each column showing an inherited field greyed with its mention (`InheritedField` compact,
 * its mention as a tooltip), and, with `heirs`, a field its sub-items inherit marked (`HeirsMark`); the other cells as
 * they are. The same for every table of sub-items (tasks, routines).
 * @param {Record<string, ReactNode>} cells Cells by column.
 * @param {InheritingRow} item Item of the row.
 * @param {Partial<Record<string, string>>} fields Inherited field of each column.
 * @param {string} from Name of its parent.
 * @param {InheritedByHeirs} [heirs] Fields its sub-items inherit. Optional. Default = none marked.
 * @returns {Record<string, ReactNode>} Cells.
 */
export function inheritedCells(cells: Record<string, ReactNode>, item: InheritingRow, fields: Partial<Record<string, string>>, from: string, heirs?: InheritedByHeirs): Record<string, ReactNode> {
  if (!item.parentId && !heirs?.fields.size) return cells;
  return Object.fromEntries(
    Object.entries(cells).map(([column, cell]) => {
      const field = fields[column];
      if (!field) return [column, cell];
      const own = item.parentId ? (
        <InheritedField compact origin={originOf(item, field)} from={from}>
          {cell}
        </InheritedField>
      ) : (
        cell
      );
      return [column, heirs?.fields.has(field) ? <HeirsMark mention={heirs.mention}>{own}</HeirsMark> : own];
    }),
  );
}
