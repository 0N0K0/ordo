import type { EventInput } from '@fullcalendar/core';
import {
  addDays,
  birthdayLabel,
  birthdaysBetween,
  BIRTHDAY_SLOT_KIND_LABEL,
  birthdaySlotId,
  countedSchedules,
  DEFAULT_SCHEDULE_DISPLAY,
  DEFAULT_SCHEDULE_KIND_LABEL,
  mapById,
  type PlannedSlot,
  readBirthDate,
  readScheduleDisplay,
  type ScheduleDisplay,
  slotPattern,
  type SlotPlace,
  slotPlacements,
  UNTYPED_EPHEMERIS_LABEL,
  type WorkScheduleRule,
} from '@ordo/shared';
import { scheduleRules, type PersonBirthday, type ScheduleType, type useBirthdayLook, type useDefaultScheduleKind, type useSubscribedSchedules, type WorkSchedule } from '../api';
import { archivedIds, unarchived } from '../../../lib/archive';
import classes from '../pages/CalendarPage.module.css';
import { inWorkspace } from './layer-label';
import { slotColumns } from './slot-columns';
import type { SlotPrint } from './calendar-pdf';

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

/** Color of the working hours (the slots without kind and without color) in the background and in their bar. */
export const WORK_HOURS_COLOR = 'var(--mantine-color-green-light)';
/** Color of the thin line of the working hours, and of the border of their slots being changed. */
export const WORK_LINE_COLOR = 'var(--mantine-color-green-6)';

/** Color of the éphémérides without kind (they have no default kind). */
export const EPHEMERIS_COLOR = 'var(--mantine-color-gray-6)';

/**
 * Schedule shown as slots: its rule (archived, or of an archived kind, in its workspace: `countedSchedules` leaves it
 * out), whether it is archived so, the color of its kind, its label, whether of another workspace, and its display.
 */
interface ScheduleSource {
  schedule: WorkSchedule | ForeignSchedule;
  rule: WorkScheduleRule;
  /** Archived, or of an archived kind, in its workspace (another one's as that workspace says). */
  archived: boolean;
  /** An éphéméride: dotted. */
  ephemeris: boolean;
  color: string | null;
  label: string;
  /** Name of its kind (« · Espace » after it for a kind of another workspace): its entry in the legend of the PDF. */
  kind: string;
  foreign: boolean;
  display: ScheduleDisplay;
}

/**
 * Name of the kind of a schedule: the label of its kind, else « Travail » for a créneau, the name of the éphémérides
 * without kind for an éphéméride.
 * @param {string | null | undefined} label Label of its kind.
 * @param {boolean} ephemeris An éphéméride.
 * @returns {string} Name.
 */
function kindName(label: string | null | undefined, ephemeris: boolean): string {
  return label || (ephemeris ? UNTYPED_EPHEMERIS_LABEL : DEFAULT_SCHEDULE_KIND_LABEL);
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
 * workspace says), the same for both; those archived so are left out unless `includeArchived` (`archived` then says
 * which ones are).
 * @param {readonly WorkSchedule[]} own Schedules of the workspace.
 * @param {readonly ForeignSchedule[]} foreign Schedules subscribed to.
 * @param {readonly ScheduleType[]} types Kinds of slots.
 * @param {DefaultKind} defaultKind Default kind of the workspace.
 * @param {boolean} includeArchived Whether the schedules archived, or of an archived kind, in their workspace are given too.
 * @returns {ScheduleSource[]} Sources.
 */
export function scheduleSources(own: readonly WorkSchedule[], foreign: readonly ForeignSchedule[], types: readonly ScheduleType[], defaultKind: DefaultKind, includeArchived: boolean): ScheduleSource[] {
  const typeOf = mapById(types);
  const archivedKinds = archivedIds(types);
  /**
   * Whether a rule is archived, or of an archived kind, in its workspace: what the slot conditions do not count.
   * @param {WorkScheduleRule} rule Rule.
   * @returns {boolean} Archived.
   */
  // eslint-disable-next-line no-restricted-syntax -- the one place a source is told archived.
  const archived = (rule: WorkScheduleRule): boolean => countedSchedules([rule]).length === 0;
  const sources: ScheduleSource[] = [
    ...own.map((schedule) => {
      // Without kind: the default kind of the workspace; an éphéméride without kind, its own look.
      const kind = (schedule.typeId ? typeOf.get(schedule.typeId) : undefined) ?? (schedule.ephemeris ? { label: UNTYPED_EPHEMERIS_LABEL, color: EPHEMERIS_COLOR, ...DEFAULT_SCHEDULE_DISPLAY } : defaultKind);
      const rule = scheduleRules([schedule], archivedKinds)[0];
      return {
        schedule,
        rule,
        archived: archived(rule),
        ephemeris: schedule.ephemeris,
        color: kind?.color ?? null,
        label: scheduleLayerLabel(schedule.label, kind?.label),
        kind: kindName(kind?.label, schedule.ephemeris),
        foreign: false,
        display: readScheduleDisplay(kind),
      };
    }),
    ...foreign.map((schedule) => {
      const rule = scheduleRules([schedule])[0];
      return {
        schedule,
        rule,
        archived: archived(rule),
        ephemeris: schedule.ephemeris,
        color: schedule.color ?? (schedule.ephemeris && !schedule.typeId ? EPHEMERIS_COLOR : null),
        label: scheduleLayerLabel(schedule.label, schedule.typeLabel, schedule.workspaceLabel),
        kind: inWorkspace(kindName(schedule.typeLabel, schedule.ephemeris), schedule.workspaceLabel),
        foreign: true,
        display: readScheduleDisplay(schedule),
      };
    }),
  ];
  return includeArchived ? sources : unarchived(sources);
}

/** A schedule shown, as its look reads it. */
interface SlotSource {
  color: string | null;
  foreign: boolean;
  /** An éphéméride: dotted. Optional. Default = false. */
  ephemeris?: boolean;
  /** Archived, or of an archived kind, in its workspace: faded. Optional. Default = false. */
  archived?: boolean;
  /** Name of its kind: its entry in the legend of the PDF. */
  kind: string;
}

/**
 * Classes telling a schedule shown apart, its pattern as `slotPattern` gives it (hatched a créneau of another workspace,
 * dotted an éphéméride), its label in italics for an éphéméride, faded as an archived event when archived (or of an
 * archived kind) in its workspace.
 * @param {{ foreign: boolean, ephemeris?: boolean, archived?: boolean }} source Schedule shown.
 * @returns {string[]} Classes.
 */
function slotLookClasses({ foreign, ephemeris = false, archived = false }: { foreign: boolean; ephemeris?: boolean; archived?: boolean }): string[] {
  const pattern = slotPattern({ foreign, ephemeris });
  return [...(pattern === 'hatched' ? [classes.subscribedSlot] : []), ...(pattern === 'dotted' ? [classes.ephemeris] : []), ...(ephemeris ? [classes.ephemerisBar] : []), ...(archived ? [classes.archived] : [])];
}

/**
 * Where a slot of a schedule shows, as its look reads it: its bar in the all-day row, the background, a thin line on
 * the left of its hours (or at the bottom of the day of the month), or the slot itself being changed.
 */
export type SlotLookPlace = SlotPlace | 'edit';

/**
 * Look of a slot of a schedule in a place, on screen and in the PDF from the same choice: its color (that of its kind,
 * the working hours without one), the lightness of its look and its pattern. A bar: light (`--onoko-planned-opacity`)
 * with its text dark and opaque; the background: light, lighter for a kind; a thin line: the full color, without
 * pattern; being changed: the full color, dashed. Hatched for a schedule of another workspace, dotted (its label in
 * italics) for an éphéméride, faded when archived (or of an archived kind) in its workspace (not while being changed).
 * @param {SlotSource} source Schedule shown.
 * @param {SlotLookPlace} place Place of the slot.
 * @param {boolean} [month] The month view (a thin line at the bottom of the day). Optional. Default = false.
 * @returns {{ event: Pick<EventInput, 'backgroundColor' | 'borderColor' | 'textColor' | 'classNames'>, print: SlotPrint }} Props of the event, and how it prints.
 */
export function slotLook(
  { color, foreign, ephemeris = false, archived = false, kind }: SlotSource,
  place: SlotLookPlace,
  month = false,
): { event: Pick<EventInput, 'backgroundColor' | 'borderColor' | 'textColor' | 'classNames'>; print: SlotPrint } {
  const pattern = slotPattern({ foreign, ephemeris });
  /**
   * How the look prints.
   * @param {string} printed Color drawn.
   * @param {SlotPrint['opacity']} opacity Lightness of the look.
   * @param {boolean} patterned Whether its pattern shows (not on a thin line).
   * @param {boolean} [faded] Faded as archived. Optional. Default = archived.
   * @returns {SlotPrint} Print.
   */
  const print = (printed: string, opacity: SlotPrint['opacity'], patterned: boolean, faded = archived): SlotPrint => ({
    legend: kind,
    color: printed,
    pattern: patterned ? pattern : null,
    opacity,
    archived: faded,
  });
  switch (place) {
    case 'bar': {
      const light = `color-mix(in srgb, ${color ?? WORK_HOURS_COLOR} calc(var(--onoko-planned-opacity) * 100%), transparent)`;
      return {
        event: { backgroundColor: light, borderColor: light, textColor: 'var(--mantine-color-text)', classNames: [classes.slotBar, ...slotLookClasses({ foreign, ephemeris, archived })] },
        print: print(color ?? WORK_HOURS_COLOR, 'planned', true),
      };
    }
    case 'background':
      return {
        event: { ...(color ? { backgroundColor: color } : {}), classNames: [color ? classes.typedSlot : classes.workHours, ...slotLookClasses({ foreign, ephemeris, archived })] },
        print: print(color ?? WORK_HOURS_COLOR, color ? 'typed' : 'planned', true),
      };
    case 'line':
      return {
        event: { backgroundColor: color ?? WORK_LINE_COLOR, classNames: [month ? classes.slotBorderBottom : classes.slotBorderLeft, ...(archived ? [classes.archived] : [])] },
        print: print(color ?? WORK_LINE_COLOR, 'full', false),
      };
    case 'edit':
      return {
        event: {
          backgroundColor: color ?? WORK_HOURS_COLOR,
          borderColor: color ?? WORK_LINE_COLOR,
          textColor: 'var(--mantine-color-text)',
          classNames: [classes.editSlot, ...slotLookClasses({ foreign, ephemeris })],
        },
        print: print(color ?? WORK_HOURS_COLOR, 'full', true, false),
      };
  }
}

/** Slots of a source as the agenda shows them: the look of its kind and its slots of the period. */
export interface ShownSlots {
  /** An éphéméride: dotted. */
  ephemeris: boolean;
  /** Archived, or of an archived kind, in its workspace (shown with « Afficher les archivés »): faded. */
  archived: boolean;
  color: string | null;
  label: string;
  kind: string;
  foreign: boolean;
  display: ScheduleDisplay;
  slots: readonly PlannedSlot[];
}

/**
 * Events of the slots of some schedules, as the agenda shows them, each placed as the display of its kind (or of the
 * subscription to it) asks (`slotPlacements`) and in its look (`slotLook`): in the week and the day, a bar at the top
 * (all-day row) and, in the time grid, their hours (the whole day for an all-day slot) or the whole day in the
 * background, or a thin line on the left of their hours; in the month, the day in the background or a thin line at
 * its bottom. Lines of several schedules on a day stand side by side (week, day) or one above the other (month), each
 * schedule with a line that day in the next lane; hours in the background at the same time share the width of the day
 * (`slotColumns`). Each carries how it prints (`print`: the PDF draws it the same, with its kind in the legend).
 * @param {readonly ShownSlots[]} sources Schedules shown, in order, with their slots.
 * @param {boolean} month The month view (else the week or the day).
 * @returns {EventInput[]} Events.
 */
export function slotEvents(sources: readonly ShownSlots[], month: boolean): EventInput[] {
  const result: EventInput[] = [];
  const lanes = new Map<string, number>();
  // Hours of slots in the background (week, day), by day: those at the same time share the width of the day.
  const columns = new Map<string, { key: string; order: number; start: string; end: string; look: EventInput }[]>();
  let order = 0;
  for (const source of sources) {
    const background = slotLook(source, 'background');
    const backgroundEvent: EventInput = { display: 'background', ...background.event, extendedProps: { print: background.print } };
    /**
     * Thin line of planned slots: a background event narrowed, in the full color (faded when archived).
     * @param {number} lane Lane of the line that day.
     * @returns {EventInput} Event props.
     */
    const line = (lane: number): EventInput => {
      const look = slotLook(source, 'line', month);
      return { display: 'background', ...look.event, extendedProps: { slotLane: lane, print: look.print } };
    };
    for (const { place, slot, wholeDay, columned, lane } of slotPlacements(source.display, month, source.slots, lanes)) {
      const day = { id: `work-day:${slot.scheduleId}:${slot.date}`, start: slot.date, end: addDays(slot.date, 1), allDay: true };
      if (place === 'bar') {
        // Its bar on the day, in the all-day row.
        const look = slotLook(source, 'bar');
        result.push({ ...day, title: source.label, editable: false, extendedProps: { kind: 'slot', print: look.print }, ...look.event });
      } else if (month) result.push(place === 'line' ? { ...day, id: `${day.id}:${lane}`, ...line(lane) } : { ...day, ...backgroundEvent });
      else if (columned) {
        const ofDay = columns.get(slot.date) ?? [];
        ofDay.push({ key: `${slot.scheduleId}:${slot.start}`, order: order++, start: slot.start, end: slot.end, look: backgroundEvent });
        columns.set(slot.date, ofDay);
      } else
        result.push({
          // The lane in the id: a line moved to another lane is drawn again (see eventDidMount). The whole day of
          // slots in the background (once a day) apart.
          id: place === 'background' && wholeDay && !slot.allDay ? `work-whole:${slot.scheduleId}:${slot.date}` : `work:${slot.scheduleId}:${slot.date}:${slot.start}:${lane}`,
          ...(wholeDay ? { start: `${slot.date}T00:00:00`, end: `${addDays(slot.date, 1)}T00:00:00` } : { start: `${slot.date}T${slot.start}:00`, end: `${slot.date}T${slot.end}:00` }),
          ...(place === 'line' ? line(lane) : backgroundEvent),
        });
    }
  }
  // Slots in the background at the same time stand side by side, each part of a slot as wide as the slots there are
  // then (alone, the whole day).
  for (const [date, slots] of columns) {
    for (const part of slotColumns(slots)) {
      result.push({
        // Its column in the id: a part placed elsewhere is drawn again (see eventDidMount).
        id: `work:${part.key}:${date}:${part.start}:${part.column}/${part.columns}`,
        start: `${date}T${part.start}:00`,
        end: `${date}T${part.end}:00`,
        ...part.look,
        classNames: [...((part.look.classNames as string[] | undefined) ?? []), classes.slotColumn],
        extendedProps: { ...(part.look.extendedProps as Record<string, unknown> | undefined), slotColumn: part.column, slotColumns: part.columns },
      });
    }
  }
  return result;
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
      // eslint-disable-next-line no-restricted-syntax -- the print of a birthday: no schedule, no look of its own.
      extendedProps: { kind: 'birthday', birthday, print: { legend: BIRTHDAY_SLOT_KIND_LABEL, color, pattern: null, opacity: 'full', archived: false } satisfies SlotPrint },
    }));
  });
}

/**
 * Whether « Celle-ci et les suivantes » is offered for an occurrence of an event: a recurring one after the first and
 * before the last occurrence its series still shows (`firstShownDate`, `lastShownDate` of the API: those deleted alone
 * left out; no last one: no end).
 * @param {{ occurrenceDate: string | null, firstShownDate: string | null, lastShownDate: string | null }} occurrence Occurrence.
 * @returns {boolean} Offered.
 */
export const followingOffered = (occurrence: { occurrenceDate: string | null; firstShownDate: string | null; lastShownDate: string | null }): boolean =>
  occurrence.occurrenceDate !== null &&
  (occurrence.firstShownDate === null || occurrence.occurrenceDate > occurrence.firstShownDate) &&
  (occurrence.lastShownDate === null || occurrence.occurrenceDate < occurrence.lastShownDate);
