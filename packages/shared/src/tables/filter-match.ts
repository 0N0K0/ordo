import { normalize } from '../core/text';
import { isEmptyValue } from '../core/inheritance';
import { filterDay, filterPeriod, type FilterConditionOf, type FilterGroupOf, type FilterOperator } from './filters';
import { DEFAULT_WEEK, type WeekSpan } from '../dates/weeks';

/** Kind of the value a filter reads on a row (the column filters of the tables). */
export type FilterValueKind = 'text' | 'number' | 'date' | 'boolean' | 'choice' | 'choices';

/** Value of a row a condition is checked against, with its kind. */
export interface FilterFieldValue {
  kind: FilterValueKind;
  /** Text, number, day (YYYY-MM-DD), boolean, a choice or a list of choices. */
  value: unknown;
  /** Choice standing for « Aucun » (an empty choice). Optional. */
  none?: unknown;
}

/**
 * Whether a value of a row meets a condition: the one rule of every filter of a table (texts without case nor accents,
 * days and periods from today, choices one of / all of / none of), the same in the app and in the API.
 * @param {FilterConditionOf<string>} condition Condition (complete).
 * @param {FilterFieldValue} field Value of the row, with its kind.
 * @param {string} today Today (YYYY-MM-DD).
 * @param {WeekSpan} [week] Week of the workspace (the periods « cette semaine »…). Optional. Default = Monday to Sunday.
 * @returns {boolean} Met.
 */
export function meetsCondition(condition: FilterConditionOf<string>, { kind, value, none }: FilterFieldValue, today: string, week: WeekSpan = DEFAULT_WEEK): boolean {
  const operator = condition.operator as FilterOperator;
  const wanted = condition.value;
  // A choice of the « Aucun » option is empty.
  const empty = isEmptyValue(value) || (kind === 'choice' && none !== undefined && value === none);
  if (operator === 'isEmpty') return empty;
  if (operator === 'isNotEmpty') return !empty;
  if (operator === 'isTrue') return value === true;
  if (operator === 'isFalse') return value === false;
  switch (kind) {
    case 'text': {
      // Without case nor accents, as the searches of the selects.
      const text = normalize(String(value ?? ''));
      const query = normalize(String(wanted ?? ''));
      return { contains: text.includes(query), notContains: !text.includes(query), is: text === query, isNot: text !== query }[operator as 'is'] ?? true;
    }
    case 'number': {
      if (typeof value !== 'number' || typeof wanted !== 'number') return operator === 'neq';
      return { eq: value === wanted, neq: value !== wanted, lt: value < wanted, lte: value <= wanted, gt: value > wanted, gte: value >= wanted }[operator as 'eq'] ?? true;
    }
    case 'date': {
      if (typeof value !== 'string') return false;
      if (operator === 'within') {
        const [from, to] = filterPeriod(String(wanted), today, week);
        return value >= from && value < to;
      }
      const target = filterDay(String(wanted), today);
      return { is: value === target, before: value < target, after: value > target, onOrBefore: value <= target, onOrAfter: value >= target }[operator as 'is'] ?? true;
    }
    case 'choice': {
      const chosen = Array.isArray(wanted) ? wanted : [];
      const inside = value !== null && value !== undefined && chosen.includes(String(value));
      return operator === 'notIn' ? !inside : inside;
    }
    case 'choices': {
      const own: unknown[] = Array.isArray(value) ? value : [];
      const chosen = Array.isArray(wanted) ? wanted : [];
      // « est » / « n’est pas », saved while the column held one value (the routine or the event of a time), read as
      // « inclut l’un de » / « n’inclut aucun de ».
      if (operator === 'anyOf' || operator === 'in') return chosen.some((item) => own.includes(item));
      if (operator === 'allOf') return chosen.every((item) => own.includes(item));
      return !chosen.some((item) => own.includes(item));
    }
    default:
      return true;
  }
}

/**
 * Whether a row meets a filter tree: every child of a group « et », one of a group « ou »; an empty group is met.
 * @param {FilterGroupOf<string>} group Group.
 * @param {(condition: FilterConditionOf<string>) => boolean} meets Whether the row meets a condition.
 * @returns {boolean} Met.
 */
export function matchesFilter(group: FilterGroupOf<string>, meets: (condition: FilterConditionOf<string>) => boolean): boolean {
  if (group.children.length === 0) return true;
  const results = group.children.map((child) => (child.type === 'condition' ? meets(child) : matchesFilter(child, meets)));
  return group.combinator === 'and' ? results.every(Boolean) : results.some(Boolean);
}
