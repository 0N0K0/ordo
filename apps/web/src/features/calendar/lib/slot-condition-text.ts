import type { SlotCondition, SlotConditionItem } from '@ordo/shared';

/**
 * Condition without any part (any time).
 * @returns {SlotCondition} Condition.
 */
export const emptySlotCondition = (): SlotCondition => ({ type: 'group', id: 'root', combinator: 'and', children: [] });

/**
 * Names of some schedules or kinds, quoted, joined.
 * @param {unknown} value Ids or kind references.
 * @param {Map<string, string>} names Names of the schedules and kinds.
 * @param {string} missing Name of one no longer there.
 * @param {string} joint « ou », « et ».
 * @returns {{ text: string, count: number }} Text and how many.
 */
function quoted(value: unknown, names: Map<string, string>, missing: string, joint: string): { text: string; count: number } {
  const list = (Array.isArray(value) ? value : []).map((id: string) => `« ${names.get(id) ?? missing} »`);
  return { text: list.join(` ${joint} `), count: list.length };
}

/**
 * Condition on calendar schedules as text: "(sur « Déjeuner » ou « Dîner » et sur le type « Garde ») ou hors de
 * « Sommeil »".
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @param {Map<string, string>} names Names of the schedules and kinds (`slotChoices`).
 * @param {boolean} [nested] Inside a group (written within parentheses). Optional. Default = false.
 * @returns {string} Text (empty: any time).
 */
export function describeSlotCondition(node: SlotCondition | SlotConditionItem | null | undefined, names: Map<string, string>, nested = false): string {
  if (!node) return '';
  if (node.type === 'condition') {
    const out = node.operator === 'notIn';
    if (node.field === 'freeTime') {
      const except = quoted(node.value, names, 'créneau supprimé', 'et');
      return out && except.count ? `hors de tous les créneaux sauf ${except.text}` : 'hors de tous les créneaux';
    }
    if (node.field === 'kinds') {
      const kinds = quoted(node.value, names, 'type supprimé', out ? 'et' : 'ou');
      const many = kinds.count > 1;
      return `${out ? (many ? 'hors des types' : 'hors du type') : many ? 'sur les types' : 'sur le type'} ${kinds.text}`;
    }
    return `${out ? 'hors de' : 'sur'} ${quoted(node.value, names, 'créneau supprimé', out ? 'et' : 'ou').text}`;
  }
  const parts = node.children.map((child) => describeSlotCondition(child, names, true)).filter(Boolean);
  const text = parts.join(node.combinator === 'and' ? ' et ' : ' ou ');
  return nested && parts.length > 1 ? `(${text})` : text;
}
