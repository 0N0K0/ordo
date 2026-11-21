import type { ReactNode } from 'react';
import { originOf, type InheritingRow } from './inheritance';
import { InheritedField } from './InheritedField';

/**
 * Cells of a row of a table, each column showing an inherited field greyed with its mention (`InheritedField` compact,
 * its mention as a tooltip); the other cells as they are. The same for every table of sub-items (tasks, routines).
 * @param {Record<string, ReactNode>} cells Cells by column.
 * @param {InheritingRow} item Item of the row.
 * @param {Partial<Record<string, string>>} fields Inherited field of each column.
 * @param {string} from Name of its parent.
 * @returns {Record<string, ReactNode>} Cells.
 */
export function inheritedCells(cells: Record<string, ReactNode>, item: InheritingRow, fields: Partial<Record<string, string>>, from: string): Record<string, ReactNode> {
  if (!item.parentId) return cells;
  return Object.fromEntries(
    Object.entries(cells).map(([column, cell]) => {
      const field = fields[column];
      return [
        column,
        field ? (
          <InheritedField compact origin={originOf(item, field)} from={from}>
            {cell}
          </InheritedField>
        ) : (
          cell
        ),
      ];
    }),
  );
}
