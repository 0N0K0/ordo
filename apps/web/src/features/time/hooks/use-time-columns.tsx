import { entrySeconds, formatDuration, lineageOf, round2 } from '@ordo/shared';
import { DURATION_COLUMN, TIME_COLUMN, type DataColumn } from '../../../components/data-table/table/data-table';
import { monthColumn } from '../../../components/data-table/table/month-column';
import type { TreeOption } from '../../../components/tree/tree-select';
import { localDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { collator } from '../../../lib/text';
import { DRAFT_NAME } from '../../accounting/lib/labels';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useRoutinesData } from '../../routines/api';
import { routineTreeOptions } from '../../routines/lib/routine-format';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import type { TimeEntry } from '../api';
import { TIMER_RUNNING } from '../components/TimerStop';

/**
 * Events the times were spent on, as filter options.
 * @param {readonly TimeEntry[]} entries Times.
 * @returns {{ value: string, label: string }[]} Options.
 */
function events(entries: readonly TimeEntry[]): { value: string; label: string }[] {
  const byId = new Map<string, string>();
  for (const entry of entries) for (const link of entry.events) byId.set(link.eventId, link.label);
  return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => collator.compare(a.label, b.label));
}

/**
 * Labels of the routines or events of a time, one after the other.
 * @param {readonly { label: string }[]} items Routines or events.
 * @returns {string} Text.
 */
export const labelsText = (items: readonly { label: string }[]): string => items.map((item) => item.label).join(', ');

/**
 * Invoice of a billed time: its number, or « Brouillon » while the invoice is a draft.
 * @param {TimeEntry} entry Time (billed).
 * @returns {string} Text.
 */
export const billedText = (entry: TimeEntry): string => (entry.documentNumber ? `Facturé : ${entry.documentNumber}` : DRAFT_NAME);

/**
 * Columns of the tracked times.
 * @param {TaskContext | null} context Task context (names of the projects and tasks).
 * @param {Map<string, number>} comments Comments of the times.
 * @param {TreeOption[]} routines Routines offered by the filter, as their tree.
 * @param {readonly TimeEntry[]} entries Times (their events offered by the filter).
 * @returns {DataColumn<TimeEntry>[]} Columns.
 */
function timeColumns(context: TaskContext | null, comments: Map<string, number>, routines: TreeOption[], entries: readonly TimeEntry[]): DataColumn<TimeEntry>[] {
  const projectLabelOf = (entry: TimeEntry) => (entry.projectId ? (context?.projectLabel(entry.projectId) ?? '') : '');
  return [
    {
      id: 'day',
      required: true,
      bulk: true,
      label: 'Date',
      size: 200,
      locked: true,
      sortValue: (entry) => entry.startedAt,
      text: (entry) => fmt.capitalize(fmt.dayLong(entry.startedAt)),
      filter: { kind: 'date', value: (entry) => localDay(entry.startedAt) },
      groupable: true,
    },
    monthColumn('month', 'Mois', (entry) => entry.startedAt, 140),
    { id: 'start', bulk: true, label: 'Heure de début', size: 110, ...TIME_COLUMN, sortValue: (entry) => fmt.time(entry.startedAt), text: (entry) => fmt.time(entry.startedAt), filter: false },
    {
      id: 'end',
      label: 'Heure de fin',
      size: 110,
      ...TIME_COLUMN,
      sortValue: (entry) => (entry.endedAt ? fmt.time(entry.endedAt) : null),
      text: (entry) => (entry.endedAt ? fmt.time(entry.endedAt) : ''),
      filter: false,
    },
    {
      id: 'duration',
      required: true,
      bulk: true,
      label: 'Durée',
      size: 100,
      ...DURATION_COLUMN,
      sortValue: (entry) => entrySeconds(entry),
      formatTotal: (seconds) => formatDuration(Math.round(seconds)),
      text: (entry) => (entry.endedAt ? formatDuration(entrySeconds(entry)) : TIMER_RUNNING),
      filter: { kind: 'number', value: (entry) => round2(entrySeconds(entry) / 3600) },
    },
    {
      id: 'project',
      bulk: true,
      label: 'Projet',
      size: 180,
      sortValue: (entry) => projectLabelOf(entry) || null,
      text: projectLabelOf,
      // A project keeps the times of its sub-projects.
      filter: {
        kind: 'choices',
        value: (entry) => (context ? lineageOf(context.projectById, entry.projectId).map((project) => project.id) : []),
        options: context ? context.projectOptions(context.projects) : [],
      },
      groupable: true,
    },
    {
      id: 'routine',
      bulk: true,
      label: 'Routines',
      size: 180,
      sortValue: (entry) => labelsText(entry.routines) || null,
      text: (entry) => labelsText(entry.routines),
      filter: { kind: 'choices', value: (entry) => entry.routines.map((routine) => routine.id), options: routines },
      groupable: true,
    },
    {
      id: 'tasks',
      bulk: true,
      label: 'Tâches',
      size: 240,
      text: (entry) =>
        entry.taskIds
          .map((id) => context?.taskById.get(id))
          .filter((task) => task !== undefined)
          .map((task) => context?.taskLabel(task) ?? '')
          .join(', '),
      filter: { kind: 'choices', value: (entry) => entry.taskIds, options: context?.taskOptions(context.tasks) ?? [] },
    },
    {
      id: 'event',
      bulk: true,
      label: 'Évènements',
      size: 200,
      sortValue: (entry) => labelsText(entry.events) || null,
      text: (entry) => labelsText(entry.events),
      filter: { kind: 'choices', value: (entry) => entry.events.map((link) => link.eventId), options: events(entries) },
      groupable: true,
    },
    {
      id: 'invoice',
      required: true,
      label: 'Facture',
      size: 150,
      sortValue: (entry) => entry.documentNumber ?? null,
      text: (entry) => (entry.documentId ? billedText(entry) : 'Non facturé'),
      filter: {
        kind: 'choice',
        value: (entry) => (entry.documentId ? (entry.documentNumber ? 'billed' : 'draft') : 'unbilled'),
        options: [
          { value: 'unbilled', label: 'Non facturé' },
          { value: 'draft', label: 'Sur un brouillon' },
          { value: 'billed', label: 'Facturé' },
        ],
      },
      groupable: true,
    },
    commentColumn<TimeEntry>(
      comments,
      (entry) => entry.id,
      (entry) => entry.description,
    ),
  ];
}

/**
 * Columns of the table of the tracked times, with the routines offered by its filter and the comments of the times: in
 * the table, and in the settings (no time).
 * @param {readonly TimeEntry[] | undefined} entries Times (their events offered by the filter, their comments counted).
 * @param {TaskContext | null} context Task context (names of the projects and tasks).
 * @returns {DataColumn<TimeEntry>[]} Columns.
 */
export function useTimeColumns(entries: readonly TimeEntry[] | undefined, context: TaskContext | null): DataColumn<TimeEntry>[] {
  const { data: routinesData } = useRoutinesData();
  const routineOptions = routineTreeOptions(routinesData?.routines ?? []);
  const entryComments = useCommentCounts(
    'TIME_ENTRY',
    (entries ?? []).map((entry) => entry.id),
  );
  return timeColumns(context, entryComments, routineOptions, entries ?? []);
}
