import {
  filterConditionSchema,
  FILTER_OPERATORS,
  TASK_FILTER_FIELDS,
  VALUELESS_OPERATORS,
  type FilterCondition,
  type FilterFieldKind,
  type FilterGroup,
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
  assignees: 'Assignés',
  startDate: 'Début',
  endDate: 'Fin',
  createdAt: 'Créée le',
  updatedAt: 'Modifiée le',
  overdue: 'En retard',
  blocked: 'Bloquée',
  hasSubtasks: 'A des sous-tâches',
  archived: 'Archivée',
};

/** Field order in the field picker, by theme. */
export const FIELD_GROUPS: { group: string; fields: TaskFilterField[] }[] = [
  { group: 'Texte', fields: ['title', 'description', 'number'] },
  { group: 'Organisation', fields: ['project', 'parent', 'status', 'statusCategory', 'priority', 'type', 'assignees', 'effort'] },
  { group: 'Dates', fields: ['startDate', 'endDate', 'createdAt', 'updatedAt'] },
  { group: 'État', fields: ['overdue', 'blocked', 'hasSubtasks', 'archived'] },
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
};

/**
 * Operators of a field.
 * @param {TaskFilterField} field Field.
 * @returns {readonly FilterOperator[]} Operators.
 */
export function operatorsOf(field: TaskFilterField): readonly FilterOperator[] {
  return FILTER_OPERATORS[TASK_FILTER_FIELDS[field]];
}

/**
 * Short random id for a filter node.
 * @returns {string} Id.
 */
export function nodeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Default value for an operator (none for valueless operators).
 * @param {TaskFilterField} field Field.
 * @param {FilterOperator} operator Operator.
 * @returns {FilterCondition['value']} Value.
 */
export function defaultValue(field: TaskFilterField, operator: FilterOperator): FilterCondition['value'] {
  if (VALUELESS_OPERATORS.includes(operator)) return null;
  switch (TASK_FILTER_FIELDS[field]) {
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
 * @param {TaskFilterField} [field='title'] Field. Optional. Default = 'title'.
 * @returns {FilterCondition} Condition.
 */
export function newCondition(field: TaskFilterField = 'title'): FilterCondition {
  const operator = operatorsOf(field)[0];
  return { type: 'condition', id: nodeId(), field, operator, value: defaultValue(field, operator) };
}

/**
 * Whether a condition is complete (it can be sent to the API).
 * @param {FilterCondition} condition Condition.
 * @returns {boolean} True when valid.
 */
export function isComplete(condition: FilterCondition): boolean {
  return filterConditionSchema.safeParse(condition).success;
}

/**
 * Removes incomplete conditions (and the groups left empty), so the API only receives a valid tree.
 * @param {FilterGroup} group Group.
 * @returns {FilterGroup} Pruned copy.
 */
export function pruneFilter(group: FilterGroup): FilterGroup {
  return {
    ...group,
    children: group.children.flatMap((child): FilterGroup['children'] => {
      if (child.type === 'condition') return isComplete(child) ? [child] : [];
      const pruned = pruneFilter(child);
      return pruned.children.length > 0 ? [pruned] : [];
    }),
  };
}

/**
 * Number of conditions in a tree.
 * @param {FilterGroup} group Group.
 * @returns {number} Count.
 */
export function countConditions(group: FilterGroup): number {
  return group.children.reduce((sum, child) => sum + (child.type === 'condition' ? 1 : countConditions(child)), 0);
}
