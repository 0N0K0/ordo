import { addDays, mapById, readScheduleDisplay, type ScheduleDisplay, type WorkScheduleRule } from '@ordo/shared';
import { scheduleRules, type ScheduleType, type useDefaultScheduleKind, type useSubscribedSchedules, type WorkSchedule } from '../api';

/** Schedule of another workspace subscribed to. */
type ForeignSchedule = NonNullable<ReturnType<typeof useSubscribedSchedules>['data']>[number];

/** Default kind of slots of the workspace. */
type DefaultKind = ReturnType<typeof useDefaultScheduleKind>['data'];

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

/**
 * Ids of the archived calendars.
 * @param {readonly { id: string, archived: boolean }[] | undefined} calendars Calendars of the workspace.
 * @returns {Set<string>} Ids.
 */
export function archivedCalendarIds(calendars: readonly { id: string; archived: boolean }[] | undefined): Set<string> {
  return new Set((calendars ?? []).filter((calendar) => calendar.archived).map((calendar) => calendar.id));
}

/** Schedule shown as slots: its rule, the color of its kind, its label, whether of another workspace, and its display. */
export interface ScheduleSource {
  schedule: WorkSchedule | ForeignSchedule;
  rule: WorkScheduleRule;
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
  return `${label}${type && type !== label ? ` (${type})` : ''}${workspace ? ` · ${workspace}` : ''}`;
}

/**
 * Schedules shown as slots: those of the workspace (in the color of their kind, the default kind without one), then
 * those of other workspaces subscribed to, each labelled « Libellé (Type) » (`scheduleLayerLabel`).
 * @param {readonly WorkSchedule[]} own Schedules of the workspace.
 * @param {readonly ForeignSchedule[]} foreign Schedules subscribed to.
 * @param {readonly ScheduleType[]} types Kinds of slots.
 * @param {DefaultKind} defaultKind Default kind of the workspace.
 * @returns {ScheduleSource[]} Sources.
 */
export function scheduleSources(own: readonly WorkSchedule[], foreign: readonly ForeignSchedule[], types: readonly ScheduleType[], defaultKind: DefaultKind): ScheduleSource[] {
  const typeOf = mapById(types);
  return [
    ...own.map((schedule) => {
      // Without kind: the default kind of the workspace.
      const kind = (schedule.typeId ? typeOf.get(schedule.typeId) : undefined) ?? defaultKind;
      return {
        schedule,
        rule: scheduleRules([schedule])[0],
        color: kind?.color ?? null,
        label: scheduleLayerLabel(schedule.label, kind?.label),
        foreign: false,
        display: readScheduleDisplay(kind),
      };
    }),
    ...foreign.map((schedule) => ({
      schedule,
      rule: scheduleRules([schedule])[0],
      color: schedule.color ?? null,
      label: scheduleLayerLabel(schedule.label, schedule.typeLabel, schedule.workspaceLabel),
      foreign: true,
      display: readScheduleDisplay(schedule),
    })),
  ];
}
