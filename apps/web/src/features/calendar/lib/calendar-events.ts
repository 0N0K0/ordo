import type { EventInput } from '@fullcalendar/core';
import {
  addDays,
  birthdayLabel,
  birthdaysBetween,
  birthdaySlotId,
  DEFAULT_SCHEDULE_DISPLAY,
  mapById,
  type PlannedSlot,
  readBirthDate,
  readScheduleDisplay,
  type ScheduleDisplay,
  UNTYPED_EPHEMERIS_LABEL,
  type WorkScheduleRule,
} from '@ordo/shared';
import { scheduleRules, type PersonBirthday, type ScheduleType, type useBirthdayLook, type useDefaultScheduleKind, type useSubscribedSchedules, type WorkSchedule } from '../api';
import { archivedIds } from '../../../lib/archive';
import classes from '../pages/CalendarPage.module.css';
import { inWorkspace } from './layer-label';

/** Schedule of another workspace subscribed to. */
type ForeignSchedule = NonNullable<ReturnType<typeof useSubscribedSchedules>['data']>[number];

/** Default kind of slots of the workspace. */
type DefaultKind = ReturnType<typeof useDefaultScheduleKind>['data'];

/** Display of the birthdays of the workspace. */
type BirthdayLook = ReturnType<typeof useBirthdayLook>['data'];

/**
 * Span of an occurrence of an event in FullCalendar: its days (the end excluded) all day, else its start and end.
 * @param {{ allDay: boolean, startDate: string, endDate: string, start: string, end: string }} occurrence Occurrence.
 * @returns {{ allDay: boolean, start: string, end: string }} Span.
 */
export function occurrenceSpan(occurrence: { allDay: boolean; startDate: string; endDate: string; start: string; end: string }): { allDay: boolean; start: string; end: string } {
  return {
    allDay: occurrence.allDay,
    start: occurrence.allDay ? occurrence.startDate : occurrence.start,
    end: occurrence.allDay ? addDays(occurrence.endDate, 1) : occurrence.end,
  };
}

/**
 * Whether an occurrence is archived for the day-to-day views: its event (its series) is, or its calendar (the calendar
 * is its container).
 * @param {{ archived: boolean, calendarId: string }} occurrence Occurrence.
 * @param {ReadonlySet<string>} archivedCalendarIds Archived calendars of the workspace.
 * @returns {boolean} Archived.
 */
export function isArchivedOccurrence(occurrence: { archived: boolean; calendarId: string }, archivedCalendarIds: ReadonlySet<string>): boolean {
  return occurrence.archived || archivedCalendarIds.has(occurrence.calendarId);
}

/** Color of the éphémérides without kind (they have no default kind). */
export const EPHEMERIS_COLOR = 'var(--mantine-color-gray-6)';

/**
 * Schedule shown as slots: its rule (archived, or of an archived kind, in its workspace: `countedSchedules` leaves it
 * out), the color of its kind, its label, whether of another workspace, and its display.
 */
interface ScheduleSource {
  schedule: WorkSchedule | ForeignSchedule;
  rule: WorkScheduleRule;
  /** An éphéméride: dotted. */
  ephemeris: boolean;
  color: string | null;
  label: string;
  foreign: boolean;
  display: ScheduleDisplay;
}

/**
 * Label of a layer of slots, the same everywhere (the agenda, its layers, the day of a routine): « Libellé (Type) »,
 * and « · Espace » after it for a schedule of another workspace.
 * @param {string} label Label of the schedule.
 * @param {string | null | undefined} type Label of its kind (none, or the same: left out).
 * @param {string} [workspace] Workspace of a schedule subscribed to. Optional.
 * @returns {string} Label.
 */
export function scheduleLayerLabel(label: string, type: string | null | undefined, workspace?: string): string {
  return inWorkspace(`${label}${type && type !== label ? ` (${type})` : ''}`, workspace);
}

/**
 * Schedules shown as slots: those of the workspace (in the color of their kind, the default kind without one), then
 * those of other workspaces subscribed to, each labelled « Libellé (Type) » (`scheduleLayerLabel`). Each rule says
 * whether the schedule is archived or of an archived kind, in its own workspace (for one of another workspace, as that
 * workspace says), the same for both.
 * @param {readonly WorkSchedule[]} own Schedules of the workspace.
 * @param {readonly ForeignSchedule[]} foreign Schedules subscribed to.
 * @param {readonly ScheduleType[]} types Kinds of slots.
 * @param {DefaultKind} defaultKind Default kind of the workspace.
 * @returns {ScheduleSource[]} Sources.
 */
export function scheduleSources(own: readonly WorkSchedule[], foreign: readonly ForeignSchedule[], types: readonly ScheduleType[], defaultKind: DefaultKind): ScheduleSource[] {
  const typeOf = mapById(types);
  const archivedKinds = archivedIds(types);
  return [
    ...own.map((schedule) => {
      // Without kind: the default kind of the workspace; an éphéméride without kind, its own look.
      const kind = (schedule.typeId ? typeOf.get(schedule.typeId) : undefined) ?? (schedule.ephemeris ? { label: UNTYPED_EPHEMERIS_LABEL, color: EPHEMERIS_COLOR, ...DEFAULT_SCHEDULE_DISPLAY } : defaultKind);
      return {
        schedule,
        rule: scheduleRules([schedule], archivedKinds)[0],
        ephemeris: schedule.ephemeris,
        color: kind?.color ?? null,
        label: scheduleLayerLabel(schedule.label, kind?.label),
        foreign: false,
        display: readScheduleDisplay(kind),
      };
    }),
    ...foreign.map((schedule) => ({
      schedule,
      rule: scheduleRules([schedule])[0],
      ephemeris: schedule.ephemeris,
      color: schedule.color ?? (schedule.ephemeris && !schedule.typeId ? EPHEMERIS_COLOR : null),
      label: scheduleLayerLabel(schedule.label, schedule.typeLabel, schedule.workspaceLabel),
      foreign: true,
      display: readScheduleDisplay(schedule),
    })),
  ];
}

/**
 * Look of the bar of a schedule on a day (the all-day row of the week and the day): in the color of its kind (working
 * hours without one), hatched for a schedule of another workspace, dotted and in italics for an éphéméride.
 * @param {{ color: string | null, foreign: boolean, ephemeris?: boolean }} source Schedule shown.
 * @returns {Pick<EventInput, 'backgroundColor' | 'borderColor' | 'textColor' | 'classNames'>} Event props.
 */
export function slotBarLook({ color, foreign, ephemeris = false }: { color: string | null; foreign: boolean; ephemeris?: boolean }): Pick<EventInput, 'backgroundColor' | 'borderColor' | 'textColor' | 'classNames'> {
  return {
    backgroundColor: color ?? 'var(--mantine-color-green-light)',
    borderColor: color ?? 'var(--mantine-color-green-light)',
    textColor: 'var(--mantine-color-text)',
    classNames: [classes.slotBar, ...slotLookClasses({ foreign, ephemeris })],
  };
}

/**
 * Classes telling a schedule shown apart: hatched from another workspace, dotted an éphéméride.
 * @param {{ foreign: boolean, ephemeris?: boolean }} source Schedule shown.
 * @returns {string[]} Classes.
 */
export function slotLookClasses({ foreign, ephemeris = false }: { foreign: boolean; ephemeris?: boolean }): string[] {
  return [...(foreign ? [classes.subscribedSlot] : []), ...(ephemeris ? [classes.ephemeris, classes.ephemerisBar] : [])];
}

/** Slots of a source as the agenda shows them: the look of its kind and its slots of the period. */
export interface ShownSlots {
  /** An éphéméride: dotted. */
  ephemeris: boolean;
  color: string | null;
  label: string;
  foreign: boolean;
  display: ScheduleDisplay;
  slots: readonly PlannedSlot[];
}

/**
 * Birthdays of a period as the calendar shows them: read-only all-day events « Anniversaire de Paul — 40 ans » (the
 * age when the year is known), in the color chosen for the birthdays (`birthdayLook`; none: the gray of the
 * éphémérides), each opening its person (`kind: 'birthday'`). Hidden birthdays, or while loading: none.
 * @param {readonly PersonBirthday[]} birthdays Birthdays of the workspace.
 * @param {BirthdayLook} look Display of the birthdays of the workspace (undefined while loading: none).
 * @param {string} from First day shown.
 * @param {string} to Last day shown.
 * @returns {EventInput[]} One event per birthday of the period.
 */
export function birthdayEvents(birthdays: readonly PersonBirthday[], look: BirthdayLook, from: string, to: string): EventInput[] {
  if (!look?.shown) return [];
  const color = look.color ?? EPHEMERIS_COLOR;
  return birthdays.flatMap((birthday) => {
    const birth = readBirthDate(birthday.birthDate);
    if (!birth) return [];
    return birthdaysBetween(birth, from, to).map(({ date, age }) => ({
      id: `${birthdaySlotId(birthday.id)}:${date}`,
      title: birthdayLabel(birthday.name, age),
      allDay: true,
      start: date,
      end: addDays(date, 1),
      editable: false,
      backgroundColor: color,
      borderColor: color,
      extendedProps: { kind: 'birthday', birthday },
    }));
  });
}
