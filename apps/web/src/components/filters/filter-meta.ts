import { FILTER_OPERATORS, VALUELESS_OPERATORS, type FilterConditionOf, type FilterFieldKind, type FilterGroupOf, type FilterOperator, sumOf } from '@ordo/shared';
import type { FilterFields } from './FilterBuilder';

/** « est vide » / « n’est pas vide »: the same words for every kind of field. */
const EMPTY_LABELS = { isEmpty: 'est vide', isNotEmpty: 'n’est pas vide' } as const;

/** Operators of emptiness, left out of the fields whose value is never empty (required). */
const EMPTY_OPERATORS: readonly FilterOperator[] = ['isEmpty', 'isNotEmpty'];

export const OPERATOR_LABELS: Record<FilterFieldKind, Partial<Record<FilterOperator, string>>> = {
  text: {
    contains: 'contient',
    notContains: 'ne contient pas',
    is: 'est',
    isNot: 'n’est pas',
    ...EMPTY_LABELS,
  },
  number: { eq: '=', neq: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥', ...EMPTY_LABELS },
  date: {
    is: 'le',
    before: 'avant le',
    after: 'après le',
    onOrBefore: 'au plus tard le',
    onOrAfter: 'au plus tôt le',
    within: 'pendant',
    ...EMPTY_LABELS,
  },
  reference: {
    in: 'est',
    notIn: 'n’est pas',
    inTree: 'est dans (sous-éléments inclus)',
    ...EMPTY_LABELS,
  },
  multiReference: {
    anyOf: 'inclut l’un de',
    allOf: 'inclut tous',
    noneOf: 'n’inclut aucun de',
    ...EMPTY_LABELS,
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
    ...EMPTY_LABELS,
  },
  boolean: { isTrue: 'oui', isFalse: 'non' },
  category: { in: 'est', notIn: 'n’est pas', ...EMPTY_LABELS },
};

/**
 * Operators a condition on a field offers: its own ones (when it has some), else those of its kind, emptiness left out
 * of a required field; the operator of the condition stays offered when it no longer is (a saved « est vide » on a
 * field marked required since).
 * @param {Pick<FilterFields<F>, 'kinds' | 'operators' | 'required'>} fields Fields filtered.
 * @param {F} field Field.
 * @param {string} [current] Operator of the condition. Optional.
 * @returns {readonly FilterOperator[]} Operators.
 */
export function operatorsFor<F extends string>(fields: Pick<FilterFields<F>, 'kinds' | 'operators' | 'required'>, field: F, current?: string): readonly FilterOperator[] {
  const all: readonly FilterOperator[] = FILTER_OPERATORS[fields.kinds[field]];
  const own = fields.operators?.(field) ?? (fields.required?.has(field) ? all.filter((operator) => !EMPTY_OPERATORS.includes(operator)) : all);
  return current && !own.includes(current as FilterOperator) && all.includes(current as FilterOperator) ? [...own, current as FilterOperator] : own;
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
 * New condition on a field, with the first operator it offers.
 * @param {Pick<FilterFields<F>, 'kinds' | 'operators' | 'required'>} fields Fields filtered.
 * @param {F} field Field.
 * @returns {FilterConditionOf<F>} Condition.
 */
export function newConditionFor<F extends string>(fields: Pick<FilterFields<F>, 'kinds' | 'operators' | 'required'>, field: F): FilterConditionOf<F> {
  const operator = operatorsFor(fields, field)[0];
  return { type: 'condition', id: nodeId(), field, operator, value: defaultValueFor(fields.kinds[field], operator) };
}

/**
 * Number of conditions of a filter, nested ones included.
 * @param {FilterGroupOf<F>} group Group.
 * @returns {number} Count.
 */
export function countConditions<F extends string>(group: FilterGroupOf<F>): number {
  return sumOf(group.children, (child) => (child.type === 'condition' ? 1 : countConditions(child)));
}
