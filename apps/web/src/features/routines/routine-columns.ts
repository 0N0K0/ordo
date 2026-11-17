import { ROUTINE_REPETITIONS, ROUTINE_STATES, conditionScheduleIds, formatDuration, readSlotCondition, type RoutineCase } from '@ordo/shared';
import { categoryOptions, categoryTree } from '../../components/category-tree/category-tree';
import type { DataColumn } from '../../components/data-table/data-table';
import * as fmt from '../../lib/format';
import { commentTotal } from '../comments/comment-column';
import type { Routine } from './api';
import { isDone, stateOf, waitingFor } from './routine-format';
import { opensWords, REPETITION_LABELS, repetitionOf, ROUTINE_STATE_LABELS, type RoutineEnv } from './routine-view';

/**
 * Local day of an instant, YYYY-MM-DD.
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
const localDay = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

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
  const routineOptions = routines.map((routine) => ({ value: routine.id, label: routine.title }));
  const contributorName = new Map(context.contributors.map((contributor) => [contributor.id, contributor.isMe ? 'Moi' : contributor.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const categoryRank = new Map(categoryTree(categories).map((item, index) => [item.category.id, index]));
  const scheduleName = new Map((env.slotKinds ?? []).map((kind) => [kind.value, kind.label]));
  const beneficiaryName = new Map((env.beneficiaries ?? []).map((person) => [person.value, person.label]));
  const comments = env.comments ?? new Map<string, number>();
  const titles = (ids: string[]) => ids.map((id) => byId.get(id)?.title ?? '').filter(Boolean);
  const beneficiaryKeys = (routine: Routine) => [...routine.beneficiaryIds.map((id) => `c:${id}`), ...routine.beneficiaryRelationIds.map((id) => `r:${id}`)];
  const slotIds = (routine: Routine) => [
    ...conditionScheduleIds(readSlotCondition(routine.slotCondition)),
    ...((routine.cases as RoutineCase[] | null) ?? []).flatMap((item) => conditionScheduleIds(item.condition ?? null)),
  ];
  const blockers = (routine: Routine) => routines.filter((other) => other.requiredIds.includes(routine.id)).map((other) => other.id);
  const state = (routine: Routine) => stateOf(routine, env.today, env.doable(routine));
  const minutes = (value: number | null) => (value ? formatDuration(value * 60) : '');
  return [
    { id: 'title', label: 'Label', size: 320, locked: true, bulk: true, sortValue: (routine) => routine.title, text: (routine) => routine.title },
    {
      id: 'currentDate',
      label: 'Échéance',
      size: 200,
      bulk: true,
      sortValue: (routine) => (routine.currentDate ? String(routine.currentDate) : null),
      text: (routine) => dayText(routine.currentDate ? String(routine.currentDate) : null),
      filter: { kind: 'date', value: (routine) => (routine.currentDate ? String(routine.currentDate) : null) },
    },
    {
      id: 'state',
      label: 'État',
      size: 110,
      hiddenByDefault: true,
      sortValue: (routine) => ROUTINE_STATES.indexOf(state(routine)),
      text: (routine) => ROUTINE_STATE_LABELS[state(routine)],
      filter: { kind: 'choice', value: state, options: ROUTINE_STATES.map((value) => ({ value, label: ROUTINE_STATE_LABELS[value] })) },
    },
    {
      id: 'firstDate',
      label: 'Première échéance',
      size: 150,
      sortValue: (routine) => (routine.firstDate ? String(routine.firstDate) : null),
      text: (routine) => dayText(routine.firstDate ? String(routine.firstDate) : null),
      filter: { kind: 'date', value: (routine) => (routine.firstDate ? String(routine.firstDate) : null) },
    },
    {
      id: 'nextDate',
      label: 'Échéance suivante',
      size: 150,
      hiddenByDefault: true,
      sortValue: (routine) => (routine.nextDate ? String(routine.nextDate) : null),
      text: (routine) => dayText(routine.nextDate ? String(routine.nextDate) : null),
      filter: { kind: 'date', value: (routine) => (routine.nextDate ? String(routine.nextDate) : null) },
    },
    {
      id: 'startDate',
      label: 'Première fois',
      size: 130,
      hiddenByDefault: true,
      sortValue: (routine) => String(routine.startDate),
      text: (routine) => dayText(String(routine.startDate)),
      filter: { kind: 'date', value: (routine) => String(routine.startDate) },
    },
    {
      id: 'repetition',
      label: 'Répétition',
      size: 200,
      hiddenByDefault: true,
      bulk: true,
      sortValue: (routine) => ROUTINE_REPETITIONS.indexOf(repetitionOf(routine)),
      text: (routine) => REPETITION_LABELS[repetitionOf(routine)],
      filter: { kind: 'choice', value: repetitionOf, options: ROUTINE_REPETITIONS.map((value) => ({ value, label: REPETITION_LABELS[value] })) },
    },
    {
      id: 'estimate',
      label: 'Temps estimé',
      size: 110,
      numeric: true,
      bulk: true,
      sortValue: (routine) => routine.estimate ?? null,
      text: (routine) => minutes(routine.estimate ?? null),
      filter: { kind: 'number', value: (routine) => routine.estimate ?? null },
      formatTotal: (value) => minutes(Math.round(value)),
    },
    { id: 'fromTime', label: 'À partir de', size: 110, bulk: true, sortValue: (routine) => routine.fromTime ?? null, text: (routine) => routine.fromTime ?? '' },
    { id: 'dueTime', label: 'Avant', size: 110, bulk: true, sortValue: (routine) => routine.dueTime ?? null, text: (routine) => routine.dueTime ?? '' },
    { id: 'opensOn', label: 'À partir du', size: 120, hiddenByDefault: true, bulk: true, text: (routine) => opensWords(routine) ?? '' },
    { id: 'location', label: 'Lieu', size: 200, hiddenByDefault: true, bulk: true, sortValue: (routine) => routine.location ?? null, text: (routine) => routine.location ?? '' },
    {
      id: 'travelBefore',
      label: 'Trajet aller',
      size: 110,
      numeric: true,
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
      numeric: true,
      hiddenByDefault: true,
      bulk: true,
      sortValue: (routine) => routine.travelAfter || null,
      text: (routine) => minutes(routine.travelAfter),
      filter: { kind: 'number', value: (routine) => routine.travelAfter || null },
    },
    {
      id: 'alarms',
      label: 'Alertes',
      size: 100,
      hiddenByDefault: true,
      bulk: true,
      sortValue: (routine) => routine.reminders.length || null,
      text: (routine) => (routine.reminders.length ? String(routine.reminders.length) : ''),
      filter: { kind: 'boolean', value: (routine) => routine.reminders.length > 0 },
    },
    {
      id: 'slots',
      label: 'Plages',
      size: 180,
      hiddenByDefault: true,
      text: (routine) =>
        slotIds(routine)
          .map((id) => scheduleName.get(id) ?? '')
          .filter(Boolean)
          .join(', '),
      filter: { kind: 'choices', value: slotIds, options: env.slotKinds ?? [] },
    },
    {
      id: 'trackedTime',
      label: 'Chrono',
      size: 120,
      numeric: true,
      sortValue: (routine) => routine.trackedSeconds || null,
      text: (routine) => (routine.trackedSeconds ? formatDuration(routine.trackedSeconds) : ''),
      formatTotal: (seconds) => formatDuration(Math.round(seconds)),
    },
    {
      id: 'lastDoneAt',
      label: 'Faite pour la dernière fois',
      size: 170,
      hiddenByDefault: true,
      sortValue: (routine) => (routine.lastDoneAt ? String(routine.lastDoneAt) : null),
      text: (routine) => (routine.lastDoneAt ? fmt.dateTime(new Date(String(routine.lastDoneAt))) : ''),
      filter: { kind: 'date', value: (routine) => (routine.lastDoneAt ? localDay(String(routine.lastDoneAt)) : null) },
    },
    {
      id: 'assignees',
      label: 'Assignés',
      size: 160,
      bulk: true,
      sortValue: (routine) => routine.assigneeIds.map((id) => contributorName.get(id) ?? '').sort()[0] ?? null,
      text: (routine) => routine.assigneeIds.map((id) => contributorName.get(id) ?? '').join(', '),
      filter: { kind: 'choices', value: (routine) => routine.assigneeIds, options: [...contributorName].map(([value, label]) => ({ value, label })) },
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
      sortValue: (routine) => (routine.categoryIds.length ? Math.min(...routine.categoryIds.map((id) => categoryRank.get(id) ?? Infinity)) : null),
      text: (routine) => routine.categoryIds.map((id) => categoryName.get(id) ?? '').join(', '),
      filter: { kind: 'choices', value: (routine) => routine.categoryIds, options: categoryOptions(categories).map((option) => ({ value: option.value, label: option.label })) },
      groupTree: categories.map((category) => ({ key: category.id, label: category.name, color: category.color, parentKey: category.parentId })),
    },
    {
      id: 'requires',
      label: 'Dépend de',
      size: 180,
      bulk: true,
      text: (routine) => titles(routine.requiredIds).join(', '),
      filter: { kind: 'choices', value: (routine) => routine.requiredIds, options: routineOptions },
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
      text: (routine) => (routine.parentId ? (byId.get(routine.parentId)?.title ?? '') : ''),
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
      filter: { kind: 'choice', value: (routine) => routine.projectId ?? null, options: context.projects.map((project) => ({ value: project.id, label: context.projectLabel(project.id) })) },
    },
    { id: 'description', label: 'Description', size: 240, hiddenByDefault: true, groupable: false, text: (routine) => routine.description ?? '' },
    { id: 'done', label: 'Faite', size: 90, hiddenByDefault: true, text: (routine) => (isDone(routine) ? 'Oui' : ''), filter: { kind: 'boolean', value: (routine) => routine.done } },
    {
      id: 'waiting',
      label: 'En attente',
      size: 100,
      hiddenByDefault: true,
      text: (routine) => (waitingFor(routine, byId).length ? 'Oui' : ''),
      filter: { kind: 'boolean', value: (routine) => waitingFor(routine, byId).length > 0 },
    },
    { id: 'doableNow', label: 'Faisable maintenant', size: 140, hiddenByDefault: true, text: (routine) => (env.doable(routine) ? 'Oui' : ''), filter: { kind: 'boolean', value: env.doable } },
    { id: 'archived', label: 'Archivée', size: 100, hiddenByDefault: true, text: (routine) => (routine.archived ? 'Oui' : ''), filter: { kind: 'boolean', value: (routine) => routine.archived } },
    {
      id: 'comments',
      label: 'Commentaires',
      size: 120,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (routine) => commentTotal(comments, routine.id, routine.description) || null,
      text: (routine) => String(commentTotal(comments, routine.id, routine.description) || ''),
      filter: { kind: 'number', value: (routine) => commentTotal(comments, routine.id, routine.description) },
    },
  ];
}
