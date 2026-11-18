import { z } from 'zod';
import { calendarStart, shiftCalendar } from '../dates/periods';
import { addDays } from '../dates/recurrence';
import { isRealDay } from '../dates/times';
import { DEFAULT_WEEK, weekRange, type WeekSpan } from '../dates/weeks';

/** Kind of value a filter field holds; it decides the available operators. */
export type FilterFieldKind = 'text' | 'number' | 'date' | 'reference' | 'multiReference' | 'sprint' | 'boolean' | 'category';

/** Operators available for each field kind. */
export const FILTER_OPERATORS = {
  text: ['contains', 'notContains', 'is', 'isNot', 'isEmpty', 'isNotEmpty'],
  number: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'isEmpty', 'isNotEmpty'],
  date: ['is', 'before', 'after', 'onOrBefore', 'onOrAfter', 'within', 'isEmpty', 'isNotEmpty'],
  // `inTree` (project, parent): the item or any of its descendants.
  reference: ['in', 'notIn', 'inTree', 'isEmpty', 'isNotEmpty'],
  multiReference: ['anyOf', 'allOf', 'noneOf', 'isEmpty', 'isNotEmpty'],
  // A task may be in several sprints: it matches when one of them does. `in` / `notIn`: any / none of the
  // chosen sprints; the relative operators follow the calendar (previous / next: per project tree).
  sprint: ['in', 'notIn', 'allOf', 'current', 'previous', 'next', 'past', 'future', 'isEmpty', 'isNotEmpty'],
  boolean: ['isTrue', 'isFalse'],
  category: ['in', 'notIn'],
} as const satisfies Record<FilterFieldKind, readonly string[]>;
export type FilterOperator = (typeof FILTER_OPERATORS)[FilterFieldKind][number];

/** Value of an assignee condition standing for the logged-in user's contributor profile. */
export const ME = '@me';

/** Operators that take no value. */
export const VALUELESS_OPERATORS: readonly FilterOperator[] = ['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse', 'current', 'previous', 'next', 'past', 'future'];

/**
 * Relative date tokens: `today`, `today+3`, `today-7` (days from today),
 * or a period for `within`: `thisWeek`, `lastWeek`, `nextWeek`, `thisMonth`, `lastMonth`, `nextMonth`, `thisYear`, `lastYear`, `nextYear`,
 * `past:7` / `next:7` (the last / next N days, today included).
 */
const DATE_PERIODS = ['thisWeek', 'lastWeek', 'nextWeek', 'thisMonth', 'lastMonth', 'nextMonth', 'thisYear', 'lastYear', 'nextYear'] as const;

const relativeDay = /^today([+-]\d{1,4})?$/;
const rollingPeriod = /^(past|next):\d{1,4}$/;

/** A day of a date condition: a calendar date, today, or N days before or after it. */
const filterDaySchema = z.string().refine((value) => isRealDay(value) || relativeDay.test(value), 'Date invalide.');

/** A period, for the `within` operator. */
const filterPeriodSchema = z.string().refine((value) => (DATE_PERIODS as readonly string[]).includes(value) || rollingPeriod.test(value), 'Période invalide.');

/**
 * Day of a day token (`YYYY-MM-DD`, `today`, `today+3`, `today-7`).
 * @param {string} token Day token.
 * @param {string} today User's current day (YYYY-MM-DD).
 * @returns {string} YYYY-MM-DD.
 */
export function filterDay(token: string, today: string): string {
  const relative = /^today([+-]\d+)?$/.exec(token);
  if (!relative) return token;
  return addDays(today, Number(relative[1] ?? 0));
}

/**
 * First day and the day after the last one of a period token (`thisWeek`, `lastMonth`, `past:7`, `next:30`…).
 * Weeks are those of the workspace (Monday to Sunday by default).
 * @param {string} token Period token.
 * @param {string} today User's current day (YYYY-MM-DD).
 * @param {WeekSpan} [week] Week of the workspace. Optional. Default = Monday to Sunday.
 * @returns {[string, string]} [first day, day after the last one], YYYY-MM-DD.
 */
export function filterPeriod(token: string, today: string, week: WeekSpan = DEFAULT_WEEK): [string, string] {
  const rolling = /^(past|next):(\d+)$/.exec(token);
  if (rolling) {
    const days = Number(rolling[2]);
    return rolling[1] === 'past' ? [addDays(today, -(days - 1)), addDays(today, 1)] : [today, addDays(today, days)];
  }
  if (token.endsWith('Week')) return weekRange(today, week, token === 'lastWeek' ? -1 : token === 'nextWeek' ? 1 : 0);
  const scale = token.endsWith('Year') ? 'year' : 'month';
  const shift = token === 'lastYear' || token === 'lastMonth' ? -1 : token === 'nextYear' || token === 'nextMonth' ? 1 : 0;
  const start = shiftCalendar(scale, calendarStart(scale, today), shift);
  return [start, shiftCalendar(scale, start, 1)];
}

/** Condition of a filter on some fields (tasks, routines…). */
export interface FilterConditionOf<F extends string> {
  type: 'condition';
  /** Stable id, for the filter builder UI. */
  id: string;
  field: F;
  operator: string;
  /** string (text, day, period), number, or list of ids / categories, depending on the operator. */
  value?: string | number | string[] | null;
}

/** Group of conditions of a filter on some fields. */
export interface FilterGroupOf<F extends string> {
  type: 'group';
  id: string;
  /** How the children combine: all of them (and) or at least one (or). */
  combinator: 'and' | 'or';
  children: (FilterGroupOf<F> | FilterConditionOf<F>)[];
}

/**
 * Schema of a filter condition on some fields: its operator fits the kind of its field, and so does its value.
 * @param {Record<F, FilterFieldKind>} fields Fields and their kind.
 * @param {Partial<Record<F, readonly string[]>>} choices Values allowed for the fields of kind `category`.
 * @returns {z.ZodType<FilterConditionOf<F>>} Schema.
 */
export function filterConditionSchemaFor<F extends string>(fields: Record<F, FilterFieldKind>, choices: Partial<Record<F, readonly string[]>>): z.ZodType<FilterConditionOf<F>> {
  return z
    .object({
      type: z.literal('condition'),
      id: z.string().min(1).max(64),
      field: z.enum(Object.keys(fields) as [F, ...F[]]),
      operator: z.string(),
      value: z.union([z.string(), z.number(), z.array(z.string()), z.null()]).optional(),
    })
    .superRefine((condition, ctx) => {
      const field = condition.field as F;
      const kind = fields[field];
      const operators = FILTER_OPERATORS[kind] as readonly string[];
      if (!operators.includes(condition.operator)) {
        ctx.addIssue({ code: 'custom', path: ['operator'], message: 'Opérateur invalide pour ce champ.' });
        return;
      }
      const operator = condition.operator as FilterOperator;
      if (VALUELESS_OPERATORS.includes(operator)) return;

      const { value } = condition;
      const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['value'], message });
      switch (kind) {
        case 'text':
          if (typeof value !== 'string') issue('Texte attendu.');
          break;
        case 'number':
          if (typeof value !== 'number' || !Number.isFinite(value)) issue('Nombre attendu.');
          break;
        case 'date': {
          const schema = operator === 'within' ? filterPeriodSchema : filterDaySchema;
          if (!schema.safeParse(value).success) issue(operator === 'within' ? 'Période invalide.' : 'Date invalide.');
          break;
        }
        case 'reference':
        case 'multiReference':
        case 'sprint':
          if (!Array.isArray(value) || value.length === 0) issue('Choisissez au moins une valeur.');
          break;
        case 'category': {
          const allowed = choices[field] ?? [];
          if (!Array.isArray(value) || value.length === 0 || !value.every((item) => allowed.includes(item))) issue('Choisissez au moins une catégorie.');
          break;
        }
      }
    }) as unknown as z.ZodType<FilterConditionOf<F>>;
}

/**
 * Schema of a filter tree (groups of conditions) on some fields.
 * @param {z.ZodType<FilterConditionOf<F>>} condition Schema of a condition.
 * @returns {z.ZodType<FilterGroupOf<F>>} Schema.
 */
export function filterGroupSchemaFor<F extends string>(condition: z.ZodType<FilterConditionOf<F>>): z.ZodType<FilterGroupOf<F>> {
  const group: z.ZodType<FilterGroupOf<F>> = z.lazy(() =>
    z.object({
      type: z.literal('group'),
      id: z.string().min(1).max(64),
      combinator: z.enum(['and', 'or']),
      children: z.array(z.union([group, condition])).max(50),
    }),
  );
  return group;
}

/** Maximum nesting of filter groups. */
export const MAX_FILTER_DEPTH = 5;

/**
 * Nesting depth of a filter tree (1 for a group of conditions).
 * @param {FilterGroup} group Root group.
 * @returns {number} Depth.
 */
export function filterDepth<F extends string>(group: FilterGroupOf<F>): number {
  return 1 + Math.max(0, ...group.children.map((child) => (child.type === 'group' ? filterDepth(child) : 0)));
}
