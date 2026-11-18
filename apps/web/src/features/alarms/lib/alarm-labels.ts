import { alarmRule, nextOccurrence, type AlarmFrequency, type Recurrence } from '@ordo/shared';
import type { Alarm } from '../api';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';
import * as fmt from '../../../lib/format';

/**
 * Former fields of an alarm sent with its repetition (read by older clients): its frequency and interval, and the
 * end of its rule.
 * @param {Recurrence | null} rule Repetition (none: once).
 * @returns {{ frequency: AlarmFrequency, interval: number, weekdays: number[], endDate: string | null }} Fields.
 */
export function legacyFields(rule: Recurrence | null): { frequency: AlarmFrequency; interval: number; weekdays: number[]; endDate: string | null } {
  if (!rule) return { frequency: 'ONCE', interval: 1, weekdays: [], endDate: null };
  return { frequency: rule.frequency === 'YEARLY' ? 'MONTHLY' : rule.frequency, interval: rule.interval, weekdays: rule.frequency === 'WEEKLY' ? rule.weekdays : [], endDate: rule.until };
}

/** Date, time and repetition of an alarm. */
export interface AlarmTiming {
  startDate: string | null;
  time: string | null;
  recurrence: Recurrence | null;
}

/**
 * Date, time and repetition of an alarm as text: "Le 3 nov. 2026 à 09:00", "Tous les jours à 07:30".
 * @param {AlarmTiming} timing Timing.
 * @returns {string} Text.
 */
export function describeAlarmTiming(timing: AlarmTiming): string {
  const at = timing.time ? ` à ${timing.time}` : '';
  if (!timing.recurrence || !timing.startDate) return `Le ${timing.startDate ? fmt.day(timing.startDate) : '—'}${at}`;
  return `${fmt.capitalize(describeRecurrence(timing.recurrence, timing.startDate))}${at}`;
}

/**
 * Next time an alarm rings, after a moment: none for a disabled alarm, an alarm on the timer's duration (it rings
 * with the timer), or an alarm past its last time.
 * @param {Alarm} alarm Alarm.
 * @param {Date} now Moment.
 * @returns {Date | null} Instant.
 */
export function nextRing(alarm: Alarm, now: Date): Date | null {
  if (!alarm.enabled || alarm.type === 'TRACKING_DURATION') return null;
  return nextOccurrence(alarm, now);
}

/**
 * Readable schedule of an alarm: "Tous les jours à 09:00", "Toutes les 50 min de chrono"…
 * @param {Alarm} alarm Alarm.
 * @returns {string} Description.
 */
export function describeAlarm(alarm: Alarm): string {
  if (alarm.type === 'TRACKING_DURATION') return alarm.minutes === 1 ? 'Chaque minute de chrono' : `Toutes les ${alarm.minutes} min de chrono`;
  const text = describeAlarmTiming({ startDate: alarm.startDate, time: alarm.time, recurrence: alarmRule(alarm) });
  return alarm.type === 'NOT_TRACKING' ? `${text}, si aucun chrono ne tourne` : text;
}
