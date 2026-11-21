import { countOf, formatDuration, reminderAnchorOf, type ReminderAnchor, type ReminderValue } from '@ordo/shared';

/**
 * Words of the reminders, the same in their editor (`RemindersSelect`) and wherever they are told (a cell, the ringtones
 * of the editor): what they count from, by item (decisions FS, FV).
 */

/** What reminders are of, as far as their words go: an item with one moment (task, éphéméride, birthday), an event, a routine. */
export type ReminderTarget = 'item' | 'event' | 'routine';

/** Time of the reminders « N jours avant » added (another one can be typed). */
export const REMINDER_DAYS_TIME = '09:00';

/** Day of a reminder « À HH:MM » of an item with one moment, in its label. */
export const REMINDER_DAY = 'le jour J';

/**
 * Words of an anchor: at the moment (« Au début de l’ouverture »), before the moment (« le début de l’ouverture »), the
 * day some days before (« l’ouverture »), the day (« le jour de l’ouverture »).
 */
interface AnchorWords {
  at: string;
  moment: string;
  daysBefore: string;
  on: string;
}

/** Words of the anchors of the events and the routines (an anchor of a time of the day tells only its day: `start` or `end`). */
const ANCHOR_WORDS: Record<Exclude<ReminderTarget, 'item'>, Partial<Record<ReminderAnchor, AnchorWords>>> = {
  event: {
    start: { at: 'Au début', moment: 'le début', daysBefore: 'le premier jour', on: 'le premier jour' },
    end: { at: 'À la fin', moment: 'la fin', daysBefore: 'le dernier jour', on: 'le dernier jour' },
  },
  routine: {
    start: { at: 'Au début de l’ouverture', moment: 'le début de l’ouverture', daysBefore: 'l’ouverture', on: 'le jour de l’ouverture' },
    openEnd: { at: 'À la fin de l’ouverture', moment: 'la fin de l’ouverture', daysBefore: 'l’ouverture', on: 'le jour de l’ouverture' },
    dueStart: { at: 'Au début de l’échéance', moment: 'le début de l’échéance', daysBefore: 'l’échéance', on: 'le jour de l’échéance' },
    end: { at: 'À la fin de l’échéance', moment: 'la fin de l’échéance', daysBefore: 'l’échéance', on: 'le jour de l’échéance' },
  },
};

/**
 * What reminders are of, from the anchors they may count from: the four of a routine, the start and the end of an event,
 * else an item with one moment.
 * @param {readonly ReminderAnchor[]} anchors Anchors offered.
 * @returns {ReminderTarget} Target.
 */
export const reminderTargetOf = (anchors: readonly ReminderAnchor[]): ReminderTarget => (anchors.includes('openEnd') ? 'routine' : anchors.includes('end') ? 'event' : 'item');

/**
 * Words of an anchor of a target (none for an item with one moment).
 * @param {ReminderTarget} target Target.
 * @param {ReminderAnchor} anchor Anchor.
 * @returns {AnchorWords | undefined} Words.
 */
export const anchorWords = (target: ReminderTarget, anchor: ReminderAnchor): AnchorWords | undefined => (target === 'item' ? undefined : ANCHOR_WORDS[target][anchor]);

/**
 * Label of a reminder: « Au début », « 15 min avant », « À 08:00 le jour J » (`day` empty: « À 08:00 », a task),
 * « 3 jours avant, à 08:00 »; for an event or a routine, with what it counts from (« 15 min avant la fin », « 3 jours
 * avant l’échéance, à 09:00 », « À 18:00, le jour de l’échéance », « Au début de l’ouverture »).
 * @param {ReminderValue} reminder Reminder.
 * @param {{ day?: string, target?: ReminderTarget }} [options] Day of a time of the day (default « le jour J »), what the reminder is of (default an item with one moment). Optional.
 * @returns {string} Label.
 */
export function reminderLabel(reminder: ReminderValue, { day = REMINDER_DAY, target = 'item' }: { day?: string; target?: ReminderTarget } = {}): string {
  const words = anchorWords(target, reminderAnchorOf(reminder));
  if (reminder.at !== null && reminder.days) return `${countOf(reminder.days, 'jour')} avant${words ? ` ${words.daysBefore}` : ''}, à ${reminder.at}`;
  if (reminder.at !== null) return words ? `À ${reminder.at}, ${words.on}` : `À ${reminder.at}${day ? ` ${day}` : ''}`;
  const minutes = reminder.before ?? 0;
  if (minutes === 0) return words?.at ?? 'Au début';
  const duration = minutes % 60 === 0 ? `${minutes / 60} h` : formatDuration(minutes * 60);
  return `${duration} avant${words ? ` ${words.moment}` : ''}`;
}
