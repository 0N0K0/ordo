import { FILTER_OPERATORS, VALUELESS_OPERATORS, type FilterConditionOf, type FilterFieldKind, type FilterGroupOf, type FilterOperator } from '@ordo/shared';

export const OPERATOR_LABELS: Record<FilterFieldKind, Partial<Record<FilterOperator, string>>> = {
  text: {
    contains: 'contient',
    notContains: 'ne contient pas',
    is: 'est',
    isNot: 'n’est pas',
    isEmpty: 'est vide',
    isNotEmpty: 'n’est pas vide',
  },
  number: { eq: '=', neq: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥', isEmpty: 'est vide', isNotEmpty: 'n’est pas vide' },
  date: {
    is: 'le',
    before: 'avant le',
    after: 'après le',
    onOrBefore: 'au plus tard le',
    onOrAfter: 'au plus tôt le',
    within: 'pendant',
    isEmpty: 'n’est pas renseignée',
    isNotEmpty: 'est renseignée',
  },
  reference: {
    in: 'est',
    notIn: 'n’est pas',
    inTree: 'est dans (sous-éléments inclus)',
    isEmpty: 'est vide',
    isNotEmpty: 'n’est pas vide',
  },
  multiReference: {
    anyOf: 'inclut l’un de',
    allOf: 'inclut tous',
    noneOf: 'n’inclut aucun de',
    isEmpty: 'personne',
    isNotEmpty: 'au moins une personne',
  },
  sprint: {
    in: 'est l’un de',
    notIn: 'n’est aucun de',
    allOf: 'inclut tous',
    current: 'en cours',
    previous: 'précédent',
    next: 'suivant',
    past: 'passé',
    future: 'à venir',
    isEmpty: 'aucun',
    isNotEmpty: 'au moins un',
  },
  boolean: { isTrue: 'oui', isFalse: 'non' },
  category: { in: 'est', notIn: 'n’est pas' },
};

export const PERIOD_LABELS: Record<string, string> = {
  thisWeek: 'Cette semaine',
  lastWeek: 'La semaine dernière',
  nextWeek: 'La semaine prochaine',
  thisMonth: 'Ce mois-ci',
  lastMonth: 'Le mois dernier',
  nextMonth: 'Le mois prochain',
  thisYear: 'Cette année',
  lastYear: 'L’année dernière',
  nextYear: 'L’année prochaine',
};

/**
 * Operators of a field, from the kinds of the fields filtered.
 * @param {Record<F, FilterFieldKind>} kinds Kind of each field.
 * @param {F} field Field.
 * @returns {readonly FilterOperator[]} Operators.
 */
export function operatorsFor<F extends string>(kinds: Record<F, FilterFieldKind>, field: F): readonly FilterOperator[] {
  return FILTER_OPERATORS[kinds[field]];
}

/**
 * Random id for a new filter node.
 * @returns {string} Id.
 */
export function nodeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Starting value of a condition for a kind of field and an operator.
 * @param {FilterFieldKind} kind Kind of the field.
 * @param {FilterOperator} operator Operator.
 * @returns {FilterConditionOf<string>['value']} Value.
 */
export function defaultValueFor(kind: FilterFieldKind, operator: FilterOperator): FilterConditionOf<string>['value'] {
  if (VALUELESS_OPERATORS.includes(operator)) return null;
  switch (kind) {
    case 'text':
      return '';
    case 'number':
      return null;
    case 'date':
      return operator === 'within' ? 'thisWeek' : 'today';
    default:
      return [];
  }
}

/**
 * New condition on a field, with its first operator.
 * @param {Record<F, FilterFieldKind>} kinds Kind of each field.
 * @param {F} field Field.
 * @returns {FilterConditionOf<F>} Condition.
 */
export function newConditionFor<F extends string>(kinds: Record<F, FilterFieldKind>, field: F): FilterConditionOf<F> {
  const operator = operatorsFor(kinds, field)[0];
  return { type: 'condition', id: nodeId(), field, operator, value: defaultValueFor(kinds[field], operator) };
}

/**
 * Number of conditions of a filter, nested ones included.
 * @param {FilterGroupOf<F>} group Group.
 * @returns {number} Count.
 */
export function countConditions<F extends string>(group: FilterGroupOf<F>): number {
  return group.children.reduce((sum, child) => sum + (child.type === 'condition' ? 1 : countConditions(child)), 0);
}
