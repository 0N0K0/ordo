import { describe, expect, it } from 'vitest';
import { calendarLegend, slotPattern, slotPlacements, type LegendItem } from '../../src/calendar/slot-display';
import { DEFAULT_SCHEDULE_DISPLAY, type PlannedSlot, type ScheduleDisplay } from '../../src/calendar/work-schedules';

/**
 * A planned slot.
 * @param {string} date Day.
 * @param {string} start Start (HH:MM).
 * @param {string} end End (HH:MM).
 * @param {string} [scheduleId] Schedule. Optional. Default = « a ».
 * @returns {PlannedSlot} Slot.
 */
const slot = (date: string, start: string, end: string, scheduleId = 'a'): PlannedSlot => ({ date, start, end, allDay: start === '00:00' && end === '24:00', scheduleId });

/**
 * A display, the default one changed.
 * @param {Partial<ScheduleDisplay>} changes Changes.
 * @returns {ScheduleDisplay} Display.
 */
const display = (changes: Partial<ScheduleDisplay>): ScheduleDisplay => ({ ...DEFAULT_SCHEDULE_DISPLAY, ...changes });

/**
 * Places in short: « place day start wholeDay columned lane ».
 * @param {ReturnType<typeof slotPlacements>} placements Places.
 * @returns {string[]} Short forms.
 */
const short = (placements: ReturnType<typeof slotPlacements>) => placements.map((p) => `${p.place} ${p.slot.date} ${p.slot.start}${p.wholeDay ? ' whole' : ''}${p.columned ? ' columned' : ''} ${p.lane}`);

describe('slotPattern', () => {
  it('dots an éphéméride, hatches a créneau of another workspace, leaves the others plain', () => {
    expect(slotPattern({ foreign: false })).toBeNull();
    expect(slotPattern({ foreign: true })).toBe('hatched');
    expect(slotPattern({ foreign: false, ephemeris: true })).toBe('dotted');
    expect(slotPattern({ foreign: true, ephemeris: true })).toBe('dotted');
  });
});

describe('slotPlacements', () => {
  const slots = [slot('2026-11-23', '09:00', '12:00'), slot('2026-11-23', '14:00', '18:00'), slot('2026-11-24', '00:00', '24:00')];

  it('week, default display: a bar each day, the hours side by side, an all-day slot over the whole day', () => {
    expect(short(slotPlacements(DEFAULT_SCHEDULE_DISPLAY, false, slots, new Map()))).toEqual([
      'bar 2026-11-23 09:00 whole 0',
      'background 2026-11-23 09:00 columned 0',
      'background 2026-11-23 14:00 columned 0',
      'bar 2026-11-24 00:00 whole 0',
      'background 2026-11-24 00:00 whole 0',
    ]);
  });

  it('week, whole day in the background and no bar: once a day', () => {
    expect(short(slotPlacements(display({ dayDisplay: 'DAY_BACKGROUND', dayBar: false }), false, slots, new Map()))).toEqual(['background 2026-11-23 09:00 whole 0', 'background 2026-11-24 00:00 whole 0']);
  });

  it('week, thin lines: each schedule takes the next lane of the day', () => {
    const lanes = new Map<string, number>([['2026-11-23', 1]]);
    expect(short(slotPlacements(display({ dayDisplay: 'SLOT_BORDER', dayBar: false }), false, slots, lanes))).toEqual([
      'line 2026-11-23 09:00 1',
      'line 2026-11-23 14:00 1',
      'line 2026-11-24 00:00 whole 0',
    ]);
    expect([...lanes]).toEqual([
      ['2026-11-23', 2],
      ['2026-11-24', 1],
    ]);
  });

  it('week, nothing in the hours: the bar alone', () => {
    expect(short(slotPlacements(display({ dayDisplay: 'NONE' }), false, slots, new Map()))).toEqual(['bar 2026-11-23 09:00 whole 0', 'bar 2026-11-24 00:00 whole 0']);
  });

  it('month: the day in the background, or a thin line at its bottom, or nothing; never a bar', () => {
    expect(short(slotPlacements(DEFAULT_SCHEDULE_DISPLAY, true, slots, new Map()))).toEqual(['background 2026-11-23 09:00 whole 0', 'background 2026-11-24 00:00 whole 0']);
    const lanes = new Map<string, number>();
    slotPlacements(display({ monthDisplay: 'BORDER' }), true, [slot('2026-11-23', '08:00', '09:00', 'b')], lanes);
    expect(short(slotPlacements(display({ monthDisplay: 'BORDER' }), true, slots, lanes))).toEqual(['line 2026-11-23 09:00 whole 1', 'line 2026-11-24 00:00 whole 0']);
    expect(slotPlacements(display({ monthDisplay: 'NONE' }), true, slots, new Map())).toEqual([]);
  });
});

describe('calendarLegend', () => {
  /**
   * An item of a view.
   * @param {Partial<LegendItem>} item Fields.
   * @returns {LegendItem} Item.
   */
  const item = (item: Partial<LegendItem>): LegendItem => ({ kind: 'background', allDay: false, color: '#7950f2', ...item });

  it('one entry per name, in order, the items without name left out', () => {
    const entries = calendarLegend([item({ legend: 'Garde' }), item({ kind: 'event', legend: null }), item({ legend: 'Vacances', color: '#fd7e14' }), item({ legend: 'Garde' })]);
    expect(entries.map((entry) => `${entry.name} ${entry.color}`)).toEqual(['Garde #7950f2', 'Vacances #fd7e14']);
  });

  it('the color of the items drawn as its glyph (a bar and a line of another color: the line)', () => {
    expect(calendarLegend([item({ kind: 'slot', allDay: true, legend: 'Travail', color: '#e6f4ea' }), item({ kind: 'line', legend: 'Travail', color: '#2f9e44' })])).toEqual([
      { name: 'Travail', color: '#e6f4ea', glyph: 'line', pattern: null, opacity: 1 },
    ]);
    expect(calendarLegend([item({ kind: 'slot', allDay: true, legend: 'Travail', color: '#e6f4ea' }), item({ legend: 'Travail', color: '#d3f9d8' })])[0]).toMatchObject({ glyph: 'square', color: '#d3f9d8' });
  });

  it('a square when a background or a block of hours shows the kind, with their pattern and strongest opacity', () => {
    expect(
      calendarLegend([
        item({ kind: 'slot', allDay: true, legend: 'Garde', pattern: 'hatched', opacity: 0.6 }),
        item({ legend: 'Garde', pattern: 'hatched', opacity: 0.25 }),
        item({ legend: 'Garde', pattern: 'hatched', opacity: 0.125 }),
      ]),
    ).toEqual([{ name: 'Garde', color: '#7950f2', glyph: 'square', pattern: 'hatched', opacity: 0.25 }]);
    expect(calendarLegend([item({ kind: 'slot', allDay: false, legend: 'Vacances', pattern: 'dotted' })])[0]).toMatchObject({ glyph: 'square', pattern: 'dotted', opacity: 1 });
  });

  it('a line for bars and thin lines (a thin line has no pattern)', () => {
    expect(calendarLegend([item({ kind: 'line', legend: 'Astreinte' }), item({ kind: 'slot', allDay: true, legend: 'Astreinte', pattern: 'hatched', opacity: 0.6 })])[0]).toEqual({
      name: 'Astreinte',
      color: '#7950f2',
      glyph: 'line',
      pattern: 'hatched',
      opacity: 1,
    });
    expect(calendarLegend([item({ kind: 'event', allDay: true, legend: 'Anniversaires' })])[0]).toMatchObject({ glyph: 'line', pattern: null });
  });
});
