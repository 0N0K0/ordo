import type { DeadTime } from '@ordo/shared';
import { builder } from './builder';

/** « Temps mort » of a task or a routine (decision FT): a wait a timer is launched for; not time spent. */
export const DeadTimeRef = builder.objectRef<DeadTime>('DeadTime').implement({
  description: 'Dead time of a task or a routine (« Lave-linge, 1 h 30 »): a wait a timer is launched for, with an alarm at its end; not time spent.',
  fields: (t) => ({
    label: t.exposeString('label'),
    minutes: t.exposeInt('minutes', { description: 'Estimated time, 1 to 1 440 minutes: the duration of the timer launched by default.' }),
    ringtone: t.string({ nullable: true, description: 'Ringtone at its end; null: the one of the settings of the user.', resolve: (deadTime) => deadTime.ringtone ?? null }),
  }),
});

/** Dead time as sent (checked by `deadTimesSchema`). */
export const DeadTimeInput = builder.inputType('DeadTimeInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    minutes: t.int({ required: true, description: '1 to 1 440.' }),
    ringtone: t.string({ description: 'Ringtone of the bank; none: the one of the settings.' }),
  }),
});
