import type { DataColumn } from '../../components/data-table/data-table';
import type { Routine } from './api';

/** Columns of the routine table (ids: the sort keys of the views, when sortable). */
export const ROUTINE_COLUMNS: DataColumn<Routine>[] = [
  { id: 'title', label: 'Label', size: 320, locked: true, sortValue: () => null },
  { id: 'currentDate', label: 'Échéance', size: 200, sortValue: () => null },
  { id: 'firstDate', label: 'Première échéance', size: 150, sortValue: () => null },
  { id: 'nextDate', label: 'Échéance suivante', size: 150, hiddenByDefault: true, sortValue: () => null },
  { id: 'repetition', label: 'Répétition', size: 200, hiddenByDefault: true, sortValue: () => null },
  { id: 'estimate', label: 'Temps estimé', size: 110, sortValue: () => null },
  { id: 'fromTime', label: 'À partir de', size: 110 },
  { id: 'dueTime', label: 'Avant', size: 110 },
  { id: 'opensOn', label: 'À partir du', size: 120, hiddenByDefault: true },
  { id: 'location', label: 'Lieu', size: 200, hiddenByDefault: true },
  { id: 'travelBefore', label: 'Trajet aller', size: 110, hiddenByDefault: true },
  { id: 'travelAfter', label: 'Trajet retour', size: 110, hiddenByDefault: true },
  { id: 'alarms', label: 'Alertes', size: 100, hiddenByDefault: true },
  { id: 'trackedTime', label: 'Chrono', size: 120, sortValue: () => null },
  { id: 'lastDoneAt', label: 'Faite pour la dernière fois', size: 170, hiddenByDefault: true, sortValue: () => null },
  { id: 'assignees', label: 'Assignés', size: 160, sortValue: () => null },
  { id: 'beneficiaries', label: 'Bénéficiaires', size: 160 },
  { id: 'categories', label: 'Catégories', size: 180, sortValue: () => null },
  { id: 'requires', label: 'Dépend de', size: 180 },
  { id: 'blocks', label: 'Bloque', size: 180, hiddenByDefault: true },
  { id: 'parent', label: 'Routine parente', size: 200, hiddenByDefault: true },
  { id: 'subRoutines', label: 'Sous-routines', size: 220, hiddenByDefault: true },
  { id: 'project', label: 'Projet', size: 180, sortValue: () => null },
  { id: 'comments', label: 'Commentaires', size: 120, hiddenByDefault: true },
];
