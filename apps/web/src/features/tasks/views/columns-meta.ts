import type { TaskColumn, TaskFilterField, TaskGroupBy, TaskSortKey } from '@ordo/shared';

export const COLUMN_LABELS: Record<TaskColumn, string> = {
  title: 'Titre',
  project: 'Projet',
  status: 'Statut',
  priority: 'Priorité',
  type: 'Type',
  assignees: 'Assignés',
  effort: 'Effort',
  trackedTime: 'Temps passé',
  startDate: 'Début',
  endDate: 'Fin',
  parent: 'Tâche parente',
  milestone: 'Jalon',
  blockedBy: 'Dépend de',
  blocking: 'Bloque',
  related: 'Relative à',
  comments: 'Commentaires',
  createdAt: 'Créée le',
  updatedAt: 'Modifiée le',
};

/** Sort keys: the columns, plus the task number. */
export const SORT_LABELS: Record<TaskSortKey, string> = { ...COLUMN_LABELS, number: 'Numéro' };

/** Columns that cannot be hidden. */
export const LOCKED_COLUMNS: readonly TaskColumn[] = ['title'];

export const GROUP_BY_LABELS: Record<TaskGroupBy, string> = {
  state: 'État (ouvertes / fermées)',
  project: 'Projet',
  status: 'Statut',
  priority: 'Priorité',
  type: 'Type',
  assignees: 'Assigné',
  parent: 'Tâche parente',
  milestone: 'Jalon',
};

/** Default width of each column, in px. */
export const COLUMN_SIZES: Record<TaskColumn, number> = {
  title: 400,
  project: 200,
  status: 140,
  priority: 120,
  type: 120,
  assignees: 120,
  effort: 90,
  trackedTime: 120,
  startDate: 130,
  endDate: 130,
  parent: 220,
  milestone: 160,
  blockedBy: 160,
  blocking: 160,
  related: 160,
  comments: 110,
  createdAt: 150,
  updatedAt: 150,
};

/** Filter field opened by the "Filtrer" entry of a column menu. */
export const COLUMN_FILTER_FIELDS: Partial<Record<TaskColumn, TaskFilterField>> = {
  title: 'title',
  project: 'project',
  status: 'status',
  priority: 'priority',
  type: 'type',
  assignees: 'assignees',
  effort: 'effort',
  startDate: 'startDate',
  endDate: 'endDate',
  parent: 'parent',
  milestone: 'milestone',
  blockedBy: 'blocked',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/** Grouping offered by a column menu. */
export const COLUMN_GROUP_BY: Partial<Record<TaskColumn, TaskGroupBy>> = {
  project: 'project',
  status: 'status',
  priority: 'priority',
  type: 'type',
  assignees: 'assignees',
  parent: 'parent',
  milestone: 'milestone',
};

/** Columns whose cells can be selected and edited together. */
export const BULK_EDITABLE_COLUMNS: readonly TaskColumn[] = [
  'status',
  'priority',
  'type',
  'assignees',
  'effort',
  'startDate',
  'endDate',
  'milestone',
];
