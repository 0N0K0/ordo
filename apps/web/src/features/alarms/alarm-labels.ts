import type { Alarm } from './api';
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
 * Readable schedule of an alarm: "Tous les jours ouvrés à 09:00", "Toutes les 50 min de chrono"…
 * @param {Alarm} alarm Alarm.
 * @returns {string} Description.
 */
export function describeAlarm(alarm: Alarm): string {
  if (alarm.type === 'TRACKING_DURATION') return alarm.minutes === 1 ? 'Chaque minute de chrono' : `Toutes les ${alarm.minutes} min de chrono`;
  const at = `à ${alarm.time}`;
  const n = alarm.interval;
  let text: string;
  switch (alarm.frequency) {
    case 'ONCE':
      text = `Le ${formatDay(alarm.startDate!)} ${at}`;
      break;
    case 'DAILY':
      text = `${n === 1 ? 'Tous les jours' : `Tous les ${n} jours`} ${at}`;
      break;
    case 'WEEKLY': {
      const days = alarm.weekdays.length ? alarm.weekdays : [((new Date(`${alarm.startDate}T12:00:00`).getDay() + 6) % 7) + 1];
      const workdays = days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day));
      const names = workdays ? 'du lundi au vendredi' : `le ${days.map((day) => WEEKDAY_LABELS[day - 1]).join(', ')}`;
      text = `${n === 1 ? 'Chaque semaine' : `Toutes les ${n} semaines`} ${names} ${at}`;
      break;
    }
    case 'MONTHLY':
      text = `${n === 1 ? 'Tous les mois' : `Tous les ${n} mois`} le ${new Date(`${alarm.startDate}T12:00:00`).getDate()} ${at}`;
      break;
  }
  if (alarm.frequency !== 'ONCE' && alarm.endDate) text += `, jusqu’au ${formatDay(alarm.endDate)}`;
  return alarm.type === 'NOT_TRACKING' ? `${text}, si aucun chrono ne tourne` : text;
}
