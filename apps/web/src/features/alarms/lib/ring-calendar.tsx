import { ageOn, birthdayLabel, birthdaysBetween, occurrenceReminders, parisInstant, readBirthDate, reminderDayRange, remindersAt, scheduleRuns, type ReminderValue } from '@ordo/shared';
import { CakeIcon, CalendarStarIcon } from '@phosphor-icons/react';
import { scheduleRules } from '../../calendar/api';
import { ringPlannedReminders, type RingLink } from '../components/ring';
import { taggedKey } from '../../../lib/tagged-key';
import * as fmt from '../../../lib/format';

/** What the reminders of an éphéméride are rung from (of the open workspace or of another one). */
export interface RemindedSchedule {
  id: string;
  label: string;
  archived: boolean;
  ephemeris: boolean;
  startDate: string;
  endDate?: string | null;
  cases: unknown;
  exceptions: unknown;
  typeId?: string | null;
  reminders: readonly ReminderValue[];
}

/**
 * Rings the reminders of the éphémérides that are due (lot 16, decision FO): for each run of consecutive days it covers
 * (its first day from yesterday to the most days a reminder rings before), « N min avant » its start (Paris midnight
 * all day), « À HH:MM » that day, « N jours avant, à HH:MM ». A créneau or an archived éphéméride rings none.
 * @param {readonly RemindedSchedule[]} schedules Schedules.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Calendar, workspace.
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringEphemerisReminders(schedules: readonly RemindedSchedule[], now: Date, links: RingLink[], workspaceLabel?: string): void {
  const { from, to } = reminderDayRange(now);
  for (const schedule of schedules) {
    if (!schedule.ephemeris || schedule.archived || !schedule.reminders.length) continue;
    for (const run of scheduleRuns(scheduleRules([schedule])[0], from, to)) {
      const key = taggedKey('ephemeris', `${schedule.id}:${run.day}`);
      ringPlannedReminders(
        occurrenceReminders(key, run.day, parisInstant(run.day, run.start), schedule.reminders),
        now,
        () => ({ icon: <CalendarStarIcon />, title: schedule.label, lines: [run.start === '00:00' ? fmt.day(run.day) : `${fmt.day(run.day)} · ${run.start}`], actions: links }),
        workspaceLabel,
      );
    }
  }
}

/** What the reminders of a birthday are rung from (query `birthdays`, of the open workspace or of another one). */
export interface RemindedBirthday {
  id: string;
  name: string;
  birthDate: string;
  reminders: readonly ReminderValue[];
}

/**
 * Rings the reminders of the birthdays that are due (lot 16): « À HH:MM » on the day, « N jours avant, à HH:MM »; the
 * toast tells « Anniversaire de Paul — 40 ans » (the age when the year of birth is known) and its day.
 * @template {RemindedBirthday} B
 * @param {readonly B[]} birthdays Birthdays.
 * @param {Date} now Current time.
 * @param {(birthday: B) => RingLink[]} links Links of a birthday (its person).
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringBirthdayReminders<B extends RemindedBirthday>(birthdays: readonly B[], now: Date, links: (birthday: B) => RingLink[], workspaceLabel?: string): void {
  const { from, to } = reminderDayRange(now);
  for (const birthday of birthdays) {
    const birth = readBirthDate(birthday.birthDate);
    if (!birth || !birthday.reminders.length) continue;
    for (const { date } of birthdaysBetween(birth, from, to)) {
      ringPlannedReminders(
        remindersAt(taggedKey('birthday', `${birthday.id}:${date}`), date, birthday.reminders),
        now,
        () => ({ icon: <CakeIcon />, title: birthdayLabel(birthday.name, ageOn(birth, date)), lines: [fmt.day(date)], actions: links(birthday) }),
        workspaceLabel,
      );
    }
  }
}
