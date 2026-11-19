import type { SlotCondition, SlotConditionItem } from '@ordo/shared';

/**
 * Condition without any part (any time).
 * @returns {SlotCondition} Condition.
 */
export const emptySlotCondition = (): SlotCondition => ({ type: 'group', id: 'root', combinator: 'and', children: [] });

/**
 * Condition on calendar schedules as text: "(sur déjeuner ou dîner et sur garde alternée) ou hors de sommeil".
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @param {Map<string, string>} names Names of the schedules.
 * @param {boolean} [nested] Inside a group (written within parentheses). Optional. Default = false.
 * @returns {string} Text (empty: any time).
 */
export function describeSlotCondition(node: SlotCondition | SlotConditionItem | null | undefined, names: Map<string, string>, nested = false): string {
  if (!node) return '';
  if (node.type === 'condition') {
    if (node.field === 'freeTime') {
      const except = (Array.isArray(node.value) ? node.value : []).map((id) => `« ${names.get(id) ?? 'plage supprimée'} »`);
      return node.operator === 'notIn' && except.length ? `hors de toutes les plages sauf ${except.join(' et ')}` : 'hors de toutes les plages';
    }
    const listed = (Array.isArray(node.value) ? node.value : []).map((id) => `« ${names.get(id) ?? 'plage supprimée'} »`).join(node.operator === 'notIn' ? ' et ' : ' ou ');
    return `${node.operator === 'notIn' ? 'hors de' : 'sur'} ${listed}`;
  }
  const parts = node.children.map((child) => describeSlotCondition(child, names, true)).filter(Boolean);
  const text = parts.join(node.combinator === 'and' ? ' et ' : ' ou ');
  return nested && parts.length > 1 ? `(${text})` : text;
}
