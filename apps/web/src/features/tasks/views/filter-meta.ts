import {
  filterConditionSchema,
  FILTER_OPERATORS,
  TASK_FILTER_FIELDS,
  VALUELESS_OPERATORS,
  type FilterCondition,
  type FilterConditionOf,
  type FilterFieldKind,
  type FilterGroupOf,
  type FilterOperator,
  type TaskFilterField,
} from '@ordo/shared';

export const FIELD_LABELS: Record<TaskFilterField, string> = {
  title: 'Titre',
  description: 'Description',
  number: 'Numéro',
  effort: 'Effort',
  project: 'Projet',
  status: 'Statut',
  statusCategory: 'Catégorie de statut',
  priority: 'Priorité',
  type: 'Type',
  parent: 'Tâche parente',
  milestone: 'Jalon',
  sprint: 'Sprint',
  assignees: 'Assignés',
  tags: 'Étiquettes',
  startDate: 'Début',
  endDate: 'Fin',
  deadline: 'Date max',
  createdAt: 'Créée le',
  updatedAt: 'Modifiée le',
  overdue: 'En retard',
  blocked: 'Bloquée',
  hasSubtasks: 'A des sous-tâches',
  doableNow: 'Faisable maintenant',
  closed: 'Fermée',
  archived: 'Archivée',
};

/** Field order in the field picker, by theme. */
export const FIELD_GROUPS: { group: string; fields: TaskFilterField[] }[] = [
  { group: 'Texte', fields: ['title', 'description', 'number'] },
  {
    group: 'Organisation',
    fields: ['project', 'parent', 'milestone', 'sprint', 'status', 'statusCategory', 'priority', 'type', 'assignees', 'tags', 'effort'],
  },
  { group: 'Dates', fields: ['startDate', 'endDate', 'deadline', 'createdAt', 'updatedAt'] },
  { group: 'État', fields: ['closed', 'overdue', 'blocked', 'hasSubtasks', 'doableNow', 'archived'] },
];

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
 * Operators of a task field.
 * @param {TaskFilterField} field Field.
 * @returns {readonly FilterOperator[]} Operators.
 */
export function operatorsOf(field: TaskFilterField): readonly FilterOperator[] {
  return operatorsFor(TASK_FILTER_FIELDS, field);
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
 * @returns {FilterCondition['value']} Value.
 */
export function defaultValueFor(kind: FilterFieldKind, operator: FilterOperator): FilterCondition['value'] {
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
 * Starting value of a task condition for a field and an operator.
 * @param {TaskFilterField} field Field.
 * @param {FilterOperator} operator Operator.
 * @returns {FilterCondition['value']} Value.
 */
export function defaultValue(field: TaskFilterField, operator: FilterOperator): FilterCondition['value'] {
  return defaultValueFor(TASK_FILTER_FIELDS[field], operator);
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
 * New task condition on a field, with its first operator.
 * @param {TaskFilterField} [field='title'] Field. Optional. Default = 'title'.
 * @returns {FilterCondition} Condition.
 */
export function newCondition(field: TaskFilterField = 'title'): FilterCondition {
  return newConditionFor(TASK_FILTER_FIELDS, field);
}

/**
 * Whether a task condition is complete (valid), so it applies.
 * @param {FilterCondition} condition Condition.
 * @returns {boolean} True when valid.
 */
export function isComplete(condition: FilterCondition): boolean {
  return filterConditionSchema.safeParse(condition).success;
}

/**
 * Filter without its incomplete conditions nor its empty groups.
 * @param {FilterGroupOf<F>} group Group.
 * @param {(condition: FilterConditionOf<F>) => boolean} [complete] Whether a condition is complete. Optional. Default = a task one.
 * @returns {FilterGroupOf<F>} Pruned copy.
 */
export function pruneFilter<F extends string = TaskFilterField>(
  group: FilterGroupOf<F>,
  complete: (condition: FilterConditionOf<F>) => boolean = isComplete as unknown as (condition: FilterConditionOf<F>) => boolean,
): FilterGroupOf<F> {
  return {
    ...group,
    children: group.children.flatMap((child): FilterGroupOf<F>['children'] => {
      if (child.type === 'condition') return complete(child) ? [child] : [];
      const pruned = pruneFilter(child, complete);
      return pruned.children.length > 0 ? [pruned] : [];
    }),
  };
}

/**
 * Number of conditions of a filter, nested ones included.
 * @param {FilterGroupOf<F>} group Group.
 * @returns {number} Count.
 */
export function countConditions<F extends string>(group: FilterGroupOf<F>): number {
  return group.children.reduce((sum, child) => sum + (child.type === 'condition' ? 1 : countConditions(child)), 0);
}
