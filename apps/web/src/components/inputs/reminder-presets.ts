/** A reminder offered: minutes before the moment, and its label. */
export interface ReminderPreset {
  value: number;
  label: string;
}

/** Reminders a few minutes to hours before (« 5 min avant » … « 2 h avant »). */
const SHORT_REMINDERS: ReminderPreset[] = [
  { value: 5, label: '5 min avant' },
  { value: 10, label: '10 min avant' },
  { value: 15, label: '15 min avant' },
  { value: 30, label: '30 min avant' },
  { value: 60, label: '1 h avant' },
  { value: 120, label: '2 h avant' },
];

/** Reminders of an event, in minutes before its start. */
export const EVENT_REMINDERS: ReminderPreset[] = [
  { value: 0, label: 'Au début' },
  ...SHORT_REMINDERS,
  { value: 360, label: '6 h avant (la veille à 18 h pour une journée entière)' },
  { value: 1440, label: '1 jour avant' },
  { value: 2880, label: '2 jours avant' },
  { value: 10080, label: '1 semaine avant' },
];

/** Alerts of a routine, in minutes before its moment. */
export const ROUTINE_REMINDERS: ReminderPreset[] = [{ value: 0, label: 'À l’heure' }, ...SHORT_REMINDERS];
