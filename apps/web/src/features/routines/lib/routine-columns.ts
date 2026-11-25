import { beneficiaryKeys } from '../../beneficiaries/hooks/use-beneficiaries';
import { ROUTINE_REPETITIONS, conditionReferences, formatDuration, occurrenceKey, readSlotCondition, type RoutineCase } from '@ordo/shared';
import { categoryOptions, categoryPaths, categoryTree } from '../../../components/tree/category-tree';
import { BADGE_COLUMN, DURATION_COLUMN, multiValues, TIME_COLUMN, WARNING_YES_ICONS, withArchived, type DataColumn, DONE_STATES } from '../../../components/data-table/table/data-table';
import * as fmt from '../../../lib/format';
import { commentColumn } from '../../comments/lib/comment-column';
import type { Routine } from '../api';
import { isDone, panelOccurrence, routineTreeOptions, currentRoutineState, waitingFor, blockedRoutineIds } from './routine-format';
import { opensWords, REPETITION_LABELS, routineFrequency, ROUTINE_STATE_BADGES, type RoutineEnv } from './routine-view';
import { parisDay } from '../../../lib/dates';
import { LAST_RANK } from '../../../components/data-table/table/table-engine';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';
import { stateColumn } from '../../../components/data-table/table/state-column';
import { DOABLE_GROUP_LABELS } from '../../tasks/lib/task-columns';
import { itemChoices } from '../../../components/items/item-look';
import type { TaskLabel } from '../../tasks/api';
import { documentsColumn } from '../../documents/lib/documents-column';


/** States of « Faite » of a routine (or of one of its times of the day), on its state buttons: those of every activity. */
export const ROUTINE_DONE_STATES = DONE_STATES;
/**
 * Short date of a calendar date: "lun. 10 nov.".
 * @param {string | null} date YYYY-MM-DD.
 * @returns {string} Text.
 */
const dayText = (date: string | null) => (date ? fmt.weekday(date) : '');

/**
 * Columns of the routine table, as on every table: shown, sorted, filtered (as the former views of the routines),
 * grouped (the categories as their tree), exported; the bulk ones edited together on a selection of cells.
 * @param {RoutineEnv} env Routines, categories, tasks, slots, comments and people.
 * @returns {DataColumn<Routine>[]} Columns.
 */
export function routineColumns(env: RoutineEnv): DataColumn<Routine>[] {
  const { context, byId, categories } = env;
  const routines = [...byId.values()];
  // Archived values keep their labels, the filters offer them only while in them.
  const routineOptions = withArchived(routineTreeOptions(routines), routines);
  const contributorName = new Map(context.contributors.map((contributor) => [contributor.id, context.contributorName(contributor)]));
  const categoryLabel = categoryPaths(categories);
  const categoryRank = new Map(categoryTree(categories).map((item, index) => [item.category.id, index]));
  const scheduleLabel = new Map((env.slotKinds ?? []).map((kind) => [kind.value, kind.label]));
  const beneficiaryName = new Map((env.beneficiaries ?? []).map((person) => [person.value, person.label]));
  const comments = env.comments ?? new Map<string, number>();
  const titles = (ids: string[]) => ids.map((id) => byId.get(id)?.label ?? '').filter(Boolean);
  const slotIds = (routine: Routine) => [
    ...conditionReferences(readSlotCondition(routine.slotCondition)),
    ...((routine.cases as RoutineCase[] | null) ?? []).flatMap((item) => conditionReferences(item.condition ?? null)),
  ];
  const slotNames = (routine: Routine) =>
    slotIds(routine)
      .map((id) => scheduleLabel.get(id) ?? '')
      .filter(Boolean);
  const blockers = (routine: Routine) => blockedRoutineIds(routines, routine.id);
  const state = (routine: Routine) => currentRoutineState(routine, env.today, env.doable(routine));
  const minutes = (value: number | null) => (value ? formatDuration(value * 60) : '');
  /**
   * Column of a list of the tasks a routine takes one item of (its priority, its type), sorted in the order of the list.
   * @param {'priority' | 'type'} id Column.
   * @param {string} label Name.
   * @param {(routine: Routine) => string | null} value Item of a routine.
   * @param {TaskLabel[]} items Items of the list, in their order.
   * @returns {DataColumn<Routine>} Column.
   */
  const labelColumn = (id: 'priority' | 'type', label: string, value: (routine: Routine) => string | null, items: TaskLabel[]): DataColumn<Routine> => {
    const byLabel = new Map(items.map((item) => [item.id, item]));
    return {
      id,
      label,
      size: 120,
      ...BADGE_COLUMN,
      bulk: true,
      sortValue: (routine) => byLabel.get(value(routine) ?? '')?.position ?? null,
      text: (routine) => byLabel.get(value(routine) ?? '')?.label ?? '',
      filter: { kind: 'choice', value, options: itemChoices(items) },
    };
  };
  return [
    { id: 'label', label: 'Libellé', size: 320, locked: true, required: true, bulk: true, sortValue: (routine) => routine.label, text: (routine) => routine.label },
    {
      id: 'currentDate',
      label: 'Échéance',
      size: 200,
      bulk: true,
      sortValue: (routine) => routine.currentDueDate || null,
      text: (routine) => dayText(routine.currentDueDate || null),
      filter: { kind: 'date', value: (routine) => routine.currentDueDate || null },
    },
    stateColumn({ id: 'state', label: 'État', size: 110, required: true, hiddenByDefault: true, states: ROUTINE_STATE_BADGES, value: state }),
    {
      id: 'firstDate',
      label: 'Première échéance',
      size: 150,
      sortValue: (routine) => routine.firstDate || null,
      text: (routine) => dayText(routine.firstDate || null),
      filter: { kind: 'date', value: (routine) => routine.firstDate || null },
    },
    {
      id: 'nextDate',
      label: 'Échéance suivante',
      size: 150,
      hiddenByDefault: true,
      sortValue: (routine) => routine.nextDueDate || null,
      text: (routine) => dayText(routine.nextDueDate || null),
      filter: { kind: 'date', value: (routine) => routine.nextDueDate || null },
    },
    {
      id: 'startDate',
      label: 'Première fois',
      size: 130,
      required: true,
      hiddenByDefault: true,
      sortValue: (routine) => routine.startDate,
      text: (routine) => dayText(routine.startDate),
      filter: { kind: 'date', value: (routine) => routine.startDate },
    },
    {
      id: 'repetition',
      label: 'Répétition',
      size: 200,
      required: true,
      hiddenByDefault: true,
      bulk: true,
      sortValue: (routine) => ROUTINE_REPETITIONS.indexOf(routineFrequency(routine)),
      text: (routine) => REPETITION_LABELS[routineFrequency(routine)],
      filter: { kind: 'choice', value: routineFrequency, options: ROUTINE_REPETITIONS.map((value) => ({ value, label: REPETITION_LABELS[value] })) },
    },
    {
      id: 'estimate',
      label: 'Temps estimé',
      size: 110,
      ...DURATION_COLUMN,
      bulk: true,
      sortValue: (routine) => routine.estimate ?? null,
      text: (routine) => minutes(routine.estimate ?? null),
      filter: { kind: 'number', value: (routine) => routine.estimate ?? null },
      formatTotal: (value) => minutes(Math.round(value)),
    },
    { id: 'fromTime', label: 'À partir de', size: 110, ...TIME_COLUMN, bulk: true, sortValue: (routine) => routine.fromTime ?? null, text: (routine) => routine.fromTime ?? '' },
    { id: 'dueTime', label: 'Avant', size: 110, ...TIME_COLUMN, bulk: true, sortValue: (routine) => routine.dueTime ?? null, text: (routine) => routine.dueTime ?? '' },
    { id: 'opensOn', label: 'Ouverture', size: 120, hiddenByDefault: true, bulk: true, text: (routine) => opensWords(routine) ?? '' },
    { id: 'location', label: 'Lieu', size: 200, hiddenByDefault: true, bulk: true, sortValue: (routine) => routine.location ?? null, text: (routine) => routine.location ?? '' },
    {
      id: 'travelBefore',
      label: 'Trajet aller',
      size: 110,
      ...DURATION_COLUMN,
      hiddenByDefault: true,
      bulk: true,
      sortValue: (routine) => routine.travelBefore || null,
      text: (routine) => minutes(routine.travelBefore),
      filter: { kind: 'number', value: (routine) => routine.travelBefore || null },
    },
    {
      id: 'travelAfter',
      label: 'Trajet retour',
      size: 110,
      ...DURATION_COLUMN,
      hiddenByDefault: true,
      bulk: true,
      sortValue: (routine) => routine.travelAfter || null,
      text: (routine) => minutes(routine.travelAfter),
      filter: { kind: 'number', value: (routine) => routine.travelAfter || null },
    },
    {
      id: 'alarms',
      label: 'Rappels',
      size: 100,
      ...BADGE_COLUMN,
      hiddenByDefault: true,
      bulk: true,
      sortValue: (routine) => routine.reminders.length || null,
      text: (routine) => fmt.count(routine.reminders.length),
      filter: { kind: 'boolean', value: (routine) => routine.reminders.length > 0 },
    },
    {
      id: 'slots',
      label: 'Créneaux',
      size: 180,
      hiddenByDefault: true,
      ...multiValues(slotNames),
      filter: { kind: 'choices', value: slotIds, options: env.slotKinds ?? [] },
    },
    {
      id: 'trackedTime',
      // Time spent, as for the tasks (« Chrono » is their timer); never empty.
      label: 'Temps passé',
      size: 120,
      ...DURATION_COLUMN,
      required: true,
      sortValue: (routine) => routine.trackedSeconds,
      text: (routine) => (routine.trackedSeconds ? formatDuration(routine.trackedSeconds) : ''),
      filter: { kind: 'number', value: (routine) => routine.trackedSeconds / 3600 },
      formatTotal: (seconds) => formatDuration(Math.round(seconds)),
    },
    {
      id: 'lastDoneAt',
      label: 'Faite pour la dernière fois',
      size: 170,
      hiddenByDefault: true,
      sortValue: (routine) => routine.lastDoneAt || null,
      text: (routine) => (routine.lastDoneAt ? fmt.dateTime(routine.lastDoneAt) : ''),
      filter: { kind: 'date', value: (routine) => (routine.lastDoneAt ? parisDay(routine.lastDoneAt) : null) },
    },
    {
      id: 'assignees',
      label: 'Assignés',
      size: 160,
      bulk: true,
      sortValue: (routine) => routine.assigneeIds.map((id) => contributorName.get(id) ?? '').sort()[0] ?? null,
      text: (routine) => routine.assigneeIds.map((id) => contributorName.get(id) ?? '').join(', '),
      filter: {
        kind: 'choices',
        value: (routine) => routine.assigneeIds,
        options: withArchived(
          [...contributorName].map(([value, label]) => ({ value, label })),
          context.contributors,
        ),
      },
    },
    {
      id: 'beneficiaries',
      label: 'Bénéficiaires',
      size: 160,
      bulk: true,
      text: (routine) =>
        beneficiaryKeys(routine)
          .map((key) => beneficiaryName.get(key) ?? '')
          .filter(Boolean)
          .join(', '),
      filter: { kind: 'choices', value: beneficiaryKeys, options: env.beneficiaries ?? [] },
    },
    {
      id: 'categories',
      label: 'Catégories',
      size: 180,
      bulk: true,
      sortValue: (routine) => (routine.categoryIds.length ? Math.min(...routine.categoryIds.map((id) => categoryRank.get(id) ?? LAST_RANK)) : null),
      text: (routine) => routine.categoryIds.map((id) => categoryLabel.get(id) ?? '').join(', '),
      filter: { kind: 'choices', value: (routine) => routine.categoryIds, options: withArchived(categoryOptions(categories), categories) },
      groupTree: categories.map((category) => ({ key: category.id, label: category.label, color: category.color, parentKey: category.parentId })),
    },
    // The lists of the tasks, shown as theirs.
    labelColumn('priority', 'Priorité', (routine) => routine.priorityId ?? null, context.priorities),
    labelColumn('type', 'Type', (routine) => routine.typeId ?? null, context.types),
    {
      id: 'requires',
      label: 'Dépend de',
      size: 180,
      bulk: true,
      text: (routine) => titles(routine.requiredIds).join(', '),
      filter: { kind: 'choices', value: (routine) => routine.requiredIds, options: routineOptions },
    },
    {
      id: 'related',
      label: 'Relative à',
      size: 180,
      hiddenByDefault: true,
      bulk: true,
      text: (routine) => titles(routine.relatedIds).join(', '),
      filter: { kind: 'choices', value: (routine) => routine.relatedIds, options: routineOptions },
    },
    {
      id: 'blocks',
      label: 'Bloque',
      size: 180,
      hiddenByDefault: true,
      bulk: true,
      text: (routine) => titles(blockers(routine)).join(', '),
      filter: { kind: 'choices', value: blockers, options: routineOptions },
    },
    {
      id: 'parent',
      label: 'Routine parente',
      size: 200,
      hiddenByDefault: true,
      bulk: true,
      text: (routine) => (routine.parentId ? (byId.get(routine.parentId)?.label ?? '') : ''),
      filter: { kind: 'choice', value: (routine) => routine.parentId ?? null, options: routineOptions },
    },
    {
      id: 'subRoutines',
      label: 'Sous-routines',
      size: 220,
      hiddenByDefault: true,
      groupable: false,
      text: (routine) => titles(routines.filter((other) => other.parentId === routine.id).map((other) => other.id)).join(', '),
    },
    {
      id: 'project',
      label: 'Projet',
      size: 180,
      bulk: true,
      sortValue: (routine) => (routine.projectId ? context.projectLabel(routine.projectId) : null),
      text: (routine) => (routine.projectId ? context.projectLabel(routine.projectId) : ''),
      filter: { kind: 'choice', value: (routine) => routine.projectId ?? null, options: context.projectOptions(context.projects) },
    },
    { id: 'description', label: 'Description', size: 240, hiddenByDefault: true, groupable: false, text: (routine) => routine.description ?? '' },
    documentsColumn<Routine>((routine) => routine),
    booleanColumn<Routine>({ id: 'done', label: 'Faite', size: 90, hiddenByDefault: true, states: ROUTINE_DONE_STATES, groupLabels: { yes: 'Faites', no: 'À faire' }, value: isDone }),
    booleanColumn<Routine>({ id: 'waiting', label: 'En attente', size: 100, hiddenByDefault: true, groupLabels: { yes: 'En attente', no: 'Libre' }, icons: WARNING_YES_ICONS, value: (routine) => waitingFor(routine, byId).length > 0 }),
    booleanColumn<Routine>({ id: 'doableNow', label: 'Faisable maintenant', size: 140, hiddenByDefault: true, groupLabels: DOABLE_GROUP_LABELS, value: env.doable }),
    commentColumn<Routine>(
      comments,
      // The comments of the occurrence its panel opens on.
      (routine) => occurrenceKey(routine.id, panelOccurrence(routine)),
      (routine) => routine.description,
    ),
  ];
}
