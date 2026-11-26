import { describe, expect, it } from 'vitest';
import {
  ALL_SCHEDULES,
  conditionAllowsAt,
  conditionBlockAt,
  conditionConstrains,
  conditionWindows,
  itemWindowsOn,
  nextConditionMoment,
  readSlotCondition,
  scheduleSlotsOn,
  unavailableScheduleIds,
  windowsAllowed,
  type SlotCondition,
  type SlotConditionItem,
} from '../../src/calendar/slot-conditions';
import { birthdaySlotId, BIRTHDAY_SLOT_KIND, foreignSlotKind } from '../../src/calendar/slot-kinds';
import type { ScheduleCase, WorkScheduleRule } from '../../src/calendar/work-schedules';
import { minutesToTime } from '../../src/dates/times';
import { schedule, scheduleCase } from './schedules';

const MONDAY = '2026-11-23';
const TUESDAY = '2026-11-24';

/**
 * Daily schedule with some hours.
 * @param {string} id Id.
 * @param {[string, string][]} ranges Hours.
 * @param {Partial<WorkScheduleRule>} [other] Other fields. Optional.
 * @returns {WorkScheduleRule} Schedule.
 */
const daily = (id: string, ranges: [string, string][], other: Partial<WorkScheduleRule> = {}): WorkScheduleRule =>
  schedule([scheduleCase({ frequency: 'DAILY' }, { times: { allDay: false, ranges: ranges.map(([start, end]) => ({ start, end })) } })], { id, ...other });

const WORK = daily('work', [
  ['09:00', '12:00'],
  ['14:00', '18:00'],
]);
const SPORT = daily('sport', [['18:00', '19:30']], { typeId: 'sport' });
const HOLIDAY = daily('holiday', [['00:00', '23:59']], { ephemeris: true, typeId: 'holidays' });

let id = 0;
const condition = (field: SlotConditionItem['field'], operator: string, value?: string[]): SlotConditionItem => ({ type: 'condition', id: `c${(id += 1)}`, field, operator, value });
const group = (combinator: 'and' | 'or', children: SlotCondition['children']): SlotCondition => ({ type: 'group', id: `g${(id += 1)}`, combinator, children });

/**
 * Windows a condition allows on a day, as « HH:MM–HH:MM » (« – » ends: the start or the end of the day).
 * @param {SlotCondition | null} node Condition.
 * @param {WorkScheduleRule[]} rules Schedules.
 * @param {string} [date] Day. Optional. Default = MONDAY.
 * @returns {string[] | null} Windows, null: anywhere.
 */
const windows = (node: SlotCondition | null, rules: WorkScheduleRule[] = [WORK, SPORT, HOLIDAY], date = MONDAY) => {
  const slotsOn = scheduleSlotsOn(rules);
  return conditionWindows(node, (query) => slotsOn(query, date))?.map((window) => `${window.fromTime ?? ''}–${window.dueTime ?? ''}`) ?? null;
};

describe('conditionWindows', () => {
  it('no condition, nothing unavailable: anywhere', () => {
    expect(windows(null)).toBeNull();
  });

  it('schedules in: their hours; notIn: out of them', () => {
    expect(windows(group('and', [condition('schedules', 'in', ['work'])]))).toEqual(['09:00–12:00', '14:00–18:00']);
    expect(windows(group('and', [condition('schedules', 'notIn', ['work'])]))).toEqual(['–09:00', '12:00–14:00', '18:00–']);
  });

  it('hours that meet are merged; ending at 23:59 lasts to the end of the day', () => {
    expect(windows(group('or', [condition('schedules', 'in', ['work', 'sport'])]))).toEqual(['09:00–12:00', '14:00–19:30']);
    expect(windows(group('and', [condition('schedules', 'in', ['holiday'])]))).toEqual(['–']);
  });

  it('kinds in: the schedules of those kinds; « default » the schedules without kind', () => {
    expect(windows(group('and', [condition('kinds', 'in', ['sport'])]))).toEqual(['18:00–19:30']);
    expect(windows(group('and', [condition('kinds', 'in', ['default'])]))).toEqual(['09:00–12:00', '14:00–18:00']);
  });

  it('a kind without any schedule allows no moment with in, every moment with notIn', () => {
    expect(windows(group('and', [condition('kinds', 'in', ['nothing'])]))).toEqual([]);
    expect(windows(group('and', [condition('kinds', 'notIn', ['nothing'])]))).toEqual(['–']);
  });

  it('free time: out of every créneau of the workspace, éphémérides left out', () => {
    expect(windows(group('and', [condition('freeTime', 'isEmpty')]))).toEqual(['–09:00', '12:00–14:00', '19:30–']);
  });

  it('free time but some: out of every créneau but those named', () => {
    expect(windows(group('and', [condition('freeTime', 'notIn', ['sport'])]))).toEqual(['–09:00', '12:00–14:00', '18:00–']);
  });

  it('« et » intersects, « ou » unites', () => {
    const notSport = condition('schedules', 'notIn', ['sport']);
    expect(windows(group('and', [condition('kinds', 'in', ['default']), condition('schedules', 'notIn', ['work'])]))).toEqual([]);
    expect(windows(group('and', [condition('freeTime', 'isEmpty'), notSport]))).toEqual(['–09:00', '12:00–14:00', '19:30–']);
    expect(windows(group('or', [condition('schedules', 'in', ['sport']), condition('freeTime', 'isEmpty')]))).toEqual(['–09:00', '12:00–14:00', '18:00–']);
  });

  it('an empty group in a « ou » allows anywhere', () => {
    expect(windows(group('or', [condition('schedules', 'in', ['sport']), group('and', [])]))).toBeNull();
  });

  it('an empty group in a « et » takes nothing away', () => {
    expect(windows(group('and', [condition('schedules', 'in', ['sport']), group('or', [])]))).toEqual(['18:00–19:30']);
  });

  it('an empty root group allows anywhere', () => {
    expect(windows(group('and', []))).toBeNull();
  });

  it('slots « Indisponible » are always taken out, with or without a condition', () => {
    const sleep = daily('sleep', [['00:00', '07:00']], { unavailable: true });
    expect(windows(null, [WORK, sleep])).toEqual(['07:00–']);
    expect(windows(group('and', [condition('freeTime', 'isEmpty')]), [WORK, sleep])).toEqual(['07:00–09:00', '12:00–14:00', '18:00–']);
  });

  it('archived schedules and those of an archived kind give no moment, nor take any from the free time', () => {
    const archived = { ...WORK, archived: true };
    expect(windows(group('and', [condition('schedules', 'in', ['work'])]), [archived])).toEqual([]);
    expect(windows(group('and', [condition('schedules', 'notIn', ['work'])]), [archived])).toEqual(['–']);
    expect(windows(group('and', [condition('freeTime', 'isEmpty')]), [{ ...WORK, kindArchived: true }])).toEqual(['–']);
  });
});

describe('scheduleSlotsOn: what a condition can name', () => {
  it('schedules of another workspace count where named (or their kind), never in the free time', () => {
    const slotsOn = scheduleSlotsOn([WORK], [{ workspaceId: 'perso', rule: SPORT }]);
    expect(slotsOn({ ids: ['sport'] }, MONDAY)).toHaveLength(1);
    expect(slotsOn({ kinds: [foreignSlotKind('perso', 'sport')] }, MONDAY)).toHaveLength(1);
    expect(slotsOn({ ids: [ALL_SCHEDULES] }, MONDAY).map((slot) => slot.scheduleId)).toEqual(['work', 'work']);
  });

  it('a birthday is a whole day, named by its person or by the kind of every birthday; an archived person gives none', () => {
    const slotsOn = scheduleSlotsOn([], [], [{ id: 'contributor:ana', birthDate: '1990-11-23', aliases: ['relation:ana'] }, { id: 'relation:bob', birthDate: '--11-23', archived: true }]);
    expect(slotsOn({ ids: [birthdaySlotId('contributor:ana')] }, MONDAY)).toEqual([{ date: MONDAY, start: '00:00', end: '24:00', allDay: true, scheduleId: 'birthday:contributor:ana' }]);
    expect(slotsOn({ ids: [birthdaySlotId('relation:ana')] }, MONDAY)).toHaveLength(1);
    expect(slotsOn({ kinds: [BIRTHDAY_SLOT_KIND] }, MONDAY)).toHaveLength(1);
    expect(slotsOn({ kinds: [BIRTHDAY_SLOT_KIND] }, TUESDAY)).toEqual([]);
  });
});

describe('conditionConstrains', () => {
  it('a « ou » limits only when each choice does; a « et » when one does', () => {
    const sport = condition('schedules', 'in', ['sport']);
    expect(conditionConstrains(null)).toBe(false);
    expect(conditionConstrains(group('or', [sport, group('and', [])]))).toBe(false);
    expect(conditionConstrains(group('and', [sport, group('and', [])]))).toBe(true);
    expect(conditionConstrains(group('and', [condition('freeTime', 'isEmpty')]))).toBe(true);
  });
});

describe('slotConditionSchema', () => {
  it('schedules and kinds take in / notIn; free time isEmpty / notIn', () => {
    expect(readSlotCondition(group('and', [condition('schedules', 'in', ['work'])]))).not.toBeNull();
    expect(readSlotCondition(group('and', [condition('freeTime', 'isEmpty')]))).not.toBeNull();
    expect(readSlotCondition(group('and', [condition('freeTime', 'in', ['work'])]))).toBeNull();
    expect(readSlotCondition({ nope: true })).toBeNull();
  });
});

describe('a moment of a task or a routine', () => {
  const slotsOn = scheduleSlotsOn([WORK, SPORT, daily('lunch', [['12:00', '13:00']], { unavailable: true })]);
  const inWork = group('and', [condition('schedules', 'in', ['work'])]);
  const hours = [scheduleCase({ weekdays: [1] }, { times: { allDay: false, ranges: [{ start: '10:00', end: '11:00' }] } })];

  it('allowed by its own hours, its condition and out of the unavailable slots; the first reason that fails', () => {
    expect(conditionAllowsAt(inWork, slotsOn, MONDAY, '10:30', hours)).toBe(true);
    expect(conditionBlockAt(inWork, slotsOn, MONDAY, '09:30', hours)).toBe('hours');
    expect(conditionBlockAt(inWork, slotsOn, MONDAY, '13:00')).toBe('slots');
    expect(conditionBlockAt(null, slotsOn, MONDAY, '12:30')).toBe('unavailable');
    expect(conditionBlockAt(inWork, slotsOn, MONDAY, '12:00')).toBe('slots');
  });

  it('the end of a window is excluded', () => {
    expect(conditionAllowsAt(inWork, slotsOn, MONDAY, '12:00')).toBe(false);
    expect(conditionAllowsAt(inWork, slotsOn, MONDAY, '11:59')).toBe(true);
  });

  it('nextConditionMoment: the moment itself when allowed, else the next start allowed, over the following days', () => {
    expect(nextConditionMoment(inWork, slotsOn, MONDAY, '10:00', 3)).toEqual({ date: MONDAY, time: '10:00' });
    expect(nextConditionMoment(inWork, slotsOn, MONDAY, '12:30', 3)).toEqual({ date: MONDAY, time: '14:00' });
    expect(nextConditionMoment(inWork, slotsOn, MONDAY, '18:30', 3)).toEqual({ date: TUESDAY, time: '09:00' });
    expect(nextConditionMoment(inWork, slotsOn, MONDAY, '10:30', 3, hours)).toEqual({ date: MONDAY, time: '10:30' });
    // Its hours are on Mondays only: none in the 3 days looked at.
    expect(nextConditionMoment(inWork, slotsOn, MONDAY, '11:00', 3, hours)).toBeNull();
    expect(nextConditionMoment(null, slotsOn, MONDAY, '12:15', 1)).toEqual({ date: MONDAY, time: '13:00' });
  });

  it('windowsAllowed cuts a moment to the windows allowed', () => {
    expect(windowsAllowed({ fromTime: '08:00', dueTime: '15:00' }, [{ fromTime: '09:00', dueTime: '12:00' }, { fromTime: '14:00', dueTime: '18:00' }])).toEqual([
      { fromTime: '09:00', dueTime: '12:00' },
      { fromTime: '14:00', dueTime: '15:00' },
    ]);
    expect(windowsAllowed({ fromTime: null, dueTime: '10:00' }, null)).toEqual([{ fromTime: null, dueTime: '10:00' }]);
  });

  it('unavailableScheduleIds: the unavailable schedules met at a moment or during a period', () => {
    expect(unavailableScheduleIds(slotsOn, { date: MONDAY, time: '12:30' })).toEqual(['lunch']);
    expect(unavailableScheduleIds(slotsOn, { date: MONDAY, time: '13:00' })).toEqual([]);
    expect(unavailableScheduleIds(slotsOn, { date: MONDAY, time: '11:00' }, { date: MONDAY, time: '12:00' })).toEqual([]);
    expect(unavailableScheduleIds(slotsOn, { date: MONDAY, time: '11:00' }, { date: MONDAY, time: '12:01' })).toEqual(['lunch']);
  });
});

describe('itemWindowsOn: windows of a day an item can be done in', () => {
  const lunch = daily('lunch', [['12:00', '13:00']], { unavailable: true });
  const night = daily('night', [['22:00', '23:59']], { unavailable: true });
  const allDayOff = schedule([scheduleCase({ frequency: 'DAILY' }, { times: { allDay: true, ranges: [] } })], { id: 'off', unavailable: true, startDate: '2026-03-29', endDate: '2026-03-29' });
  const mondayMorning = [scheduleCase({ weekdays: [1] }, { times: { allDay: false, ranges: [{ start: '08:00', end: '10:30' }] } })];
  const wholeMonday = [scheduleCase({ weekdays: [1] }, { times: { allDay: true, ranges: [] } })];
  const label = (list: ReturnType<typeof itemWindowsOn>) => list?.map((window) => `${window.fromTime ?? ''}–${window.dueTime ?? ''}`) ?? null;

  it('its own hours, its condition and the unavailable slots meet', () => {
    const slotsOn = scheduleSlotsOn([WORK, SPORT, lunch]);
    expect(label(itemWindowsOn(group('and', [condition('schedules', 'in', ['work'])]), slotsOn, MONDAY, mondayMorning))).toEqual(['09:00–10:30']);
    expect(label(itemWindowsOn(null, slotsOn, MONDAY, mondayMorning))).toEqual(['08:00–10:30']);
    expect(label(itemWindowsOn(null, slotsOn, MONDAY))).toEqual(['–12:00', '13:00–']);
    expect(label(itemWindowsOn(group('and', [condition('freeTime', 'isEmpty')]), slotsOn, MONDAY))).toEqual(['–09:00', '13:00–14:00', '19:30–']);
    // Its hours are on Mondays: never on Tuesday.
    expect(label(itemWindowsOn(null, slotsOn, TUESDAY, mondayMorning))).toEqual([]);
  });

  it('null when nothing limits it: no hours, no condition (or an empty group), nothing unavailable', () => {
    const slotsOn = scheduleSlotsOn([WORK]);
    expect(itemWindowsOn(null, slotsOn, MONDAY)).toBeNull();
    expect(itemWindowsOn(group('and', []), slotsOn, MONDAY)).toBeNull();
    expect(label(itemWindowsOn(null, slotsOn, MONDAY, wholeMonday))).toEqual(['–']);
  });

  // The same moments as conditionAllowsAt, minute by minute, on ordinary days and on the days the clock changes in Paris.
  const fixtures: { name: string; rules: WorkScheduleRule[]; condition: SlotCondition | null; hours: ScheduleCase[] }[] = [
    { name: 'nothing', rules: [WORK], condition: null, hours: [] },
    { name: 'on work', rules: [WORK, SPORT, lunch], condition: group('and', [condition('schedules', 'in', ['work'])]), hours: [] },
    { name: 'out of work, own hours', rules: [WORK, SPORT, lunch, night], condition: group('and', [condition('schedules', 'notIn', ['work'])]), hours: mondayMorning },
    { name: 'free time or sport', rules: [WORK, SPORT, HOLIDAY, night], condition: group('or', [condition('freeTime', 'isEmpty'), condition('kinds', 'in', ['sport'])]), hours: [] },
    { name: 'a « et » with an empty group', rules: [WORK, SPORT, lunch], condition: group('and', [group('or', []), condition('schedules', 'in', ['sport', 'work'])]), hours: wholeMonday },
    { name: 'a kind without schedule', rules: [WORK], condition: group('and', [condition('kinds', 'in', ['nothing'])]), hours: [] },
    { name: 'unavailable the whole day', rules: [WORK, allDayOff], condition: null, hours: [] },
    { name: 'own hours alone, a slot up to 23:59', rules: [night], condition: null, hours: [scheduleCase({ frequency: 'DAILY' }, { times: { allDay: false, ranges: [{ start: '06:15', end: '07:45' }, { start: '21:00', end: '23:59' }] } })] },
  ];
  const days = [MONDAY, TUESDAY, '2026-03-29', '2026-10-25'];
  for (const fixture of fixtures)
    it(`moment by moment as conditionAllowsAt: ${fixture.name}`, () => {
      const slotsOn = scheduleSlotsOn(fixture.rules);
      for (const day of days) {
        const list = itemWindowsOn(fixture.condition, slotsOn, day, fixture.hours);
        // In order, without overlap.
        list?.forEach((window, index) => {
          if (index) expect((list[index - 1].dueTime ?? '24:00') < (window.fromTime ?? '00:00')).toBe(true);
        });
        for (let minute = 0; minute < 24 * 60; minute++) {
          const time = minutesToTime(minute);
          const inside = list === null || list.some((window) => (window.fromTime ?? '00:00') <= time && time < (window.dueTime ?? '24:00'));
          if (inside !== conditionAllowsAt(fixture.condition, slotsOn, day, time, fixture.hours)) expect({ day, time, inside }).toBeNull();
        }
      }
    });
});
