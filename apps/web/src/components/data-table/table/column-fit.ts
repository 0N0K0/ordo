import { movedTo } from '@ordo/shared';
import type { ColumnLayout } from '@ordo/shared';
import type { ColumnMove } from '../toolbar/ColumnHeaderMenu';
import { clampWidth } from './data-table';

/** Rows measured at most: enough to see the content of a column, quick on long lists. */
const MEASURED_ROWS = 400;

let measuring: CanvasRenderingContext2D | null = null;

/**
 * Width of a text in a font, as drawn.
 * @param {string} text Text.
 * @param {string} font CSS font.
 * @returns {number} Width, in pixels.
 */
function textWidth(text: string, font: string): number {
  if (!text) return 0;
  measuring ??= document.createElement('canvas').getContext('2d');
  if (!measuring) return 0;
  measuring.font = font;
  return Math.ceil(measuring.measureText(text).width);
}

/**
 * Width a column of a table needs: what the browser gives it when the table lays its columns out by their content
 * (automatic layout, as wide as its content), its cells free of the widths set on them and its fields as wide as
 * their text; header included, rows spanning several columns left out. The styles are put back at once (nothing is painted meanwhile).
 * @param {HTMLTableElement} table Table.
 * @param {number} index Index of the column among the cells of a row.
 * @returns {number} Width, in pixels.
 */
function contentWidth(table: HTMLTableElement, index: number): number {
  const cells = [...table.rows].slice(0, MEASURED_ROWS).flatMap((row) => {
    const items = [...row.cells];
    return items.length > index && !items.some((cell) => cell.colSpan > 1) ? [items[index]] : [];
  });
  if (!cells.length) return 0;
  // Fields of the cells (inline editors) count as wide as their text, not as their default size (about 20 characters).
  const fields = cells.flatMap((cell) => [...cell.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]), textarea')]);
  const saved = [table, ...cells, ...fields].map((element) => [element, element.getAttribute('style')] as const);
  table.style.tableLayout = 'auto';
  table.style.width = 'max-content';
  for (const cell of cells) {
    cell.style.width = 'auto';
    cell.style.minWidth = '0';
    cell.style.maxWidth = 'none';
  }
  for (const field of fields) {
    field.style.width = `${textWidth(field.value || field.placeholder, getComputedStyle(field).font)}px`;
    field.style.minWidth = '0';
    field.style.flex = '0 0 auto';
  }
  const width = cells[0].getBoundingClientRect().width;
  for (const [element, style] of saved) {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  }
  return Math.ceil(width);
}

/**
 * Order of the columns with one moved to the start, the end, or by one shown column.
 * @param {readonly string[]} order Order of every column.
 * @param {readonly { id: string }[]} shown Columns shown, in order.
 * @param {string} id Column moved.
 * @param {ColumnMove} where Where.
 * @returns {string[]} New order.
 */
export function movedColumnOrder(order: readonly string[], shown: readonly { id: string }[], id: string, where: ColumnMove): string[] {
  const others = order.filter((item) => item !== id);
  const index = shown.findIndex((column) => column.id === id);
  let at: number;
  if (where === 'start') at = 0;
  else if (where === 'end') at = others.length;
  else {
    const neighbour = shown[where === 'left' ? index - 1 : index + 1].id;
    at = others.indexOf(neighbour) + (where === 'right' ? 1 : 0);
  }
  return movedTo(others, id, at);
}

/**
 * Layout with a column fitted to its content, or given back its default width when it already is.
 * @param {HTMLTableElement} table Table.
 * @param {ColumnLayout} layout Layout.
 * @param {{ id: string, width: number }} column Column, with its width now.
 * @param {number} cellIndex Index of its cells in a row.
 * @param {Map<string, number>} fitted Widths of the columns fitted (kept to tell a second fit).
 * @returns {ColumnLayout} New layout.
 */
export function fittedLayout(table: HTMLTableElement, layout: ColumnLayout, column: { id: string; width: number }, cellIndex: number, fitted: Map<string, number>): ColumnLayout {
  const width = clampWidth(contentWidth(table, cellIndex) + 2);
  const { [column.id]: _dropped, ...others } = layout.columnSizing; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (fitted.get(column.id) === column.width || Math.abs(width - column.width) <= 2) {
    fitted.delete(column.id);
    return { ...layout, columnSizing: others };
  }
  fitted.set(column.id, width);
  return { ...layout, columnSizing: { ...others, [column.id]: width } };
}
