import { describe, expect, it } from 'vitest';
import {
  routineBulkDoneAt,
  routineCountsOn,
  routineDoneDay,
  routineDayEntries,
  routineGroupIds,
  routineGroupStatesOn,
  routineSlotShownOn,
  routineTickPrefill,
  type RoutineDayRoutine,
  type RoutineTickOccurrence,
  type RoutineTickSlot,
} from '../../src/routines/routine-ticks';
import { caseSpans } from '../../src/dates/repetition';
import { routineOpenDate } from '../../src/routines/routines';
import { conditionWindows, scheduleSlotsOn, windowsAllowed, type SlotCondition } from '../../src/calendar/slot-conditions';
import { rule } from '../rules';
import { schedule, scheduleCase } from '../calendar/schedules';

/** 25 Nov 2026, 14:30 in Paris (UTC+1 in winter). */
const NOW = new Date('2026-11-25T13:30:00Z');

describe('routineTickPrefill', () => {
  it('proposes now while its scheduled time is still to come', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: '18:00' }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes its scheduled time (« jusqu’à », else « dès ») once past', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: '07:00', dueTime: '09:00' }, NOW)).toEqual({ day: '2026-11-25', time: '09:00' });
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: '07:00', dueTime: null }, NOW)).toEqual({ day: '2026-11-25', time: '07:00' });
  });

  it('proposes now without any time', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: null }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes the due day at its time when late, now without time', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-20', fromTime: null, dueTime: '08:00' }, NOW)).toEqual({ day: '2026-11-20', time: '08:00' });
    expect(routineTickPrefill({ dueDate: '2026-11-20', fromTime: null, dueTime: null }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes now for an occurrence open and due later', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: '08:00' }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes the day it is ticked from: its scheduled time, else the time of now', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: '08:00' }, NOW, '2026-11-05')).toEqual({ day: '2026-11-05', time: '08:00' });
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: null }, NOW, '2026-11-05')).toEqual({ day: '2026-11-05', time: '14:30' });
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: '18:00' }, NOW, '2026-11-25')).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('reads the day and the time in Paris, whatever the zone of the instant', () => {
    // 23:30 UTC on 24 Nov is already 25 Nov, 00:30 in Paris.
    const lateNight = new Date('2026-11-24T23:30:00Z');
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: null }, lateNight)).toEqual({ day: '2026-11-25', time: '00:30' });
    // « jusqu’à 00:15 » on 25 Nov in Paris is 24 Nov, 23:15 UTC: past.
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: '00:15' }, lateNight)).toEqual({ day: '2026-11-25', time: '00:15' });
    // Summer time (UTC+2): 08:00 in Paris is 06:00 UTC.
    expect(routineTickPrefill({ dueDate: '2026-07-01', fromTime: null, dueTime: '08:00' }, new Date('2026-07-01T06:30:00Z'))).toEqual({ day: '2026-07-01', time: '08:00' });
    expect(routineTickPrefill({ dueDate: '2026-07-01', fromTime: null, dueTime: '09:00' }, new Date('2026-07-01T06:30:00Z'))).toEqual({ day: '2026-07-01', time: '08:30' });
  });
});

describe('routineSlotShownOn', () => {
  const open = { startDate: '2026-11-01', dueDate: '2026-11-28' };

  it('shows a done time of the day on the day it was done, not on its due day', () => {
    const doneAt = '2026-11-05T09:00:00Z';
    expect(routineSlotShownOn(open, doneAt, '2026-11-05')).toBe(true);
    expect(routineSlotShownOn(open, doneAt, '2026-11-28')).toBe(false);
    expect(routineSlotShownOn(open, doneAt, '2026-11-01')).toBe(false);
  });

  it('shows a done time of the day on the day it was done even out of its opening (late)', () => {
    expect(routineSlotShownOn({ startDate: '2026-11-20', dueDate: '2026-11-20' }, new Date('2026-11-22T10:00:00Z'), '2026-11-22')).toBe(true);
  });

  it('shows one not done on each day of its opening, up to its due day', () => {
    expect(routineSlotShownOn(open, null, '2026-10-31')).toBe(false);
    expect(routineSlotShownOn(open, null, '2026-11-01')).toBe(true);
    expect(routineSlotShownOn(open, null, '2026-11-15')).toBe(true);
    expect(routineSlotShownOn(open, null, '2026-11-28')).toBe(true);
    expect(routineSlotShownOn(open, null, '2026-11-29')).toBe(false);
  });

  it('reads the day it was done in Paris', () => {
    // 23:30 UTC on 4 Nov is 5 Nov, 00:30 in Paris.
    expect(routineSlotShownOn(open, '2026-11-04T23:30:00Z', '2026-11-05')).toBe(true);
    expect(routineSlotShownOn(open, '2026-11-04T23:30:00Z', '2026-11-04')).toBe(false);
  });

  it('never shows a cancelled occurrence', () => {
    expect(routineSlotShownOn({ ...open, cancelled: true }, null, '2026-11-05')).toBe(false);
    expect(routineSlotShownOn({ ...open, cancelled: true }, '2026-11-05T09:00:00Z', '2026-11-05')).toBe(false);
  });
});

describe('routineBulkDoneAt', () => {
  it('takes the day chosen at its scheduled time (« jusqu’à », else « dès »)', () => {
    expect(routineBulkDoneAt('2026-11-20', { fromTime: '07:00', dueTime: '09:00' }, NOW).toISOString()).toBe('2026-11-20T08:00:00.000Z');
    expect(routineBulkDoneAt('2026-11-20', { fromTime: '07:00', dueTime: null }, NOW).toISOString()).toBe('2026-11-20T06:00:00.000Z');
  });

  it('takes now today and noon another day without any time', () => {
    expect(routineBulkDoneAt('2026-11-25', { fromTime: null, dueTime: null }, NOW)).toEqual(NOW);
    expect(routineBulkDoneAt('2026-11-20', { fromTime: null, dueTime: null }, NOW).toISOString()).toBe('2026-11-20T11:00:00.000Z');
  });

  it('never gives a time still to come: now instead', () => {
    expect(routineBulkDoneAt('2026-11-25', { fromTime: null, dueTime: '18:00' }, NOW)).toEqual(NOW);
    expect(routineBulkDoneAt('2026-11-26', { fromTime: null, dueTime: null }, NOW)).toEqual(NOW);
  });

  it('reads the day and its time in Paris (summer time)', () => {
    expect(routineBulkDoneAt('2026-07-01', { fromTime: null, dueTime: '08:00' }, NOW).toISOString()).toBe('2026-07-01T06:00:00.000Z');
  });
});

const DAY = '2026-11-25';

/**
 * A routine of a test, its current occurrence on the day.
 * @param {string} id Id.
 * @param {string | null} [parentId] Parent. Optional. Default = none.
 * @param {Partial<RoutineDayRoutine>} [fields] Other fields. Optional.
 * @returns {RoutineDayRoutine} Routine.
 */
const routine = (id: string, parentId: string | null = null, fields: Partial<RoutineDayRoutine> = {}): RoutineDayRoutine => ({
  id,
  parentId,
  archived: false,
  currentDate: DAY,
  currentDueDate: DAY,
  done: false,
  slots: [],
  ...fields,
});

/**
 * A time of the day of a test.
 * @param {number} index Rank.
 * @param {boolean} done Ticked.
 * @param {Partial<RoutineTickSlot>} [fields] Other fields. Optional.
 * @returns {RoutineTickSlot} Time of the day.
 */
const slot = (index: number, done: boolean, fields: Partial<RoutineTickSlot> = {}): RoutineTickSlot => ({ index, optional: false, doneAt: done ? '2026-11-25T08:00:00Z' : null, ...fields });

/**
 * An occurrence of a test, open and due on the day.
 * @param {string} routineId Routine.
 * @param {RoutineTickSlot[]} slots Times of the day.
 * @param {Partial<RoutineTickOccurrence>} [fields] Other fields. Optional.
 * @returns {RoutineTickOccurrence} Occurrence.
 */
const occurrence = (routineId: string, slots: RoutineTickSlot[], fields: Partial<RoutineTickOccurrence> = {}): RoutineTickOccurrence => ({
  routineId,
  date: DAY,
  startDate: DAY,
  dueDate: DAY,
  slots,
  ...fields,
});

describe('routineGroupIds', () => {
  it('a routine with a sub-routine not archived is a group', () => {
    expect(routineGroupIds([routine('p'), routine('a', 'p')])).toEqual(new Set(['p']));
  });

  it('a routine whose sub-routines are all archived is an ordinary one again', () => {
    expect(routineGroupIds([routine('p'), routine('a', 'p', { archived: true })])).toEqual(new Set());
  });
});

describe('routineGroupStatesOn', () => {
  const tree = [routine('p'), routine('a', 'p'), routine('b', 'p'), routine('c', 'p')];

  it('a group is present only on a day one of its sub-routines counts', () => {
    expect(routineGroupStatesOn(tree, [], DAY).has('p')).toBe(false);
    // Opened later, or due before: it does not count.
    const outside = [occurrence('a', [slot(0, false)], { startDate: '2026-11-26', dueDate: '2026-11-28' }), occurrence('b', [slot(0, false)], { startDate: '2026-11-20', dueDate: '2026-11-24' })];
    expect(routineGroupStatesOn(tree, outside, DAY).has('p')).toBe(false);
  });

  it('a sub-routine counts on each day of its window until done, then on its done day only', () => {
    const open = (doneAt: string | null) => [occurrence('a', [slot(0, false, { doneAt })], { startDate: '2026-11-23', dueDate: '2026-11-27' })];
    // Not done: from its « Ouverture » to its due day.
    for (const day of ['2026-11-23', '2026-11-25', '2026-11-27']) expect(routineGroupStatesOn(tree, open(null), day).get('p')).toMatchObject({ counted: 1, done: 0 });
    expect(routineGroupStatesOn(tree, open(null), '2026-11-22').has('p')).toBe(false);
    expect(routineGroupStatesOn(tree, open(null), '2026-11-28').has('p')).toBe(false);
    // Done on the 25th (in Paris): counted that day only, as done; neither the days before (nothing to tick) nor after.
    const done = open('2026-11-25T08:00:00Z');
    expect(routineGroupStatesOn(tree, done, '2026-11-23').has('p')).toBe(false);
    expect(routineGroupStatesOn(tree, done, '2026-11-24').has('p')).toBe(false);
    expect(routineGroupStatesOn(tree, done, DAY).get('p')).toMatchObject({ counted: 1, done: 1, complete: true });
    expect(routineGroupStatesOn(tree, done, '2026-11-26').has('p')).toBe(false);
    expect(routineGroupStatesOn(tree, done, '2026-11-27').has('p')).toBe(false);
  });

  it('a sub-routine opened and due the same day counts that day only', () => {
    expect(routineGroupStatesOn(tree, [occurrence('a', [slot(0, false)])], DAY).get('p')).toMatchObject({ counted: 1, done: 0 });
    expect(routineGroupStatesOn(tree, [occurrence('a', [slot(0, false)])], '2026-11-24').has('p')).toBe(false);
    expect(routineGroupStatesOn(tree, [occurrence('a', [slot(0, false)])], '2026-11-26').has('p')).toBe(false);
  });

  it('a cancelled occurrence does not count', () => {
    expect(routineGroupStatesOn(tree, [occurrence('a', [slot(0, false)], { cancelled: true })], DAY).has('p')).toBe(false);
  });

  it('counts the sub-routines due done out of those due (« 2/3 »), done once all are', () => {
    const occurrences = [occurrence('a', [slot(0, true)]), occurrence('b', [slot(0, true)]), occurrence('c', [slot(0, false)])];
    expect(routineGroupStatesOn(tree, occurrences, DAY).get('p')).toMatchObject({ counted: 3, done: 2, complete: false });
    const all = [occurrence('a', [slot(0, true)]), occurrence('b', [slot(0, true)]), occurrence('c', [slot(0, true)])];
    expect(routineGroupStatesOn(tree, all, DAY).get('p')).toMatchObject({ counted: 3, done: 3, complete: true });
  });

  it('a sub-routine is done once every required moment of its occurrence is ticked, that day or before', () => {
    const window = { startDate: '2026-11-23', dueDate: '2026-11-27' };
    const occurrences = [
      // One moment ticked the day before, the other that day: done.
      occurrence('a', [slot(0, true, { doneAt: '2026-11-24T08:00:00Z' }), slot(1, true)], window),
      // One moment ticked the day before, the other not: still counted, not done.
      occurrence('b', [slot(0, true, { doneAt: '2026-11-24T08:00:00Z' }), slot(1, false)], window),
      // Done after that day (a past day shown again): it does not count that day.
      occurrence('c', [slot(0, true, { doneAt: '2026-11-26T08:00:00Z' })], window),
      // Not done, a moment ticked after that day: counted, that moment not done that day.
      occurrence('c', [slot(0, true, { doneAt: '2026-11-26T08:00:00Z' }), slot(1, false)], { ...window, date: '2026-11-26' }),
    ];
    expect(routineGroupStatesOn(tree, occurrences, DAY).get('p')).toMatchObject({ counted: 3, done: 1, complete: false });
  });

  it('a sub-routine with optional moments only does not count', () => {
    expect(routineGroupStatesOn(tree, [occurrence('a', [slot(0, false, { optional: true })])], DAY).has('p')).toBe(false);
  });

  it('a sub-routine ticked before its « Ouverture » counts on its first day, as done', () => {
    const early = [occurrence('a', [slot(0, true, { doneAt: '2026-11-20T08:00:00Z' })], { startDate: '2026-11-23', dueDate: '2026-11-27' })];
    expect(routineGroupStatesOn(tree, early, '2026-11-23').get('p')).toMatchObject({ counted: 1, done: 1 });
    expect(routineGroupStatesOn(tree, early, '2026-11-24').has('p')).toBe(false);
  });

  it('optional moments do not count', () => {
    const occurrences = [occurrence('a', [slot(0, true), slot(1, false, { optional: true })])];
    const state = routineGroupStatesOn(tree, occurrences, DAY).get('p');
    expect(state).toMatchObject({ counted: 1, done: 1, complete: true });
    expect(state?.moments.map((moment) => moment.index)).toEqual([0]);
  });

  it('moment M is done once every sub-routine due having it did it', () => {
    const occurrences = [
      occurrence('a', [slot(0, true, { fromTime: '08:00' }), slot(1, false, { fromTime: '12:00' })]),
      occurrence('b', [slot(0, true), slot(1, true)]),
      // Without moment 2: moment 2 of the group is that of « a » alone.
      occurrence('c', [slot(0, false), slot(1, true), slot(2, true)]),
    ];
    expect(routineGroupStatesOn(tree, occurrences, DAY).get('p')?.moments).toEqual([
      { index: 0, fromTime: '08:00', dueTime: null, done: false },
      { index: 1, fromTime: '12:00', dueTime: null, done: false },
      { index: 2, fromTime: null, dueTime: null, done: true },
    ]);
  });

  it('two occurrences of a sub-routine due the same day must both be done', () => {
    const occurrences = [occurrence('a', [slot(0, true)]), occurrence('a', [slot(0, false)], { date: '2026-11-24' })];
    expect(routineGroupStatesOn(tree, occurrences, DAY).get('p')).toMatchObject({ counted: 1, done: 0 });
  });

  it('archived sub-routines do not count', () => {
    const routines = [routine('p'), routine('a', 'p'), routine('b', 'p', { archived: true })];
    const occurrences = [occurrence('a', [slot(0, true)]), occurrence('b', [slot(0, false)])];
    expect(routineGroupStatesOn(routines, occurrences, DAY).get('p')).toMatchObject({ counted: 1, done: 1, complete: true });
  });

  it('a sub-routine that is a group counts by its own sub-routines, never by its own ticks', () => {
    const routines = [routine('p'), routine('g', 'p'), routine('a', 'g'), routine('b', 'p')];
    // Ticks of « g » itself, of before it had sub-routines: not read.
    const occurrences = [occurrence('g', [slot(0, true)]), occurrence('a', [slot(0, false)]), occurrence('b', [slot(0, true)])];
    const states = routineGroupStatesOn(routines, occurrences, DAY);
    expect(states.get('g')).toMatchObject({ counted: 1, done: 0 });
    expect(states.get('p')).toMatchObject({ counted: 2, done: 1, complete: false });
  });
});

describe('routineDoneDay', () => {
  it('is the day (in Paris) of the last required moment ticked, once all are', () => {
    const at = (slots: RoutineTickSlot[]) => routineDoneDay({ startDate: '2026-11-20', slots });
    expect(at([slot(0, true, { doneAt: '2026-11-23T08:00:00Z' }), slot(1, true, { doneAt: '2026-11-24T23:30:00Z' })])).toBe('2026-11-25');
    expect(at([slot(0, true), slot(1, false)])).toBeNull();
    expect(at([slot(0, true), slot(1, false, { optional: true })])).toBe(DAY);
    expect(at([])).toBeNull();
    expect(at([slot(0, true, { optional: true })])).toBeNull();
  });
});

describe('routineCountsOn', () => {
  it('never counts a cancelled occurrence', () => {
    expect(routineCountsOn(occurrence('a', [slot(0, false)], { cancelled: true }), DAY)).toBe(false);
  });
});

describe('routineDayEntries', () => {
  it('lists the optional moments not done of a sub-routine done before that day', () => {
    const slots = [slot(0, true, { doneAt: '2026-11-24T08:00:00Z' }), slot(1, false, { optional: true })];
    const occurrences = [occurrence('a', slots, { startDate: '2026-11-23', dueDate: '2026-11-27' })];
    expect(routineDayEntries([routine('p'), routine('a', 'p')], occurrences, DAY, { today: DAY }).map((entry) => entry.slot.index)).toEqual([1]);
  });

  it('never lists a group, nor its ticks; lists it again once it has no sub-routine not archived', () => {
    const occurrences = [occurrence('p', [slot(0, true)]), occurrence('a', [slot(0, false)])];
    const listed = (routines: RoutineDayRoutine[]) => routineDayEntries(routines, occurrences, DAY, { today: DAY }).map((entry) => entry.routine.id);
    expect(listed([routine('p'), routine('a', 'p')])).toEqual(['a']);
    expect(listed([routine('p'), routine('a', 'p', { archived: true })])).toEqual(['p']);
  });

  it('lists a cancelled occurrence on its due day only, and today the late ones within the hours allowed', () => {
    const late = routine('l', null, { currentDate: '2026-11-20', currentDueDate: '2026-11-20', slots: [slot(0, false, { fromTime: '08:00', dueTime: '09:00' }), slot(1, false, { optional: true })] });
    const occurrences = [occurrence('a', [slot(0, false)], { cancelled: true, startDate: '2026-11-20' })];
    const entries = routineDayEntries([routine('a'), late], occurrences, DAY, { today: DAY, allowedToday: () => null });
    expect(entries.map((entry) => [entry.routine.id, entry.late])).toEqual([
      ['a', false],
      ['l', true],
    ]);
    // Nothing allowed today: the late one is not listed; another day, no late one.
    expect(routineDayEntries([late], [], DAY, { today: DAY, allowedToday: () => [] })).toEqual([]);
    expect(routineDayEntries([late], [], '2026-11-24', { today: DAY, allowedToday: () => null })).toEqual([]);
    expect(routineDayEntries([routine('a')], occurrences, '2026-11-21', { today: DAY })).toEqual([]);
  });
});

describe('a weekly routine opened the day before, on a slot of its due days only', () => {
  // Every week on Wednesday and Sunday from Tuesday 1 September 2026, opened 1 day before, from 08:30 to 20:30 on the
  // slot « Entretien de la maison » (Wednesday and Sunday, 08:30–20:30); « Repas » every day, 12:30–13:30.
  const TUESDAY = '2026-09-01';
  const WEDNESDAY = '2026-09-02';
  const weekly = rule({ weekdays: [3, 7] });
  const upkeep = schedule([scheduleCase({ weekdays: [3, 7] }, { times: { allDay: false, ranges: [{ start: '08:30', end: '20:30' }] } })], { id: 'upkeep', startDate: TUESDAY });
  const meal = schedule([scheduleCase({ frequency: 'DAILY' }, { times: { allDay: false, ranges: [{ start: '12:30', end: '13:30' }] } })], { id: 'meal', startDate: TUESDAY });
  const onUpkeep: SlotCondition = { type: 'group', id: 'g', combinator: 'and', children: [{ type: 'condition', id: 'c', field: 'schedules', operator: 'in', value: ['upkeep'] }] };
  const slotsOn = scheduleSlotsOn([upkeep, meal]);
  /**
   * Windows of the moment of the routine on a day, as its condition allows them.
   * @param {string} day Day.
   * @returns {{ fromTime: string | null, dueTime: string | null }[]} Windows.
   */
  const momentOn = (day: string) => windowsAllowed({ fromTime: '08:30', dueTime: '20:30' }, conditionWindows(onUpkeep, (query) => slotsOn(query, day)));
  const tree = [routine('p'), routine('a', 'p'), routine('b', 'p')];
  /**
   * Occurrences of the parent and its sub-routines, open from Tuesday, due on Wednesday, as the list of a day gives
   * them: their moment kept to the hours that day allows (none: without any window).
   * @param {string} day Day shown.
   * @returns {RoutineTickOccurrence[]} Occurrences.
   */
  const occurrencesOn = (day: string): RoutineTickOccurrence[] => {
    const windows = momentOn(day);
    const slots = [slot(0, false, windows.length ? { fromTime: windows[0].fromTime, dueTime: windows.at(-1)!.dueTime, windows } : { fromTime: '08:30', dueTime: '20:30', windows: [] })];
    return tree.map((item) => occurrence(item.id, slots, { date: WEDNESDAY, startDate: TUESDAY, dueDate: WEDNESDAY }));
  };

  it('its occurrence due on Wednesday opens on Tuesday, its first day', () => {
    const [first] = caseSpans({ since: null, until: null, anchor: null, rule: weekly, times: null }, TUESDAY, TUESDAY, WEDNESDAY);
    expect(first).toEqual({ start: WEDNESDAY, end: WEDNESDAY });
    expect(routineOpenDate(first.end, { mode: 'BEFORE', days: 1 }, weekly.frequency)).toBe(TUESDAY);
  });

  it('on Tuesday, no slot « Entretien »: no moment, nothing listed, the parent absent', () => {
    expect(momentOn(TUESDAY)).toEqual([]);
    const occurrences = occurrencesOn(TUESDAY);
    expect(routineDayEntries(tree, occurrences, TUESDAY, { today: '2026-11-27' })).toEqual([]);
    expect(occurrences.some((item) => routineCountsOn(item, TUESDAY))).toBe(false);
    expect(routineGroupStatesOn(tree, occurrences, TUESDAY).has('p')).toBe(false);
  });

  it('on Wednesday, the sub-routines within the hours of the slot, under their parent', () => {
    expect(momentOn(WEDNESDAY)).toEqual([{ fromTime: '08:30', dueTime: '20:30' }]);
    const occurrences = occurrencesOn(WEDNESDAY);
    const entries = routineDayEntries(tree, occurrences, WEDNESDAY, { today: '2026-11-27' });
    expect(entries.map((entry) => [entry.routine.id, entry.slot.fromTime, entry.slot.dueTime])).toEqual([
      ['a', '08:30', '20:30'],
      ['b', '08:30', '20:30'],
    ]);
    expect(routineGroupStatesOn(tree, occurrences, WEDNESDAY).get('p')).toMatchObject({ counted: 2, done: 0, moments: [{ index: 0, fromTime: '08:30', dueTime: '20:30', done: false }] });
  });
});

describe('moments its condition does not allow that day', () => {
  const window = { startDate: DAY, dueDate: '2026-11-27' };
  const notAllowed = { windows: [] };
  const tree = [routine('p'), routine('a', 'p')];

  it('an occurrence without any moment, or without any allowed that day: not counted, not listed, not done', () => {
    for (const item of [occurrence('a', []), occurrence('a', [slot(0, false, notAllowed)], window)]) {
      expect(routineCountsOn(item, DAY)).toBe(false);
      expect(routineDayEntries(tree, [item], DAY, { today: DAY })).toEqual([]);
      expect(routineDoneDay(item)).toBeNull();
      expect(routineGroupStatesOn(tree, [item], DAY).has('p')).toBe(false);
    }
  });

  it('only its optional moments allowed that day: those listed, not counted', () => {
    const item = occurrence('a', [slot(0, false, notAllowed), slot(1, false, { optional: true }), slot(2, false, { optional: true, ...notAllowed })], window);
    expect(routineCountsOn(item, DAY)).toBe(false);
    expect(routineDayEntries(tree, [item], DAY, { today: DAY }).map((entry) => entry.slot.index)).toEqual([1]);
  });

  it('a required moment not allowed that day is still to do: the one allowed, ticked, does not make it done', () => {
    const item = occurrence('a', [slot(0, false, notAllowed), slot(1, true)], window);
    expect(routineCountsOn(item, DAY)).toBe(true);
    expect(routineDayEntries(tree, [item], DAY, { today: DAY }).map((entry) => entry.slot.index)).toEqual([1]);
    expect(routineGroupStatesOn(tree, [item], DAY).get('p')).toMatchObject({ counted: 1, done: 0, complete: false });
  });

  it('a ticked moment shows on the day it was done, allowed that day or not', () => {
    const item = occurrence('a', [slot(0, true, notAllowed)], window);
    expect(routineDayEntries(tree, [item], DAY, { today: DAY }).map((entry) => entry.slot.index)).toEqual([0]);
  });
});
