import { formatDuration, TASK_COLUMNS, type TaskColumn, type TaskViewConfig } from '@ordo/shared';
import type { EventOccurrence } from '../../calendar/api';
import type { Task } from '../api';
import type { TaskContext } from '../use-task-context';
import { COLUMN_LABELS } from './columns-meta';
import { eventWhen } from './event-format';
import type { DisplayRow } from './task-rows';

export interface ExportRow {
  kind: 'group' | 'task' | 'event';
  /** Sub-task level. */
  depth: number;
  /** Group the row belongs to (empty without grouping). */
  group: string;
  /** Formatted cells, in column order (a group row only has its label). */
  cells: string[];
}

export interface ExportTable {
  title: string;
  subtitle: string;
  columns: { id: TaskColumn; label: string }[];
  rows: ExportRow[];
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const instantFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/**
 * Calendar date (YYYY-MM-DD) as dd/mm/yyyy.
 * @param {string | null} day Date.
 * @returns {string} Text.
 */
const printedDay = (day: string | null) => (day ? dayFormat.format(new Date(`${day}T00:00:00Z`)) : '');

/**
 * Text of a task cell.
 * @param {Task} task Task.
 * @param {TaskColumn} column Column.
 * @param {TaskContext} context Task context.
 * @returns {string} Text.
 */
function taskCell(task: Task, column: TaskColumn, context: TaskContext): string {
  // Linked tasks: "#12" in the project of the task, with their project otherwise (numbers are per project).
  const numbers = (ids: string[]) =>
    ids
      .map((id) => context.taskById.get(id))
      .filter((other) => other !== undefined)
      .map((other) => (other.projectId === task.projectId ? `#${other.number}` : `${context.projectLabel(other.projectId)} #${other.number}`))
      .join(', ');
  switch (column) {
    case 'title':
      return `#${task.number} ${task.title}`;
    case 'project':
      return context.projectLabel(task.projectId);
    case 'status':
      return (task.statusId && context.statusById.get(task.statusId)?.name) || '';
    case 'priority':
      return (task.priorityId && context.priorityById.get(task.priorityId)?.name) || '';
    case 'type':
      return (task.typeId && context.typeById.get(task.typeId)?.name) || '';
    case 'assignees':
      return task.assigneeIds
        .map((id) => context.contributorById.get(id))
        .filter((contributor) => contributor !== undefined)
        .map((contributor) => contributor.name)
        .join(', ');
    case 'tags':
      return task.tagIds
        .map((id) => context.tagById.get(id)?.name)
        .filter(Boolean)
        .join(', ');
    case 'effort':
      return task.effort === null ? '' : numberFormat.format(task.effort);
    case 'trackedTime':
      return task.trackedSeconds > 0 ? formatDuration(task.trackedSeconds) : '';
    case 'startDate':
      return printedDay(task.startDate);
    case 'endDate':
      return printedDay(task.endDate);
    case 'deadline':
      return printedDay(task.deadline);
    case 'parent': {
      const parent = task.parentId ? context.taskById.get(task.parentId) : undefined;
      return parent ? context.taskLabel(parent, task.projectId) : '';
    }
    case 'milestone':
      return (task.milestoneId && context.milestoneById.get(task.milestoneId)?.title) || '';
    case 'sprint':
      return task.sprintIds
        .map((id) => context.sprintById.get(id)?.name)
        .filter(Boolean)
        .join(', ');
    case 'blockedBy':
      return numbers(task.blockedByIds);
    case 'blocking':
      return numbers(task.blockingIds);
    case 'related':
      return numbers(task.relatedIds);
    case 'comments':
      return task.commentCount ? String(task.commentCount) : '';
    case 'createdAt':
      return instantFormat.format(new Date(task.createdAt));
    case 'updatedAt':
      return instantFormat.format(new Date(task.updatedAt));
  }
}

/**
 * Text of an event cell (title, project, people, dates; empty elsewhere).
 * @param {EventOccurrence} event Occurrence.
 * @param {TaskColumn} column Column.
 * @param {TaskContext} context Task context.
 * @returns {string} Text.
 */
function eventCell(event: EventOccurrence, column: TaskColumn, context: TaskContext): string {
  switch (column) {
    case 'title':
      return event.location ? `${event.title} (${event.location})` : event.title;
    case 'project':
      return event.projectId ? context.projectLabel(event.projectId) : '';
    case 'assignees':
      return event.contributorIds
        .map((id) => context.contributorById.get(id)?.name)
        .filter(Boolean)
        .join(', ');
    case 'startDate':
      return eventWhen(event, 'start', true);
    case 'endDate':
      return eventWhen(event, 'end', true);
    default:
      return '';
  }
}

/**
 * Table of a view as exported: its visible columns in order (the title first), and every row of the view,
 * collapsed sub-tasks and groups included.
 * @param {object} options Options.
 * @param {DisplayRow[]} options.rows Rows of the view.
 * @param {TaskViewConfig} options.config View configuration.
 * @param {TaskContext} options.context Task context.
 * @param {string} options.title Title (scope and view).
 * @param {string} options.subtitle Subtitle (what is listed, when).
 * @returns {ExportTable} Table.
 */
export function exportTable({ rows, config, context, title, subtitle }: { rows: DisplayRow[]; config: TaskViewConfig; context: TaskContext; title: string; subtitle: string }): ExportTable {
  const order = [...config.columnOrder, ...TASK_COLUMNS.filter((id) => !config.columnOrder.includes(id))];
  // The title first: it carries the kind of row and the sub-task level.
  const columns = ['title' as const, ...order.filter((id) => id !== 'title')]
    .filter((id) => !config.hiddenColumns.includes(id))
    .map((id) => ({ id, label: COLUMN_LABELS[id] }));
  const result: ExportRow[] = [];
  const walk = (items: DisplayRow[], depth: number, group: string) => {
    for (const item of items) {
      if (item.kind === 'group') {
        result.push({ kind: 'group', depth: 0, group: item.label, cells: [item.label] });
        walk(item.children, 0, item.label);
      } else if (item.kind === 'event') {
        result.push({ kind: 'event', depth, group, cells: columns.map((column) => eventCell(item.event, column.id, context)) });
      } else {
        result.push({ kind: 'task', depth, group, cells: columns.map((column) => taskCell(item.task, column.id, context)) });
        walk(item.children, depth + 1, group);
      }
    }
  };
  walk(rows, 0, '');
  return { title, subtitle, columns, rows: result };
}

/**
 * Saves a file in the browser.
 * @param {Blob} blob Content.
 * @param {string} filename File name.
 * @returns {void}
 */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * File name of an export (characters forbidden in file names replaced).
 * @param {string} title Title.
 * @param {string} extension Extension.
 * @returns {string} File name.
 */
const fileName = (title: string, extension: string) => `${title.replace(/[\\/:*?"<>|]/g, '-')}.${extension}`;

/**
 * Downloads a table as CSV, for spreadsheets set in French: semicolons, UTF-8 with BOM, one line per task or
 * event with its kind, group and sub-task level.
 * @param {ExportTable} table Table.
 * @returns {void}
 */
export function downloadCsv(table: ExportTable): void {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const grouped = table.rows.some((row) => row.kind === 'group');
  const header = ['Nature', ...(grouped ? ['Groupe'] : []), 'Niveau', ...table.columns.map((column) => column.label)];
  const lines = table.rows
    .filter((row) => row.kind !== 'group')
    .map((row) => [row.kind === 'event' ? 'Évènement' : 'Tâche', ...(grouped ? [row.group] : []), String(row.depth), ...row.cells]);
  const csv = [header, ...lines].map((line) => line.map(quote).join(';')).join('\r\n');
  download(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), fileName(table.title, 'csv'));
}

/**
 * Downloads a table as PDF (built by the API).
 * @param {ExportTable} table Table.
 * @returns {Promise<void>}
 */
export async function downloadPdf(table: ExportTable): Promise<void> {
  const response = await fetch('/api/exports/table.pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: table.title,
      subtitle: table.subtitle,
      columns: table.columns.map((column) => column.label),
      rows: table.rows.map(({ kind, depth, cells }) => ({ kind, depth, cells })),
    }),
  });
  if (!response.ok) throw new Error('Le PDF n’a pas pu être créé.');
  download(await response.blob(), fileName(table.title, 'pdf'));
}
