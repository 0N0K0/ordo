import type { QueryKey } from '@tanstack/react-query';

// Query keys shared across features. They live here, in a module without imports, because the feature api modules
// import each other in cycles (tasks → routines → time → calendar → tasks): a key derived at the top of one of them
// from a key of another could read it before it is set (`[...undefined]`). Each feature api re-exports its keys.

/** Root key of the task queries (tasks, contributors, columns…). */
export const tasksQueryKey = ['tasks'] as const;

/** Key of the tasks doable now: refreshed with what their slot conditions count (`SLOT_DEPENDENT_KEYS`). */
export const doableTasksKey = [...tasksQueryKey, 'doable'] as const;

/** Key of the automations of the tasks (under the tasks: their settings). */
export const taskAutomationsQueryKey = [...tasksQueryKey, 'automations'] as const;

/** Root key of the routine queries. */
export const routinesKey = ['routines'] as const;

/** Root key of the time entry queries. */
export const timeQueryKey = ['time'] as const;

/** Root key of the accounting queries. */
export const accountingQueryKey = ['accounting'] as const;

/** Key of the treasury queries: under the accounting key (payments change documents, documents change the forecast). */
export const treasuryKey = [...accountingQueryKey, 'treasury'];

/** Key of the treasury settings (team, relations, contexts…). */
export const treasurySettingsKey = [...treasuryKey, 'settings'];

/** Root key of the calendar queries (events, calendars, categories, schedules). */
export const calendarQueryKey = ['calendar'] as const;

/**
 * What the sources of the slot conditions (schedules, kinds, birthdays) change, refreshed with them: the
 * routines (their occurrences come from the API) and the tasks doable now.
 */
export const SLOT_DEPENDENT_KEYS: readonly QueryKey[] = [routinesKey, doableTasksKey];

/**
 * Key of the birthdays: under the tasks (a contributor changed or archived reloads them); a relation changed or
 * archived reloads them too (`saveRelation`, its archiving).
 */
export const birthdaysQueryKey = [...tasksQueryKey, 'birthdays'] as const;
