import type { CalendarPdfKind } from './calendar';
import type { PlannedSlot, ScheduleDisplay } from './work-schedules';

/** Patterns telling slots apart, in the agenda and its PDF: hatched (another workspace), dotted (an éphéméride). */
export const SLOT_PATTERNS = ['hatched', 'dotted'] as const;
export type SlotPattern = (typeof SLOT_PATTERNS)[number];

/**
 * Pattern of a schedule shown: dotted an éphéméride (of another workspace too), hatched a créneau of another
 * workspace, none for a créneau of the workspace.
 * @param {{ foreign: boolean, ephemeris?: boolean }} source Schedule shown.
 * @returns {SlotPattern | null} Pattern, or none.
 */
export function slotPattern({ foreign, ephemeris = false }: { foreign: boolean; ephemeris?: boolean }): SlotPattern | null {
  if (ephemeris) return 'dotted';
  return foreign ? 'hatched' : null;
}

/**
 * Where a slot shows: a bar in the all-day row (week, day), in the background (the day of the month, the whole day or
 * the hours in the week and the day), or a thin line (at the bottom of the day of the month, on the left of the hours
 * in the week and the day).
 */
export type SlotPlace = 'bar' | 'background' | 'line';

/** A slot as the agenda places it. */
export interface SlotPlacement {
  place: SlotPlace;
  /** Slot shown (for what shows once a day: the first slot of the day). */
  slot: PlannedSlot;
  /** The whole day: the day of the month, or its 24 hours in the week and the day; else the hours of the slot. */
  wholeDay: boolean;
  /** Hours in the background sharing the width of the day with the others at the same time. */
  columned: boolean;
  /** Lane of a line that day, beside (or above) those of the schedules placed before (0 elsewhere). */
  lane: number;
}

/**
 * Places of the slots of a schedule, as its display asks: in the month, each day with slots in the background or as
 * a thin line at its bottom (or nothing); in the week and the day, a bar on each day with slots (`dayBar`) and their
 * hours (the whole day for an all-day slot) or the whole day in the background, or a thin line on the left of their
 * hours (or nothing). The lines of several schedules on a day take the next lane each: `lanes` (by day) is shared by
 * the schedules of a view, filled as they are placed.
 * @param {ScheduleDisplay} display Display of the kind of the schedule (or of the subscription to it).
 * @param {boolean} month The month view (else the week or the day).
 * @param {readonly PlannedSlot[]} slots Slots of the schedule, day by day.
 * @param {Map<string, number>} lanes Lanes of lines taken by day, updated.
 * @returns {SlotPlacement[]} Places.
 */
export function slotPlacements(display: ScheduleDisplay, month: boolean, slots: readonly PlannedSlot[], lanes: Map<string, number>): SlotPlacement[] {
  const lined = month ? display.monthDisplay === 'BORDER' : display.dayDisplay === 'SLOT_BORDER';
  const hours = !month && (display.dayDisplay === 'SLOT_BACKGROUND' || display.dayDisplay === 'SLOT_BORDER');
  const placements: SlotPlacement[] = [];
  const days = new Set<string>();
  let lane = 0;
  for (const slot of slots) {
    if (!days.has(slot.date)) {
      days.add(slot.date);
      if (lined) {
        lane = lanes.get(slot.date) ?? 0;
        lanes.set(slot.date, lane + 1);
      }
      const day = { slot, wholeDay: true, columned: false, lane };
      if (month) {
        if (display.monthDisplay === 'BACKGROUND') placements.push({ ...day, place: 'background' });
        else if (display.monthDisplay === 'BORDER') placements.push({ ...day, place: 'line' });
      } else {
        if (display.dayBar) placements.push({ ...day, place: 'bar' });
        if (display.dayDisplay === 'DAY_BACKGROUND') placements.push({ ...day, place: 'background' });
      }
    }
    if (!hours) continue;
    if (display.dayDisplay === 'SLOT_BORDER') placements.push({ place: 'line', slot, wholeDay: slot.allDay, columned: false, lane });
    else placements.push({ place: 'background', slot, wholeDay: slot.allDay, columned: !slot.allDay, lane });
  }
  return placements;
}

/** How a legend shows a kind: a line (bars, thin lines), or a square (backgrounds, blocks of hours). */
export type LegendGlyph = 'line' | 'square';

/** An item of a calendar view as its legend reads it. */
export interface LegendItem {
  /** Name in the legend (its kind); none: not in the legend. */
  legend?: string | null;
  kind: CalendarPdfKind;
  allDay: boolean;
  color: string;
  pattern?: SlotPattern | null;
  /** Opacity it is drawn with (0 to 1). */
  opacity?: number;
}

/** An entry of the legend of a calendar view: a kind of créneaux or éphémérides shown, and how it shows. */
export interface CalendarLegendEntry {
  name: string;
  color: string;
  glyph: LegendGlyph;
  pattern: SlotPattern | null;
  opacity: number;
}

/**
 * Glyph of an item in the legend: a square for a background or a block of hours, a line for a bar or a thin line.
 * @param {LegendItem} item Item.
 * @returns {LegendGlyph} Glyph.
 */
function legendGlyph(item: LegendItem): LegendGlyph {
  return item.kind === 'background' || (item.kind !== 'line' && !item.allDay) ? 'square' : 'line';
}

/**
 * Legend of the créneaux and éphémérides of a calendar view: one entry per name shown, in the order they come, as a
 * square when one of its items is a background or a block of hours (else a line), with the color of the first of its
 * items drawn so, their pattern and their strongest opacity.
 * @param {readonly LegendItem[]} items Items of the view.
 * @returns {CalendarLegendEntry[]} Entries.
 */
export function calendarLegend(items: readonly LegendItem[]): CalendarLegendEntry[] {
  const groups = new Map<string, LegendItem[]>();
  for (const item of items) {
    if (!item.legend) continue;
    groups.set(item.legend, [...(groups.get(item.legend) ?? []), item]);
  }
  return [...groups.values()].map((group) => {
    const glyph: LegendGlyph = group.some((item) => legendGlyph(item) === 'square') ? 'square' : 'line';
    const drawn = group.filter((item) => legendGlyph(item) === glyph);
    return {
      name: drawn[0].legend!,
      color: drawn[0].color,
      glyph,
      pattern: drawn.find((item) => item.pattern)?.pattern ?? null,
      opacity: Math.max(...drawn.map((item) => item.opacity ?? 1)),
    };
  });
}
