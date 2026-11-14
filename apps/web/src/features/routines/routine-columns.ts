import type { DataColumn } from '../../components/data-table/data-table';
import type { Routine } from './api';

/** Columns of the routine table (ids: the sort keys of the views, when sortable). */
export const ROUTINE_COLUMNS: DataColumn<Routine>[] = [
  { id: 'title', label: 'Routine', size: 320, locked: true, sortValue: () => null },
  { id: 'currentDate', label: 'Échéance', size: 200, sortValue: () => null },
  { id: 'firstDate', label: 'Première échéance', size: 150, sortValue: () => null },
  { id: 'nextDate', label: 'Échéance suivante', size: 150, hiddenByDefault: true, sortValue: () => null },
  { id: 'repetition', label: 'Répétition', size: 200, hiddenByDefault: true, sortValue: () => null },
  { id: 'estimate', label: 'Temps estimé', size: 110, sortValue: () => null },
  { id: 'time', label: 'Horaires', size: 150 },
  { id: 'trackedTime', label: 'Chrono', size: 120, sortValue: () => null },
  { id: 'lastDoneAt', label: 'Faite pour la dernière fois', size: 170, hiddenByDefault: true, sortValue: () => null },
  { id: 'assignees', label: 'Assignés', size: 160, sortValue: () => null },
  { id: 'beneficiaries', label: 'Bénéficiaires', size: 160 },
  { id: 'categories', label: 'Catégories', size: 180, sortValue: () => null },
  { id: 'requires', label: 'Dépend de', size: 180 },
  { id: 'project', label: 'Projet', size: 180, sortValue: () => null },
  { id: 'comments', label: 'Commentaires', size: 120, hiddenByDefault: true },
];
