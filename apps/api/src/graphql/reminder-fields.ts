import type { Reminder } from '@ordo/shared';
import { builder } from './builder';

/** Reminder of a task, a routine or an event (decision D16): minutes before a moment, or a time of its day. */
export const ReminderRef = builder.objectRef<Reminder>('Reminder').implement({
  description: 'Reminder of a task, a routine or an event: minutes before a moment (0: at the start), or a time of the day of its day (Paris time). One of the two is null.',
  fields: (t) => ({
    before: t.exposeInt('before', { nullable: true, description: 'Minutes before, 0 to 1 440 (events and routines).' }),
    at: t.exposeString('at', { nullable: true, description: 'HH:MM on the day of the item (Paris time).' }),
  }),
});

/** Reminder as sent (checked by `remindersSchema`: exactly one of the two). */
export const ReminderInput = builder.inputType('ReminderInput', {
  fields: (t) => ({ before: t.int({ description: 'Minutes before, 0 to 1 440.' }), at: t.string({ description: 'HH:MM.' }) }),
});
