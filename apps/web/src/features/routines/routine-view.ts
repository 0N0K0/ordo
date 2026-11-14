import {
  defaultRoutineViewConfig,
  filterDay,
  formatDuration,
  filterPeriod,
  firstRoutineViews,
  ME,
  ROUTINE_FILTER_FIELDS,
  ROUTINE_REPETITIONS,
  ROUTINE_STATES,
  routineFilterConditionSchema,
  routineViewConfigSchema,
  type FilterOperator,
  type RoutineFilterCondition,
  type RoutineFilterField,
  type RoutineFilterGroup,
  type RoutineGroupBy,
  type RoutineSortKey,
  type RoutineViewConfig,
} from '@ordo/shared';
import { categoryOptions, categoryTree } from '../../components/category-tree/category-tree';
import { treeOptions, treeSelectProps } from '../../components/tree-select/tree-select';
import { localDay } from '../../lib/dates';
import type { FilterFields } from '../tasks/views/FilterBuilder';
import { useSavedViews } from '../tasks/views/use-saved-views';
import type { TaskContext } from '../tasks/use-task-context';
import type { Routine, RoutineCategory } from './api';
import { categoryGrouping, ruleOf, stateOf, waitingFor, type RoutineGrouping } from './routine-format';
import * as fmt from '../../lib/format';
import { currentWeek } from '../../lib/week';

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export const ROUTINE_FIELD_LABELS: Record<RoutineFilterField, string> = {
  title: 'Titre',
  description: 'Description',
  location: 'Lieu',
  categories: 'Catégories',
  project: 'Projet',
  assignees: 'Assignés',
  parent: 'Routine parente',
  requires: 'Dépend de',
  state: 'État',
  repetition: 'Répétition',
  estimate: 'Temps estimé (min)',
  currentDate: 'Échéance en cours',
  firstDate: 'Première échéance',
  nextDate: 'Prochaine échéance',
  startDate: 'Première fois',
  lastDoneAt: 'Faite pour la dernière fois',
  done: 'Faite',
  waiting: 'En attente d’une autre',
  hasSubRoutines: 'A des sous-routines',
  optionalTimes: 'A des moments facultatifs',
  doableNow: 'Faisable maintenant',
  archived: 'Archivée',
};

export const ROUTINE_FIELD_GROUPS: { group: string; fields: RoutineFilterField[] }[] = [
  { group: 'Texte', fields: ['title', 'description', 'location'] },
  { group: 'Organisation', fields: ['categories', 'project', 'assignees', 'parent', 'requires', 'repetition', 'estimate'] },
  { group: 'Dates', fields: ['currentDate', 'firstDate', 'nextDate', 'startDate', 'lastDoneAt'] },
  { group: 'État', fields: ['state', 'done', 'waiting', 'hasSubRoutines', 'optionalTimes', 'doableNow', 'archived'] },
];

export const ROUTINE_STATE_LABELS: Record<(typeof ROUTINE_STATES)[number], string> = { late: 'En retard', due: 'À faire', upcoming: 'À venir', done: 'Faite' };

export const REPETITION_LABELS: Record<(typeof ROUTINE_REPETITIONS)[number], string> = {
  DAILY: 'Chaque jour',
  WEEKLY: 'Chaque semaine',
  MONTHLY: 'Chaque mois',
  YEARLY: 'Chaque année',
  SCHEDULE: 'Selon un planning',
};

export const ROUTINE_SORT_LABELS: Record<RoutineSortKey, string> = {
  title: 'Titre',
  state: 'État',
  currentDate: 'Échéance en cours',
  firstDate: 'Première échéance',
  nextDate: 'Prochaine échéance',
  startDate: 'Première fois',
  lastDoneAt: 'Faite pour la dernière fois',
  repetition: 'Répétition',
  estimate: 'Temps estimé',
  trackedTime: 'Temps passé',
  project: 'Projet',
  categories: 'Catégories',
  assignees: 'Assignés',
};

export const ROUTINE_GROUP_BY_LABELS: Record<RoutineGroupBy, string> = {
  category: 'Catégorie',
  project: 'Projet',
  assignees: 'Assignés',
  state: 'État',
  repetition: 'Répétition',
};

/**
 * Repetition of a routine: the frequency of its rule, or the slots of a calendar schedule.
 * @param {Routine} routine Routine.
 * @returns {(typeof ROUTINE_REPETITIONS)[number]} Repetition.
 */
export const repetitionOf = (routine: Routine): (typeof ROUTINE_REPETITIONS)[number] => (routine.scheduleId ? 'SCHEDULE' : (ruleOf(routine)?.frequency ?? 'DAILY'));

/**
 * Parses a stored routine view configuration, falling back to the defaults when it is invalid.
 * @param {unknown} config Stored configuration.
 * @returns {RoutineViewConfig} Configuration.
 */
function parseConfig(config: unknown): RoutineViewConfig {
  const result = routineViewConfigSchema.safeParse(config);
  return result.success ? result.data : defaultRoutineViewConfig();
}

/**
 * Saved routine views of a scope (a project's routine tab or the routines page) and the working copy of the current
 * one; « À faire », « Toutes » and « Archivées » are made when the scope has none.
 * @param {string | null} projectId Project, or null for the routines page.
 * @returns {object} Views, current view, its working configuration and the view actions.
 */
export function useRoutineView(projectId: string | null) {
  return useSavedViews<RoutineViewConfig>({ projectId, kind: 'ROUTINES', parse: parseConfig, blank: defaultRoutineViewConfig, first: firstRoutineViews, param: 'routineView' });
}

/** What the evaluation of the routine filters needs. */
export interface RoutineEnv {
  today: string;
  byId: Map<string, Routine>;
  categories: RoutineCategory[];
  context: TaskContext;
  /** Whether the slot rule of a routine allows now. */
  doable: (routine: Routine) => boolean;
}

/**
 * Ids of some categories and of their sub-categories.
 * @param {RoutineCategory[]} categories Every category.
 * @param {string[]} ids Categories.
 * @returns {Set<string>} Ids.
 */
function categorySubtree(categories: RoutineCategory[], ids: string[]): Set<string> {
  const result = new Set(ids);
  for (let grown = true; grown;) {
    grown = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        grown = true;
      }
    }
  }
  return result;
}

/**
 * Value of a routine for a filter field.
 * @param {Routine} routine Routine.
 * @param {RoutineFilterField} field Field.
 * @param {RoutineEnv} env Environment.
 * @returns {string | number | boolean | string[] | null} Value.
 */
function fieldValue(routine: Routine, field: RoutineFilterField, env: RoutineEnv): string | number | boolean | string[] | null {
  switch (field) {
    case 'title':
      return routine.title;
    case 'description':
      return routine.description ?? null;
    case 'location':
      return routine.location ?? null;
    case 'categories':
      return routine.categoryIds;
    case 'project':
      return routine.projectId ?? null;
    case 'assignees':
      return routine.assigneeIds;
    case 'parent':
      return routine.parentId ?? null;
    case 'requires':
      return routine.requiredIds;
    case 'state':
      return stateOf(routine, env.today, env.doable(routine));
    case 'repetition':
      return repetitionOf(routine);
    case 'estimate':
      return routine.estimate ?? null;
    case 'currentDate':
      return routine.currentDate ? String(routine.currentDate) : null;
    case 'firstDate':
      return routine.firstDate ? String(routine.firstDate) : null;
    case 'nextDate':
      return routine.nextDate ? String(routine.nextDate) : null;
    case 'startDate':
      return String(routine.startDate);
    case 'lastDoneAt':
      return routine.lastDoneAt ? localDay(new Date(String(routine.lastDoneAt))) : null;
    case 'done':
      return routine.done;
    case 'waiting':
      return waitingFor(routine, env.byId).length > 0;
    case 'hasSubRoutines':
      return [...env.byId.values()].some((other) => other.parentId === routine.id);
    case 'optionalTimes':
      return routine.slots.some((slot) => slot.optional);
    case 'doableNow':
      return env.doable(routine);
    case 'archived':
      return routine.archived;
  }
}

/**
 * Whether a routine meets a condition (an incomplete condition is met).
 * @param {RoutineFilterCondition} condition Condition.
 * @param {Routine} routine Routine.
 * @param {RoutineEnv} env Environment.
 * @returns {boolean} Met.
 */
function meets(condition: RoutineFilterCondition, routine: Routine, env: RoutineEnv): boolean {
  if (!routineFilterConditionSchema.safeParse(condition).success) return true;
  const operator = condition.operator as FilterOperator;
  const value = fieldValue(routine, condition.field, env);
  const wanted = condition.value;
  const kind = ROUTINE_FILTER_FIELDS[condition.field];
  if (operator === 'isEmpty') return value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (operator === 'isNotEmpty') return !(value === null || value === '' || (Array.isArray(value) && value.length === 0));
  if (operator === 'isTrue') return value === true;
  if (operator === 'isFalse') return value !== true;
  switch (kind) {
    case 'text': {
      const text = String(value ?? '').toLowerCase();
      const query = String(wanted ?? '').toLowerCase();
      if (operator === 'contains') return text.includes(query);
      if (operator === 'notContains') return !text.includes(query);
      if (operator === 'is') return text === query;
      return text !== query;
    }
    case 'number': {
      if (typeof value !== 'number' || typeof wanted !== 'number') return operator === 'neq';
      return { eq: value === wanted, neq: value !== wanted, lt: value < wanted, lte: value <= wanted, gt: value > wanted, gte: value >= wanted }[operator as 'eq'] ?? true;
    }
    case 'date': {
      if (typeof value !== 'string') return false;
      if (operator === 'within') {
        const [from, to] = filterPeriod(String(wanted), env.today, currentWeek());
        return value >= from && value < to;
      }
      const day = filterDay(String(wanted), env.today);
      return { is: value === day, before: value < day, after: value > day, onOrBefore: value <= day, onOrAfter: value >= day }[operator as 'is'] ?? true;
    }
    case 'category': {
      const chosen = Array.isArray(wanted) ? wanted : [];
      return operator === 'in' ? chosen.includes(String(value)) : !chosen.includes(String(value));
    }
    case 'reference': {
      const chosen = Array.isArray(wanted) ? wanted : [];
      if (operator === 'inTree') {
        // The project or routine, or one of its parents.
        if (condition.field === 'project') {
          for (let id = value as string | null; id; id = env.context.projectById.get(id)?.parentId ?? null) if (chosen.includes(id)) return true;
          return false;
        }
        for (let id = value as string | null; id; id = env.byId.get(id)?.parentId ?? null) if (chosen.includes(id)) return true;
        return false;
      }
      const inside = value !== null && chosen.includes(String(value));
      return operator === 'in' ? inside : !inside;
    }
    case 'multiReference': {
      const own = Array.isArray(value) ? value : [];
      const me = env.context.contributors.find((contributor) => contributor.isMe)?.id;
      const chosen = (Array.isArray(wanted) ? wanted : []).map((id) => (id === ME ? (me ?? id) : id));
      // A category matches with its sub-categories.
      const has = (id: string) => (condition.field === 'categories' ? own.some((item) => categorySubtree(env.categories, [id]).has(item)) : own.includes(id));
      if (operator === 'anyOf') return chosen.some(has);
      if (operator === 'allOf') return chosen.every(has);
      return !chosen.some(has);
    }
    default:
      return true;
  }
}

/**
 * Whether a routine meets a filter tree.
 * @param {RoutineFilterGroup} group Filter.
 * @param {Routine} routine Routine.
 * @param {RoutineEnv} env Environment.
 * @returns {boolean} Met.
 */
export function matchesRoutine(group: RoutineFilterGroup, routine: Routine, env: RoutineEnv): boolean {
  if (group.children.length === 0) return true;
  const results = group.children.map((child) => (child.type === 'condition' ? meets(child, routine, env) : matchesRoutine(child, routine, env)));
  return group.combinator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Whether a routine is shown by a view: not archived (unless asked), found by the search, meeting the filter.
 * @param {RoutineViewConfig} config View configuration.
 * @param {Routine} routine Routine.
 * @param {RoutineEnv} env Environment.
 * @returns {boolean} Shown.
 */
export function keptByView(config: RoutineViewConfig, routine: Routine, env: RoutineEnv): boolean {
  if (routine.archived && !config.includeArchived) return false;
  const search = config.search.trim().toLowerCase();
  if (search && ![routine.title, routine.description, routine.location].some((text) => text?.toLowerCase().includes(search))) return false;
  return matchesRoutine(config.filter, routine, env);
}

/**
 * Routines in the order of a view: its sorts in priority order (empty values last), then the manual order.
 * @param {Routine[]} routines Routines, in manual order.
 * @param {RoutineViewConfig['sorting']} sorting Sorts.
 * @param {RoutineEnv} env Environment.
 * @returns {Routine[]} Sorted copy.
 */
export function sortRoutines(routines: Routine[], sorting: RoutineViewConfig['sorting'], env: RoutineEnv): Routine[] {
  if (sorting.length === 0) return routines;
  const categoryRank = new Map(categoryTree(env.categories).map((item, index) => [item.category.id, index]));
  const contributorName = new Map(env.context.contributors.map((contributor) => [contributor.id, contributor.isMe ? 'Moi' : contributor.name]));
  /**
   * Sort value of a routine for a key (null: empty).
   * @param {Routine} routine Routine.
   * @param {RoutineSortKey} key Sort key.
   * @returns {string | number | null} Value.
   */
  const valueOf = (routine: Routine, key: RoutineSortKey): string | number | null => {
    switch (key) {
      case 'title':
        return routine.title;
      case 'state':
        return ROUTINE_STATES.indexOf(stateOf(routine, env.today, env.doable(routine)));
      case 'currentDate':
        return routine.currentDate ? String(routine.currentDate) : null;
      case 'firstDate':
        return routine.firstDate ? String(routine.firstDate) : null;
      case 'nextDate':
        return routine.nextDate ? String(routine.nextDate) : null;
      case 'startDate':
        return String(routine.startDate);
      case 'lastDoneAt':
        return routine.lastDoneAt ? String(routine.lastDoneAt) : null;
      case 'repetition':
        return ROUTINE_REPETITIONS.indexOf(repetitionOf(routine));
      case 'estimate':
        return routine.estimate ?? null;
      case 'trackedTime':
        return routine.trackedSeconds || null;
      case 'project':
        return routine.projectId ? env.context.projectLabel(routine.projectId) : null;
      case 'categories':
        return routine.categoryIds.length ? Math.min(...routine.categoryIds.map((id) => categoryRank.get(id) ?? Infinity)) : null;
      case 'assignees': {
        const names = routine.assigneeIds.map((id) => contributorName.get(id) ?? '').sort(collator.compare);
        return names[0] ?? null;
      }
    }
  };
  return [...routines].sort((a, b) => {
    for (const { id, desc } of sorting) {
      const [x, y] = [valueOf(a, id), valueOf(b, id)];
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
      if (order) return desc ? -order : order;
    }
    return a.position - b.position;
  });
}

/**
 * Groups of a view.
 * @param {RoutineGroupBy | null} groupBy Field grouped by, null for none.
 * @param {RoutineEnv} env Environment.
 * @returns {RoutineGrouping | null} Grouping.
 */
export function routineGrouping(groupBy: RoutineGroupBy | null, env: RoutineEnv): RoutineGrouping | null {
  switch (groupBy) {
    case null:
      return null;
    case 'category':
      return categoryGrouping(env.categories);
    case 'project':
      // Clients and projects as their tree.
      return {
        groups: env.context.projectOptions(env.context.projects).map((option) => ({ id: option.value, name: option.label, color: null, parentId: option.parent })),
        of: (routine) => (routine.projectId ? [routine.projectId] : []),
        noneName: 'Sans projet',
      };
    case 'assignees':
      return {
        groups: [...env.context.contributors]
          .sort((a, b) => Number(b.isMe) - Number(a.isMe) || collator.compare(a.name, b.name))
          .map((contributor) => ({ id: contributor.id, name: contributor.isMe ? 'Moi' : contributor.name, color: null, parentId: null })),
        of: (routine) => routine.assigneeIds,
        noneName: 'Personne',
      };
    case 'state':
      return {
        groups: ROUTINE_STATES.map((state) => ({ id: state, name: ROUTINE_STATE_LABELS[state], color: null, parentId: null })),
        of: (routine) => [stateOf(routine, env.today, env.doable(routine))],
        noneName: '',
      };
    case 'repetition':
      return {
        groups: ROUTINE_REPETITIONS.map((repetition) => ({ id: repetition, name: REPETITION_LABELS[repetition], color: null, parentId: null })),
        of: (routine) => [repetitionOf(routine)],
        noneName: '',
      };
  }
}

/** Operator labels of the routine fields, where those of their kind do not fit. */
const OPERATOR_OVERRIDES: Partial<Record<RoutineFilterField, Partial<Record<FilterOperator, string>>>> = {
  categories: { isEmpty: 'aucune', isNotEmpty: 'au moins une' },
  requires: { isEmpty: 'aucune', isNotEmpty: 'au moins une' },
  parent: { isEmpty: 'aucune (routine principale)', isNotEmpty: 'une (sous-routine)' },
  project: { isEmpty: 'aucun', isNotEmpty: 'un' },
};

/**
 * Fields of the routine filters, their values from the routines and the task context.
 * @param {RoutineEnv} env Environment.
 * @returns {FilterFields<RoutineFilterField>} Fields.
 */
export function routineFilterFields(env: RoutineEnv): FilterFields<RoutineFilterField> {
  const routineTree = treeOptions([...env.byId.values()].sort((a, b) => a.position - b.position).map((routine) => ({ id: routine.id, parentId: routine.parentId ?? null, label: routine.title })));
  return {
    kinds: ROUTINE_FILTER_FIELDS,
    labels: ROUTINE_FIELD_LABELS,
    groups: ROUTINE_FIELD_GROUPS,
    first: 'title',
    options: (field) => {
      switch (field) {
        case 'categories':
          return treeSelectProps(categoryOptions(env.categories));
        case 'project':
          return treeSelectProps(env.context.projectOptions(env.context.projects));
        case 'parent':
        case 'requires':
          return treeSelectProps(routineTree);
        case 'assignees':
          return {
            data: [{ value: ME, label: 'Moi' }, ...env.context.contributors.filter((contributor) => !contributor.isMe).map((contributor) => ({ value: contributor.id, label: contributor.name }))],
          };
        case 'state':
          return { data: ROUTINE_STATES.map((state) => ({ value: state, label: ROUTINE_STATE_LABELS[state] })) };
        case 'repetition':
          return { data: ROUTINE_REPETITIONS.map((repetition) => ({ value: repetition, label: REPETITION_LABELS[repetition] })) };
        default:
          return { data: [] };
      }
    },
    isComplete: (condition) => routineFilterConditionSchema.safeParse(condition).success,
    operatorLabel: (field, operator) => OPERATOR_OVERRIDES[field]?.[operator],
    emptyText: 'Aucun filtre : toutes les routines sont affichées.',
  };
}

/**
 * Texts of the columns of the routine table, for its exports (by column id).
 * @param {RoutineEnv} env Environment.
 * @returns {Record<string, (routine: Routine) => string>} Texts.
 */
export function routineTexts(env: RoutineEnv): Record<string, (routine: Routine) => string> {
  const day = (value: unknown) => (value ? fmt.exportDay(String(value).slice(0, 10)) : '');
  const categoryName = new Map(env.categories.map((category) => [category.id, category.name]));
  const contributorName = new Map(env.context.contributors.map((contributor) => [contributor.id, contributor.name]));
  return {
    title: (routine) => routine.title,
    currentDate: (routine) => day(routine.currentDate),
    firstDate: (routine) => day(routine.firstDate),
    nextDate: (routine) => day(routine.nextDate),
    repetition: (routine) => REPETITION_LABELS[repetitionOf(routine)],
    estimate: (routine) => (routine.estimate ? `${routine.estimate} min` : ''),
    trackedTime: (routine) => (routine.trackedSeconds ? formatDuration(routine.trackedSeconds) : ''),
    lastDoneAt: (routine) => (routine.lastDoneAt ? fmt.exportDateTime(new Date(String(routine.lastDoneAt))) : ''),
    assignees: (routine) =>
      routine.assigneeIds
        .map((id) => contributorName.get(id) ?? '')
        .filter(Boolean)
        .join(', '),
    categories: (routine) =>
      routine.categoryIds
        .map((id) => categoryName.get(id) ?? '')
        .filter(Boolean)
        .join(', '),
    requires: (routine) =>
      routine.requiredIds
        .map((id) => env.byId.get(id)?.title ?? '')
        .filter(Boolean)
        .join(', '),
    project: (routine) => (routine.projectId ? env.context.projectLabel(routine.projectId) : ''),
  };
}
