import { birthdayRings, ephemerisRings, type RemindedBirthday, type RemindedSchedule as SharedRemindedSchedule } from '@ordo/shared';
import { scheduleRules } from '../../calendar/api';
import { ringPlannedReminders, type RingLink, type RingWorkspace } from '../components/ring';

export type { RemindedBirthday };

/** What the reminders of an éphéméride are rung from (of the open workspace or of another one): with what its rule is read from. */
export interface RemindedSchedule extends SharedRemindedSchedule {
  startDate: string;
  endDate?: string | null;
  cases: unknown;
  exceptions: unknown;
  typeId?: string | null;
}

/**
 * Rings the reminders of the éphémérides that are due (`ephemerisRings`): for each run of
 * consecutive days it covers, « N min avant » its start (Paris midnight all day), « À HH:MM » that day, « N jours avant,
 * à HH:MM ». A créneau or an archived éphéméride rings none.
 * @param {readonly RemindedSchedule[]} schedules Schedules.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Calendar, workspace.
 * @param {RingWorkspace} [workspace] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringEphemerisReminders(schedules: readonly RemindedSchedule[], now: Date, links: RingLink[], workspace?: RingWorkspace): void {
  ringPlannedReminders(ephemerisRings(schedules, (schedule) => scheduleRules([schedule])[0], now), now, () => links, workspace);
}

/**
 * Rings the reminders of the birthdays that are due (`birthdayRings`): « À HH:MM » on the day, « N jours avant,
 * à HH:MM »; the toast tells « Anniversaire de Paul — 40 ans » (the age when the year of birth is known) and its day.
 * @template {RemindedBirthday} B
 * @param {readonly B[]} birthdays Birthdays.
 * @param {Date} now Current time.
 * @param {(birthday: B) => RingLink[]} links Links of a birthday (its person).
 * @param {RingWorkspace} [workspace] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringBirthdayReminders<B extends RemindedBirthday>(birthdays: readonly B[], now: Date, links: (birthday: B) => RingLink[], workspace?: RingWorkspace): void {
  ringPlannedReminders(birthdayRings(birthdays, now), now, ({ birthday }) => links(birthday), workspace);
}
