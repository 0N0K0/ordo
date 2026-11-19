import { localDay, localMidnight, monthOfDay, yearOfDay } from '../../../lib/dates';
import { addDays, entrySeconds, filterPeriod } from '@ordo/shared';
import { useMemo } from 'react';
import type { AccountingDocumentSummary, ImportedDocument } from '../../accounting/api/documents';
import type { Task } from '../../tasks/api';
import { matchTasks } from '../../tasks/lib/task-columns';
import { useTaskColumns } from '../../tasks/hooks/use-task-columns';
import { useTimeEntriesSince } from '../../time/api';
import { useNow } from '../../../lib/use-now';
import { myTasksFilter } from '../../tasks/lib/my-tasks';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import * as fmt from '../../../lib/format';
import { currentWeek } from '../../../lib/week';
import { useCalendarEvents, type EventOccurrence } from '../../calendar/api';
import { isTaskOverdue } from '../../tasks/lib/task-overdue';

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
 * (decision CA).
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
    tasks.sort((a, b) => Number(late(b)) - Number(late(a)) || (a.deadline ?? a.endDate ?? '9999').localeCompare(b.deadline ?? b.endDate ?? '9999') || (a.number ?? 0) - (b.number ?? 0));
    return { tasks, overdue: tasks.filter(late).length };
  }, [context, columns, today]);
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
  const entries = useTimeEntriesSince(localMidnight(monday));
  const running = entries.data?.some((entry) => !entry.endedAt && !entry.pausedAt && entry.duration === null) ?? false;
  const now = useNow(running);
  return useMemo(() => {
    if (!entries.data) return null;
    const time: WeekTime = { today: 0, week: 0, byProject: [] };
    const byProject = new Map<string, number>();
    for (const entry of entries.data) {
      const seconds = entrySeconds(entry, now);
      time.week += seconds;
      if (localDay(entry.startedAt) === today) time.today += seconds;
      if (entry.projectId) byProject.set(entry.projectId, (byProject.get(entry.projectId) ?? 0) + seconds);
    }
    time.byProject = [...byProject.entries()].map(([projectId, seconds]) => ({ projectId, seconds })).sort((a, b) => b.seconds - a.seconds);
    return time;
  }, [entries.data, now, today]);
}
