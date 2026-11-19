import { z } from 'zod';
import { joinedKey } from '../core/collections';
import { END_AFTER_START, endsAfter, requiredText } from '../core/rules';
import { locatedFields } from '../core/geo';
import { recurrenceSchema } from '../dates/recurrence';
import { daySchema, timeOfDaySchema, endDaySchema, startDaySchema } from '../dates/times';
import { colorSchema } from '../core/workspace';

const calendarLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }),
  label: z.string().trim().max(200, '200 caractères maximum.'),
});

/** Longest label of a calendar event. */
export const EVENT_LABEL_MAX = 300;

/** Calendar event fields. Times are local to `timeZone`; all-day events have none. */
export const calendarEventInputSchema = z
  .object({
    label: requiredText(EVENT_LABEL_MAX),
    description: z
      .string()
      .max(65_536, 'Texte trop long.')
      .transform((value) => (value.trim() ? value : null))
      .nullable(),
    location: z
      .string()
      .trim()
      .max(500, '500 caractères maximum.')
      .transform((value) => value || null)
      .nullable(),
    links: z.array(calendarLinkSchema).max(20, '20 liens maximum.'),
    allDay: z.boolean(),
    startDate: startDaySchema,
    startTime: timeOfDaySchema.nullable(),
    endDate: endDaySchema,
    endTime: timeOfDaySchema.nullable(),
    timeZone: z.string().min(1).max(64),
    recurrence: recurrenceSchema.nullable(),
    /** Minutes before the start. */
    reminders: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(60 * 24 * 30),
      )
      .max(10),
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
      .array(z.object({ routineId: z.string(), date: daySchema() }))
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
  label: requiredText(80),
  color: colorSchema,
  parentId: z.string().nullable(),
});
export type CalendarCategoryFormValues = z.infer<typeof calendarCategoryFormSchema>;

/** Calendar of a workspace (every event belongs to one). */
export const calendarFormSchema = z.object({
  label: requiredText(80),
  color: colorSchema,
});
export type CalendarFormValues = z.infer<typeof calendarFormSchema>;

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
