import { parisMidnight, monthOfDay, yearOfDay } from '../../../lib/dates';
import { addDays, entrySecondsWithin, filterPeriod, isTaskOverdue } from '@ordo/shared';
import { useMemo } from 'react';
import type { AccountingDocumentSummary, ImportedDocument } from '../../accounting/api/documents';
import { useDoableTaskIds, useTaskWaitReasons, type Task, type TaskWaitReasons } from '../../tasks/api';
import { isArchivedTaskRow, matchTasks, taskTableRows, viewUses } from '../../tasks/lib/task-columns';
import { useDefaultTableView, useViewRows, type DefaultTableView } from '../../../components/data-table/views/use-default-view';
import { useTaskColumns } from '../../tasks/hooks/use-task-columns';
import { useTimeEntriesSince } from '../../time/api';
import { useNow } from '../../../lib/use-now';
import { myTasksFilter } from '../../tasks/lib/my-tasks';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import * as fmt from '../../../lib/format';
import { currentWeek } from '../../../lib/week';
import { useCalendarEvents, type EventOccurrence } from '../../calendar/api';
import type { ViewRows } from '../../../components/data-table/table/table-engine';

/**
 * A day relative to today: « Aujourd’hui », « Demain », « Hier » or « lun. 9 nov. ».
 * @param {string} date YYYY-MM-DD.
 * @param {string} today Today.
 * @returns {string} Label.
 */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Aujourd’hui';
  if (date === addDays(today, 1)) return 'Demain';
  if (date === addDays(today, -1)) return 'Hier';
  return fmt.weekday(date);
}

/**
 * Events of the home page (Agenda card, navigation badge) between two days: the cancelled ones hidden, and not counted
 *.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {EventOccurrence[] | undefined} Events held, undefined while loading.
 */
export function useHeldEvents(from: string, to: string): EventOccurrence[] | undefined {
  const { data } = useCalendarEvents({ from, to });
  return useMemo(() => data?.filter((event) => !event.calledOff), [data]);
}

/** Name of the balance of the projection 30 days from today (`balanceIn30Days`). */
// eslint-disable-next-line no-restricted-syntax -- the name itself.
export const IN_30_DAYS = 'Dans 30 jours';

/**
 * Point of the treasury projection 30 days from today (the last one by then), shown on the home page.
 * @param {readonly T[]} series Projected balances, by day, from today.
 * @param {string} today Today.
 * @returns {T | undefined} Point, none without a projection by then.
 */
export function balanceIn30Days<T extends { date: string }>(series: readonly T[], today: string): T | undefined {
  const in30 = addDays(today, 30);
  return [...series].reverse().find((point) => point.date <= in30);
}

export interface BillingSummary {
  /** Still due on the final invoices. */
  receivable: number;
  /** Of which past the due date. */
  overdue: number;
  overdueCount: number;
  /** Net revenue (credit notes deducted) of the month and of the year, imported documents included. */
  monthNet: number;
  yearNet: number;
  /** Quotes sent and waiting for an answer. */
  pendingQuotes: AccountingDocumentSummary[];
  pendingQuotesNet: number;
  drafts: number;
}

/**
 * Invoicing at a glance, from the Ordo documents; the revenue counts the imported invoices and credit notes too.
 * Archived documents are left out.
 * @param {AccountingDocumentSummary[]} documents Documents.
 * @param {string} today Today.
 * @param {ImportedDocument[]} [imported] Imported documents. Optional.
 * @returns {BillingSummary} Summary.
 */
export function billingSummary(documents: AccountingDocumentSummary[], today: string, imported: ImportedDocument[] = []): BillingSummary {
  const summary: BillingSummary = { receivable: 0, overdue: 0, overdueCount: 0, monthNet: 0, yearNet: 0, pendingQuotes: [], pendingQuotesNet: 0, drafts: 0 };
  // Archived documents are left out (hidden from the day-to-day views).
  for (const document of documents) {
    if (document.archived) continue;
    if (document.status === 'DRAFT') {
      summary.drafts += 1;
      continue;
    }
    if (document.type === 'QUOTE') {
      if (document.trackingStatus?.category === 'SENT') {
        summary.pendingQuotes.push(document);
        summary.pendingQuotesNet += document.totalNet;
      }
      continue;
    }
    const sign = document.type === 'CREDIT_NOTE' ? -1 : 1;
    if (yearOfDay(document.issueDate) === yearOfDay(today)) summary.yearNet += sign * document.totalNet;
    if (monthOfDay(document.issueDate) === monthOfDay(today)) summary.monthNet += sign * document.totalNet;
    if (sign > 0 && (document.balance ?? 0) > 0) {
      summary.receivable += document.balance ?? 0;
      if (document.overdue) {
        summary.overdue += document.balance ?? 0;
        summary.overdueCount += 1;
      }
    }
  }
  // Imported invoices and credit notes are revenue of their date too (quotes are not).
  for (const document of imported) {
    if (document.type === 'QUOTE' || document.archived) continue;
    const sign = document.type === 'CREDIT_NOTE' ? -1 : 1;
    const date = document.issueDate;
    if (yearOfDay(date) === yearOfDay(today)) summary.yearNet += sign * document.totalNet;
    if (monthOfDay(date) === monthOfDay(today)) summary.monthNet += sign * document.totalNet;
  }
  // Oldest sent first: those to follow up.
  summary.pendingQuotes.sort((a, b) => (a.sentAt ?? a.issueDate).localeCompare(b.sentAt ?? b.issueDate));
  return summary;
}

/**
 * My tasks of today (overdue, in progress, due, starting or running today), overdue first then by end date.
 * @param {TaskContext | null} context Task context.
 * @param {string} today Today.
 * @returns {{ tasks: Task[] | null, overdue: number }} Tasks (null while loading) and how many are overdue.
 */
export function useMyTodayTasks(context: TaskContext | null, today: string) {
  // Filtered here, in the words of the task table (its columns).
  const columns = useTaskColumns(context, today, { doable: false });
  return useMemo(() => {
    if (!context) return { tasks: null, overdue: 0 };
    const tasks = matchTasks(context.tasks, columns, { filter: myTasksFilter('today') }, today);
    const late = (task: Task) => isTaskOverdue(task, today);
    tasks.sort((a, b) => Number(late(b)) - Number(late(a)) || (a.effectiveDeadline ?? a.endDate ?? '9999').localeCompare(b.effectiveDeadline ?? b.endDate ?? '9999') || (a.number ?? 0) - (b.number ?? 0));
    return { tasks, overdue: tasks.filter(late).length };
  }, [context, columns, today]);
}

/** Section of a task on the home page: `now`, it can be done now; `later`, the others. */
export type HomeTaskSection = 'now' | 'later';

/** A task of the home page, in its section. */
export interface HomeTaskItem {
  key: string;
  section: HomeTaskSection;
  task: Task;
}

/** Tasks of the home page and what they are read from. */
export interface HomeTasks {
  /** Default view of the tasks page, null without any. */
  view: DefaultTableView['view'];
  /** The default view is still loading. */
  viewPending: boolean;
  /** Those that can be done now first, then the others, each in the order of the view. */
  items: HomeTaskItem[];
  /** How many can be done now. */
  nowCount: number;
  /** Why an open task cannot be done now, undefined while loading. */
  waitReasons: TaskWaitReasons | undefined;
  loading: boolean;
}

/**
 * Tasks of the home page (« Tâches » card, navigation badge): those of the default view of the tasks page (its filter,
 * search and sorts), archived ones left out; without any view yet, my tasks of today. Closed ones left out; those that
 * can be done now first, then the others.
 * @param {TaskContext | null} context Task context.
 * @param {Task[] | null} todayTasks My tasks of today (`useMyTodayTasks`), null while loading.
 * @param {string} today Today.
 * @returns {HomeTasks} Tasks.
 */
export function useHomeTasks(context: TaskContext | null, todayTasks: Task[] | null, today: string): HomeTasks {
  const { view, isPending } = useDefaultTableView('tasks');
  const columns = useTaskColumns(context, today, { doable: viewUses(view?.config, 'doableNow') });
  const doableIds = useDoableTaskIds(true);
  const waitReasons = useTaskWaitReasons(true);
  const rows = useMemo(() => taskTableRows(context?.tasks ?? []), [context]);
  const shown = useViewRows({ view, columns, rows, archived: isArchivedTaskRow });
  const items = useMemo(() => {
    // A closed task is neither doable now nor later: left out.
    const tasks = (view ? shown.rows.flatMap((row) => (row.kind === 'task' ? [row.task] : [])) : (todayTasks ?? [])).filter((task) => !context?.isClosed(task));
    const item = (task: Task): HomeTaskItem => ({ key: task.id, section: doableIds?.has(task.id) ? 'now' : 'later', task });
    const all = tasks.map(item);
    return [...all.filter((entry) => entry.section === 'now'), ...all.filter((entry) => entry.section === 'later')];
  }, [view, shown, todayTasks, doableIds, context]);
  const loading = isPending || !context || !doableIds || !waitReasons || (!view && !todayTasks);
  return { view, viewPending: isPending, items, nowCount: items.filter((entry) => entry.section === 'now').length, waitReasons, loading };
}

/** Time tracked this week. */
export interface WeekTime {
  /** Seconds of today and of the week. */
  today: number;
  week: number;
  /** Seconds per project, most first. */
  byProject: { projectId: string; seconds: number }[];
}

/**
 * Time tracked since Monday, every project (a running timer counts up to now).
 * @param {string} today Today.
 * @returns {WeekTime | null} Time, or null while loading.
 */
export function useWeekTime(today: string): WeekTime | null {
  const [monday] = filterPeriod('thisWeek', today, currentWeek());
  const entries = useTimeEntriesSince(parisMidnight(monday));
  const running = entries.data?.some((entry) => !entry.endedAt && !entry.pausedAt && entry.duration === null) ?? false;
  const now = useNow(running);
  return useMemo(() => {
    if (!entries.data) return null;
    const time: WeekTime = { today: 0, week: 0, byProject: [] };
    const byProject = new Map<string, number>();
    // The part of each time within the week and within today (a timer running past midnight counts on both days).
    const weekStart = Date.parse(parisMidnight(monday));
    const dayStart = Date.parse(parisMidnight(today));
    const dayEnd = Date.parse(parisMidnight(addDays(today, 1)));
    for (const entry of entries.data) {
      const seconds = entrySecondsWithin(entry, weekStart, Number.POSITIVE_INFINITY, now);
      time.week += seconds;
      time.today += entrySecondsWithin(entry, dayStart, dayEnd, now);
      if (entry.projectId) byProject.set(entry.projectId, (byProject.get(entry.projectId) ?? 0) + seconds);
    }
    time.byProject = [...byProject.entries()].map(([projectId, seconds]) => ({ projectId, seconds })).sort((a, b) => b.seconds - a.seconds);
    return time;
  }, [entries.data, now, today, monday]);
}

/**
 * Note of a card showing the default view of a page: its name, or that the page has none yet (the card then shows what
 * it shows without it).
 * @param {{ label: string } | null} view Default view of the page.
 * @param {string} page Name of the page.
 * @param {string} fallback What the card shows without view.
 * @returns {string} Note.
 */
export const viewNote = (view: { label: string } | null, page: string, fallback: string): string =>
  view ? `Vue « ${view.label} » de la page « ${page} ».` : `Aucune vue enregistrée sur la page « ${page} » : ${fallback}.`;

/** Row of a table shown in a home card, with its group. */
export interface ViewItem<T> {
  /** Key of the row in its group (a row of several groups is in each). */
  key: string;
  /** Key of its group ('' when not grouped). */
  group: string;
  row: T;
}

/**
 * Rows of a view of a table as the items of a home list, under the titles of their groups when the view groups them.
 * @param {ViewRows<T>} view Rows of the view (`useViewRows`).
 * @param {(row: T) => string} keyOf Key of a row.
 * @returns {{ items: ViewItem<T>[], group?: { key: Function, title: Function } }} Props of `HomeList` (its items and groups).
 */
export function viewList<T>({ groups, groupColumn }: ViewRows<T>, keyOf: (row: T) => string): { items: ViewItem<T>[]; group?: { key: (item: ViewItem<T>) => string; title: (key: string) => string } } {
  const labels = new Map(groups.map((group) => [group.key, group.label]));
  const items = groups.flatMap((group) => group.rows.map((row) => ({ key: `${group.key}/${keyOf(row)}`, group: group.key, row })));
  return { items, group: groupColumn ? { key: (item) => item.group, title: (key) => labels.get(key) ?? key } : undefined };
}
