import { z } from 'zod';
import { recurrenceSchema } from './recurrence';
import { colorSchema } from './workspace';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).');

export const calendarLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }),
  label: z.string().trim().max(200, '200 caractères maximum.'),
});

/** Calendar event fields. Times are local to `timeZone`; all-day events have none. */
export const calendarEventInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Le titre est requis.').max(300, '300 caractères maximum.'),
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
    startDate: z.iso.date({ error: 'La date de début est requise.' }),
    startTime: timeSchema.nullable(),
    endDate: z.iso.date({ error: 'La date de fin est requise.' }),
    endTime: timeSchema.nullable(),
    timeZone: z.string().min(1).max(64),
    recurrence: recurrenceSchema.nullable(),
    /** Minutes before the start. */
    reminders: z.array(z.number().int().min(0).max(60 * 24 * 30)).max(10),
    /** Travel time to the event and back from it, in minutes (timed events). */
    /** Point of the location, when chosen from the map or a search. */
    locationLat: z.number().min(-90).max(90).nullable().default(null),
    locationLon: z.number().min(-180).max(180).nullable().default(null),
    travelBefore: z.number().int().min(0, 'Durée positive attendue.').max(24 * 60, '24 h maximum.').default(0),
    travelAfter: z.number().int().min(0, 'Durée positive attendue.').max(24 * 60, '24 h maximum.').default(0),
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
  })
  .superRefine((event, context) => {
    if (!event.allDay) {
      if (!event.startTime) context.addIssue({ code: 'custom', path: ['startTime'], message: 'L’heure de début est requise.' });
      if (!event.endTime) context.addIssue({ code: 'custom', path: ['endTime'], message: 'L’heure de fin est requise.' });
    }
    const start = `${event.startDate} ${event.allDay ? '' : (event.startTime ?? '')}`;
    const end = `${event.endDate} ${event.allDay ? '' : (event.endTime ?? '')}`;
    if (end < start) context.addIssue({ code: 'custom', path: ['endDate'], message: 'La fin doit suivre le début.' });
    if (event.recurrence?.until && event.recurrence.until < event.startDate) {
      context.addIssue({ code: 'custom', path: ['recurrence'], message: 'La fin de la répétition doit suivre le début.' });
    }
  });
export type CalendarEventInput = z.input<typeof calendarEventInputSchema>;

/** Scope of a change to a recurring event: one occurrence, it and the following ones, or the whole series. */
export const EVENT_SCOPES = ['THIS', 'FOLLOWING', 'ALL'] as const;
export type EventScope = (typeof EVENT_SCOPES)[number];

export const calendarCategoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(80, '80 caractères maximum.'),
  color: colorSchema,
  parentId: z.string().nullable(),
});
export type CalendarCategoryFormValues = z.infer<typeof calendarCategoryFormSchema>;

/** Calendar of a workspace (every event belongs to one). */
export const calendarFormSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(80, '80 caractères maximum.'),
  color: colorSchema,
});
export type CalendarFormValues = z.infer<typeof calendarFormSchema>;
