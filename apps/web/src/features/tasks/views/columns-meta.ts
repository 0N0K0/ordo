import type { TaskColumn, TaskGroupBy } from '@ordo/shared';

export const COLUMN_LABELS: Record<TaskColumn, string> = {
  number: 'Numéro',
  title: 'Titre',
  project: 'Projet',
  status: 'Statut',
  priority: 'Priorité',
  type: 'Type',
  assignees: 'Assignés',
  effort: 'Effort',
  startDate: 'Début',
  endDate: 'Fin',
  parent: 'Tâche parente',
  blockedBy: 'Bloquée par',
  blocking: 'Bloque',
  related: 'Relative à',
  comments: 'Commentaires',
  createdAt: 'Créée le',
  updatedAt: 'Modifiée le',
};

/** Columns that cannot be hidden. */
export const LOCKED_COLUMNS: readonly TaskColumn[] = ['title'];

export const GROUP_BY_LABELS: Record<TaskGroupBy, string> = {
  project: 'Projet',
  status: 'Statut',
  priority: 'Priorité',
  type: 'Type',
  assignees: 'Assigné',
  parent: 'Tâche parente',
};

/** Default width of each column, in px. */
export const COLUMN_SIZES: Record<TaskColumn, number> = {
  number: 72,
  title: 360,
  project: 200,
  status: 140,
  priority: 120,
  type: 120,
  assignees: 120,
  effort: 90,
  startDate: 130,
  endDate: 130,
  parent: 220,
  blockedBy: 160,
  blocking: 160,
  related: 160,
  comments: 110,
  createdAt: 150,
  updatedAt: 150,
};
