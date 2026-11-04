import { addDays, entrySeconds, filterPeriod, formatMoney } from '@ordo/shared';
import { useMemo } from 'react';
import type { AccountingDocumentSummary } from '../accounting/documents-api';
import { useMatchingTaskIds, type Task } from '../tasks/api';
import { useTimeEntriesSince } from '../time/api';
import { useNow } from '../time/use-now';
import { myTasksFilter } from '../tasks/my-tasks';
import type { TaskContext } from '../tasks/use-task-context';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Amount in euros, from currency units.
 * @param {number} amount Amount.
 * @returns {string} Amount.
 */
export const money = (amount: number) => formatMoney(Math.round(amount * 100));

/**
 * Days from a day to another (negative when the second is earlier).
 * @param {string} from YYYY-MM-DD.
 * @param {string} to YYYY-MM-DD.
 * @returns {number} Days.
 */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

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
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

/**
 * Local midnight of a day, as an ISO date-time.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Date-time.
 */
export const localMidnight = (date: string) => new Date(`${date}T00:00:00`).toISOString();

/**
 * Local day of a moment.
 * @param {string} moment ISO date-time.
 * @returns {string} YYYY-MM-DD.
 */
export function localDayOf(moment: string): string {
  const date = new Date(moment);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Invoicing at a glance. */
export interface BillingSummary {
  /** Still due on the final invoices. */
  receivable: number;
  /** Of which past the due date. */
  overdue: number;
  overdueCount: number;
  /** Net revenue (credit notes deducted) of the month and of the year. */
  monthNet: number;
  yearNet: number;
  /** Quotes sent and waiting for an answer. */
  pendingQuotes: AccountingDocumentSummary[];
  pendingQuotesNet: number;
  drafts: number;
}

/**
 * Invoicing at a glance, from the Ordo documents.
 * @param {AccountingDocumentSummary[]} documents Documents.
 * @param {string} today Today.
 * @returns {BillingSummary} Summary.
 */
export function billingSummary(documents: AccountingDocumentSummary[], today: string): BillingSummary {
  const summary: BillingSummary = { receivable: 0, overdue: 0, overdueCount: 0, monthNet: 0, yearNet: 0, pendingQuotes: [], pendingQuotesNet: 0, drafts: 0 };
  for (const document of documents) {
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
    if (document.issueDate.slice(0, 4) === today.slice(0, 4)) summary.yearNet += sign * document.totalNet;
    if (document.issueDate.slice(0, 7) === today.slice(0, 7)) summary.monthNet += sign * document.totalNet;
    if (sign > 0 && (document.balance ?? 0) > 0) {
      summary.receivable += document.balance ?? 0;
      if (document.overdue) {
        summary.overdue += document.balance ?? 0;
        summary.overdueCount += 1;
      }
    }
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
  const query = useMemo(() => ({ filter: myTasksFilter('today'), search: '', includeArchived: false, today, utcOffset: -new Date().getTimezoneOffset() }), [today]);
  const matching = useMatchingTaskIds(query);
  return useMemo(() => {
    if (!context || !matching.data) return { tasks: null, overdue: 0 };
    const tasks = matching.data.map((id) => context.taskById.get(id)).filter((task): task is Task => task !== undefined);
    const late = (task: Task) => task.endDate !== null && task.endDate < today;
    tasks.sort((a, b) => Number(late(b)) - Number(late(a)) || (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999') || a.number - b.number);
    return { tasks, overdue: tasks.filter(late).length };
  }, [context, matching.data, today]);
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
  const [monday] = filterPeriod('thisWeek', today);
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
      if (localDayOf(entry.startedAt) === today) time.today += seconds;
      byProject.set(entry.projectId, (byProject.get(entry.projectId) ?? 0) + seconds);
    }
    time.byProject = [...byProject.entries()].map(([projectId, seconds]) => ({ projectId, seconds })).sort((a, b) => b.seconds - a.seconds);
    return time;
  }, [entries.data, now, today]);
}
