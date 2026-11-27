import { z } from 'zod';
import { joinedKey } from '../core/collections';
import { END_AFTER_START, endsAfter, markdownSchema, optionalText, requiredText } from '../core/rules';
import { locatedFields } from '../core/geo';
import { itemLinksSchema } from '../core/links';
import { linkedDocumentsFields } from '../core/documents';
import { recurrenceSchema } from '../dates/recurrence';
import { daySchema, timeOfDaySchema, endDaySchema, startDaySchema } from '../dates/times';
import { eventRemindersSchema } from '../dates/reminders';
import { colorSchema } from '../core/workspace';

/** Calendar event fields. Times are Paris times (every event is in Paris time); all-day events have none. */
export const calendarEventInputSchema = z
  .object({
    label: requiredText(),
    description: markdownSchema,
    location: optionalText(),
    links: itemLinksSchema,
    /** Documents linked to it (its whole series): of the library, and of its project tree. */
    ...linkedDocumentsFields,
    allDay: z.boolean(),
    startDate: startDaySchema,
    startTime: timeOfDaySchema.nullable(),
    endDate: endDaySchema,
    endTime: timeOfDaySchema.nullable(),
    recurrence: recurrenceSchema.nullable(),
    /** Minutes before its start or its end (24 hours at most), a time of its first (or last) day, or that time 1 to 30 days before; each with its ringtone or none; 10 at most. */
    reminders: eventRemindersSchema,
    /** Point of the location, and travel time to the event and back from it, in minutes (timed events). */
    ...locatedFields,
    projectId: z.string().nullable(),
    /** Calendar of the event; the first one of the workspace when omitted. */
    calendarId: z.string().nullish(),
    contributorIds: z.array(z.string()).max(200),
    /** Relations without contributor taking part. */
    relationIds: z.array(z.string()).max(200).default([]),
    /** « Bénéficiaires »: whom the event is for (contributors, relations). */
    beneficiaryIds: z.array(z.string()).max(200).default([]),
    beneficiaryRelationIds: z.array(z.string()).max(200).default([]),
    categoryIds: z.array(z.string()).max(50),
    /** Tasks the event is about. */
    taskIds: z.array(z.string()).max(50, '50 tâches maximum.'),
    /** Routines of a day of the event it is about (that day only, even for a repeated routine). */
    routineLinks: z
      // `shownDate`: the day the occurrence shows on once the event moved (the occurrence of that day is linked).
      .array(z.object({ routineId: z.string(), date: daySchema(), shownDate: daySchema().optional() }))
      .max(200)
      .default([]),
  })
  .superRefine((event, context) => {
    if (!event.allDay) {
      if (!event.startTime) context.addIssue({ code: 'custom', path: ['startTime'], message: 'L’heure de début est requise.' });
      if (!event.endTime) context.addIssue({ code: 'custom', path: ['endTime'], message: 'L’heure de fin est requise.' });
    }
    const start = `${event.startDate} ${event.allDay ? '' : (event.startTime ?? '')}`;
    const end = `${event.endDate} ${event.allDay ? '' : (event.endTime ?? '')}`;
    if (!endsAfter(start, end)) context.addIssue({ code: 'custom', path: ['endDate'], message: END_AFTER_START });
    if (event.recurrence?.until && event.recurrence.until < event.startDate) {
      context.addIssue({ code: 'custom', path: ['recurrence'], message: 'La fin de la répétition doit suivre le début.' });
    }
  });
export type CalendarEventInput = z.input<typeof calendarEventInputSchema>;

/** Scope of a change to a recurring event: one occurrence, it and the following ones, or the whole series. */
export const EVENT_SCOPES = ['THIS', 'FOLLOWING', 'ALL'] as const;
export type EventScope = (typeof EVENT_SCOPES)[number];

export const calendarCategoryFormSchema = z.object({
  label: requiredText(),
  color: colorSchema,
  parentId: z.string().nullable(),
});
export type CalendarCategoryFormValues = z.infer<typeof calendarCategoryFormSchema>;

/** Calendar of a workspace (every event belongs to one). */
export const calendarFormSchema = z.object({
  label: requiredText(),
  color: colorSchema,
});
export type CalendarFormValues = z.infer<typeof calendarFormSchema>;

/**
 * Looks of the items of a calendar view printed in PDF, the same list for the app that sends them and the API that
 * draws them: `event` filled in its color (events, subscribed calendars, birthdays), `task` light with a stripe in its
 * color (tasks, routines), `time` light (tracked times), `travel` faint, its text dimmed (travel times), `slot` filled
 * in its color with a dark text (bars of créneaux and éphémérides, slots being changed), `background` behind the
 * other items (hours or days of créneaux and éphémérides), `line` a thin line in its color (on the left of the hours of
 * créneaux and éphémérides in the week and the day, at the bottom of their days in the month).
 */
export const CALENDAR_PDF_KINDS = ['event', 'task', 'time', 'travel', 'slot', 'background', 'line'] as const;
export type CalendarPdfKind = (typeof CALENDAR_PDF_KINDS)[number];

/**
 * Key of an occurrence of something repeated (an event, a routine) on a day: « id|date », the date empty for none. The
 * same in the API and the web.
 * @param {string} id Event or routine.
 * @param {string | null | undefined} date Day of the occurrence (YYYY-MM-DD). Optional.
 * @returns {string} Key.
 */
export const occurrenceKey = (id: string, date?: string | null): string => joinedKey(id, date);

/**
 * Occurrence of a key made by `occurrenceKey`.
 * @param {string} key Key.
 * @returns {{ id: string, date: string | null }} Event or routine, and its day (none: a single one).
 */
export function readOccurrenceKey(key: string): { id: string; date: string | null } {
  const [id, date] = key.split('|');
  return { id, date: date || null };
}

/** An occurrence of an event as shown: the day that identifies it in its series (null: a one-off event) and its days. */
export interface ShownEventOccurrence {
  occurrenceDate: string | null;
  startDate: string;
  endDate: string;
}

/**
 * Occurrences of an event shown on a day (between their first and last days, included).
 * @param {readonly T[]} occurrences Occurrences, as shown (moved alone: on their own days).
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {T[]} Those shown that day.
 */
export const occurrencesShowing = <T extends ShownEventOccurrence>(occurrences: readonly T[], day: string): T[] =>
  occurrences.filter((occurrence) => occurrence.startDate <= day && day <= occurrence.endDate);

/**
 * Occurrence of an event a routine link follows when its series moves or is cut: the single occurrence shown on the
 * day the link shows on, by the day that identifies it (moved alone: its own days, not those of its rule); none or
 * several shown that day: null (the link then goes by its day).
 * @param {readonly ShownEventOccurrence[]} occurrences Occurrences of the event, as shown.
 * @param {string} day Day the link shows on.
 * @returns {string | null} Day that identifies the occurrence, or null.
 */
export function linkedEventOccurrence(occurrences: readonly ShownEventOccurrence[], day: string): string | null {
  const shown = occurrencesShowing(occurrences, day);
  return shown.length === 1 ? shown[0].occurrenceDate : null;
}
