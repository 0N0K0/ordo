import { alarmRule, type AlarmFrequency, type Recurrence } from '@ordo/shared';
import type { Alarm } from './api';
import { describeRecurrence } from '../../components/recurrence/describe-recurrence';
import * as fmt from '../../lib/format';

export const WEEKDAY_LABELS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/**
 * Formats a YYYY-MM-DD date.
 * @param {string} date Calendar date.
 * @returns {string} "3 novembre 2026".
 */
function formatDay(date: string): string {
  return fmt.day(date);
}

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

/**
 * Readable schedule of an alarm: "Tous les jours à 09:00", "Toutes les 50 min de chrono"…
 * @param {Alarm} alarm Alarm.
 * @returns {string} Description.
 */
export function describeAlarm(alarm: Alarm): string {
  if (alarm.type === 'TRACKING_DURATION') return alarm.minutes === 1 ? 'Chaque minute de chrono' : `Toutes les ${alarm.minutes} min de chrono`;
  const at = `à ${alarm.time}`;
  const rule = alarmRule(alarm);
  const text = rule && alarm.startDate ? `${fmt.capitalize(describeRecurrence(rule, alarm.startDate))} ${at}` : `Le ${formatDay(alarm.startDate!)} ${at}`;
  return alarm.type === 'NOT_TRACKING' ? `${text}, si aucun chrono ne tourne` : text;
}
