import type { Reminder } from '@ordo/shared';
import { builder } from './builder';

/**
 * Reminder of a task, a routine, an event, an éphéméride or a birthday: minutes before a moment,
 * or a time of its day or of some days before it.
 */
export const ReminderRef = builder.objectRef<Reminder>('Reminder').implement({
  description:
    'Reminder of a task, a routine, an event, an éphéméride or a birthday: minutes before a moment (0: at the start), or a time of the day of its day or of `days` days before it (Paris time). One of before and at is null.',
  fields: (t) => ({
    before: t.exposeInt('before', { nullable: true, description: 'Minutes before, 0 to 1 440 (events, routines, éphémérides).' }),
    at: t.exposeString('at', { nullable: true, description: 'HH:MM on the day of the item, or `days` days before it (Paris time).' }),
    days: t.exposeInt('days', { nullable: true, description: 'Days before the day of the item, 1 to 30, with `at` (« N jours avant, à HH:MM »); null: its day.' }),
    anchor: t.string({
      description:
        '`start` (counted from the start of the item, its first day; a routine: the start of the opening day of an occurrence) or `end` (from its end, its last day; a routine: the end of its due day); routines only: `openEnd` (the end of the opening day), `dueStart` (the start of the due day).',
      resolve: (reminder) => reminder.anchor ?? 'start',
    }),
    ringtone: t.string({ nullable: true, description: 'Ringtone of the bank; null: the one of the settings of the user.', resolve: (reminder) => reminder.ringtone ?? null }),
  }),
});

/** Reminder as sent (checked by `remindersSchema`: exactly one of `before` and `at`, `days` only with `at`). */
export const ReminderInput = builder.inputType('ReminderInput', {
  fields: (t) => ({
    before: t.int({ description: 'Minutes before, 0 to 1 440.' }),
    at: t.string({ description: 'HH:MM.' }),
    days: t.int({ description: 'Days before, 1 to 30, with `at`.' }),
    anchor: t.string({ description: '`start` (default) or `end` (events and routines); `openEnd`, `dueStart` (routines).' }),
    ringtone: t.string({ description: 'Ringtone of the bank; none: the one of the settings.' }),
  }),
});
