import { shoppingCost } from '@ordo/shared';
import type { ShoppingItem, ShoppingList } from './api';
import { money, quantityText, type ShoppingRow } from './shopping-format';

/**
 * Names of the people an item is for.
 * @param {ShoppingItem} item Item.
 * @param {{ members: Map<string, string>, relations: Map<string, string> }} people Names by id.
 * @returns {string} Names, comma separated.
 */
const peopleText = (item: ShoppingItem, people: { members: Map<string, string>; relations: Map<string, string> }) =>
  [...item.memberIds.map((id) => people.members.get(id)), ...item.relationIds.map((id) => people.relations.get(id))].filter(Boolean).join(', ');

/**
 * Estimated total of items (those without price left out).
 * @param {ShoppingItem[]} items Items.
 * @returns {number} Total.
 */
export const shoppingTotal = (items: ShoppingItem[]) => items.reduce((sum, item) => sum + (shoppingCost(item) ?? 0), 0);

/**
 * List as plain text, to copy in a message: the categories (or stores) indented as their tree, a box per item
 * (ticked when bought), quantity, people, price and link; the estimated total at the end.
 * @param {ShoppingList} list List.
 * @param {ShoppingRow<ShoppingItem>[]} rows Rows of the list.
 * @param {{ members: Map<string, string>, relations: Map<string, string> }} people Names by id.
 * @returns {string} Text.
 */
export function shoppingText(list: ShoppingList, rows: ShoppingRow<ShoppingItem>[], people: { members: Map<string, string>; relations: Map<string, string> }): string {
  const lines = [list.name];
  for (const row of rows) {
    const indent = '  '.repeat(row.depth);
    if (row.kind === 'group') {
      if (row.depth === 0) lines.push('');
      lines.push(`${indent}${row.name} :`);
      continue;
    }
    const { item } = row;
    const cost = shoppingCost(item);
    const details = [quantityText(item), peopleText(item, people) ? `pour ${peopleText(item, people)}` : '', cost !== null ? money(cost) : ''].filter(Boolean).join(' · ');
    lines.push(`${indent}${item.purchasedAt ? '☑' : '☐'} ${item.name}${details ? ` (${details})` : ''}`);
    if (item.note) lines.push(`${indent}    ${item.note}`);
    if (item.url) lines.push(`${indent}    ${item.url}`);
  }
  lines.push('');
  const total = shoppingTotal(list.items);
  if (total) lines.push(`Total estimé : ${money(total)}`);
  return lines.join('\n').trim();
}

/**
 * Downloads a list as PDF (built by the API, as the tables of the app).
 * @param {ShoppingList} list List.
 * @param {ShoppingRow<ShoppingItem>[]} tableRows Rows of the list (the categories as a tree).
 * @param {{ members: Map<string, string>, relations: Map<string, string> }} people Names by id.
 * @returns {Promise<void>}
 */
export async function downloadShoppingPdf(list: ShoppingList, tableRows: ShoppingRow<ShoppingItem>[], people: { members: Map<string, string>; relations: Map<string, string> }): Promise<void> {
  const total = shoppingTotal(list.items);
  const rows = tableRows.map((row) => {
    if (row.kind === 'group') return { kind: 'group', depth: row.depth, cells: [row.name] };
    const { item } = row;
    const cost = shoppingCost(item);
    return {
      kind: 'row',
      depth: row.depth,
      cells: [item.purchasedAt ? 'Oui' : '', item.name, quantityText(item), peopleText(item, people), [item.note, item.url].filter(Boolean).join('\n'), cost !== null ? money(cost) : ''],
    };
  });
  const response = await fetch('/api/exports/table.pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: list.name,
      subtitle: total ? `Total estimé : ${money(total)}` : '',
      columns: ['Acheté', 'Produit', 'Quantité', 'Pour', 'Note', 'Prix estimé'],
      rows,
      align: ['left', 'left', 'right', 'left', 'left', 'right'],
    }),
  });
  if (!response.ok) throw new Error('Le PDF n’a pas pu être créé.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `${list.name.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
