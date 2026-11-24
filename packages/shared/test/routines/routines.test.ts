import { describe, expect, it } from 'vitest';
import {
  dayTakenByMoves,
  designatesOccurrence,
  followedOccurrence,
  mergedAway,
  mergeRefusal,
  shiftedRoutineRule,
  MAX_MERGED_ROWS,
  MAX_ROUTINE_MOVES,
  moveKey,
  movedFrom,
  movedOccurrences,
  occurrenceByMoves,
  occurrenceDueDay,
  opensFits,
  opensMisfits,
  previousMove,
  readOpens,
  relinkedOccurrence,
  routineCaseOn,
  routineCaseSchema,
  routineHasHours,
  routineMoveSchema,
  routineOccurrences,
  routineOpenDate,
  routineSchedule,
  routineSlotSpan,
  routineState,
  shiftedRoutineLink,
  shiftTime,
  withMove,
  withMovedTimes,
  type RoutineCase,
  type RoutineMove,
} from '../../src/routines/routines';
import { occurrenceDates } from '../../src/dates/recurrence';
import { rule } from '../rules';

/**
 * Exception as saved (fields the schema adds by default left out).
 * @param {Partial<RoutineMove>} fields Fields.
 * @returns {RoutineMove} Exception.
 */
const move = (fields: Partial<RoutineMove> & { from: string }): RoutineMove => ({ to: null, times: null, ...fields });

describe('routineMoveSchema', () => {
  it('reads a move kept apart, a merge with the rows it brought, and the exception kept before', () => {
    const parsed = routineMoveSchema.parse({
      from: '2026-11-23',
      to: '2026-11-25',
      merged: true,
      mergedRows: ['comment:1', 'checklist:2'],
      previous: { to: '2026-11-24', times: [{ fromTime: '08:00', dueTime: null }], apart: true },
    });
    expect(parsed).toEqual({
      from: '2026-11-23',
      to: '2026-11-25',
      times: null,
      merged: true,
      mergedRows: ['comment:1', 'checklist:2'],
      previous: { to: '2026-11-24', times: [{ fromTime: '08:00', dueTime: null }], apart: true },
    });
    expect(routineMoveSchema.parse({ from: '2026-11-23', to: '2026-11-25', apart: true }).apart).toBe(true);
  });

  it('a cancel is a move without a new day; its previous exception may be a cancel of nothing (to null)', () => {
    expect(routineMoveSchema.safeParse({ from: '2026-11-23', to: null, previous: { to: null } }).success).toBe(true);
  });

  it('refuses the same day with the same times', () => {
    expect(routineMoveSchema.safeParse({ from: '2026-11-23', to: '2026-11-23' }).error?.issues[0].message).toBe('Choisissez un autre jour ou d’autres horaires.');
    expect(routineMoveSchema.safeParse({ from: '2026-11-23', to: '2026-11-23', times: [{ fromTime: '09:00', dueTime: null }] }).success).toBe(true);
  });

  it('1 000 merged rows at most, 10 changed times at most', () => {
    expect(MAX_MERGED_ROWS).toBe(1000);
    expect(routineMoveSchema.safeParse({ from: '2026-11-23', to: '2026-11-25', merged: true, mergedRows: Array(MAX_MERGED_ROWS).fill('r') }).success).toBe(true);
    expect(routineMoveSchema.safeParse({ from: '2026-11-23', to: '2026-11-25', merged: true, mergedRows: Array(MAX_MERGED_ROWS + 1).fill('r') }).success).toBe(false);
    expect(routineMoveSchema.safeParse({ from: '2026-11-23', to: '2026-11-23', times: Array(11).fill(null) }).success).toBe(false);
  });

  it('500 exceptions at most per routine', () => {
    expect(MAX_ROUTINE_MOVES).toBe(500);
  });
});

describe('previousMove: what a cancel or a merge keeps to give back', () => {
  const moved = move({ from: '2026-11-23', to: '2026-11-24', times: [{ fromTime: '08:00', dueTime: null }], apart: true });
  const cancel = move({ from: '2026-11-23', to: null });
  const merge = move({ from: '2026-11-23', to: '2026-11-25', merged: true });

  it('the exception the occurrence had before (moved, other times, kept apart)', () => {
    expect(previousMove(moved, cancel)).toEqual({ to: '2026-11-24', times: [{ fromTime: '08:00', dueTime: null }], apart: true });
    expect(previousMove(move({ from: '2026-11-23', to: '2026-11-24' }), merge)).toEqual({ to: '2026-11-24', times: null });
  });

  it('nothing without an exception before, nor for a plain move', () => {
    expect(previousMove(undefined, cancel)).toBeUndefined();
    expect(previousMove(moved, move({ from: '2026-11-23', to: '2026-11-26' }))).toBeUndefined();
  });

  it('cancelled again, or merged again: the one kept before the first', () => {
    const first = { to: '2026-11-24', times: null };
    expect(previousMove({ ...cancel, previous: first }, cancel)).toBe(first);
    expect(previousMove({ ...merge, previous: first }, { ...merge, to: '2026-11-26' })).toBe(first);
  });

  it('merged before, then cancelled: none', () => {
    expect(previousMove({ ...merge, previous: { to: '2026-11-24', times: null } }, cancel)).toBeUndefined();
  });

  it('cancelled before, then merged: the cancel', () => {
    expect(previousMove(cancel, merge)).toEqual({ to: null, times: null });
  });
});

describe('identity of a moved occurrence', () => {
  it('moveKey: its new day; kept apart or cancelled, the day of its rule', () => {
    expect(moveKey(move({ from: '2026-11-23', to: '2026-11-25' }))).toBe('2026-11-25');
    expect(moveKey(move({ from: '2026-11-23', to: '2026-11-25', apart: true }))).toBe('2026-11-23');
    expect(moveKey(move({ from: '2026-11-23', to: null }))).toBe('2026-11-23');
  });

  it('occurrenceDueDay: kept apart, the day it went to', () => {
    const moves = [move({ from: '2026-11-23', to: '2026-11-25', apart: true })];
    expect(occurrenceDueDay(moves, '2026-11-23')).toBe('2026-11-25');
    expect(occurrenceDueDay(moves, '2026-11-25')).toBe('2026-11-25');
  });

  it('movedFrom: the day of its rule; an occurrence others were merged into stays that of its day', () => {
    expect(movedFrom([move({ from: '2026-11-23', to: '2026-11-25' })], '2026-11-25')).toBe('2026-11-23');
    expect(movedFrom([move({ from: '2026-11-23', to: '2026-11-25', merged: true })], '2026-11-25')).toBe('2026-11-25');
    expect(movedFrom([move({ from: '2026-11-23', to: '2026-11-25', apart: true })], '2026-11-23')).toBe('2026-11-23');
  });
});

describe('occurrenceByMoves: the occurrence a day designates, by the exceptions', () => {
  const MON = '2026-11-23';
  const TUE = '2026-11-24';
  const WED = '2026-11-25';

  it('no exception about it: up to the rule', () => {
    expect(occurrenceByMoves([], MON)).toBeNull();
    expect(occurrenceByMoves([move({ from: MON, to: WED })], TUE)).toBeNull();
  });

  it('moved there: designated by its new day, no longer by the day of its rule', () => {
    const moves = [move({ from: MON, to: WED })];
    expect(occurrenceByMoves(moves, WED)).toBe(true);
    expect(occurrenceByMoves(moves, MON)).toBe(false);
  });

  it('kept apart, cancelled or its times changed: still designated by the day of its rule', () => {
    expect(occurrenceByMoves([move({ from: MON, to: WED, apart: true })], MON)).toBe(true);
    expect(occurrenceByMoves([move({ from: MON, to: null })], MON)).toBe(true);
    expect(occurrenceByMoves([move({ from: MON, to: MON, times: [{ fromTime: '08:00', dueTime: null }] })], MON)).toBe(true);
  });

  it('merged into another occurrence: its day designates none (a stale tab), the one it went into stays up to the rule', () => {
    const moves = [move({ from: MON, to: TUE, merged: true, mergedRows: ['r'] })];
    expect(occurrenceByMoves(moves, MON)).toBe(false);
    expect(occurrenceByMoves(moves, TUE)).toBeNull();
  });

  it('a day its own occurrence left but another one moved onto: that other one', () => {
    expect(occurrenceByMoves([move({ from: MON, to: WED }), move({ from: TUE, to: MON })], MON)).toBe(true);
    expect(occurrenceByMoves([move({ from: MON, to: TUE, merged: true }), move({ from: WED, to: MON })], MON)).toBe(true);
  });
});

describe('designatesOccurrence: a day given for a write', () => {
  const MON = '2026-11-23';
  const WED = '2026-11-25';
  const ruleDay = (day: string) => day === MON;

  it('the exceptions decide when they are about it, else the rule', () => {
    expect(designatesOccurrence([], MON, ruleDay)).toBe(true);
    expect(designatesOccurrence([], WED, ruleDay)).toBe(false);
    expect(designatesOccurrence([move({ from: MON, to: WED })], WED, ruleDay)).toBe(true);
    expect(designatesOccurrence([move({ from: MON, to: WED })], MON, ruleDay)).toBe(false);
    expect(designatesOccurrence([move({ from: MON, to: WED, merged: true })], MON, ruleDay)).toBe(false);
    expect(designatesOccurrence([move({ from: MON, to: null })], MON, ruleDay)).toBe(true);
  });

  it('the rule is not asked when an exception is about the day', () => {
    let asked = false;
    designatesOccurrence([move({ from: MON, to: WED })], WED, () => (asked = true));
    expect(asked).toBe(false);
  });
});

describe('followedOccurrence: the occurrence of a sub-routine when the one of its parent moves', () => {
  const held = (before: boolean, afterOnDay: boolean, afterOnNewDay: boolean) => ({ before: () => before, afterOnDay: () => afterOnDay, afterOnNewDay: () => afterOnNewDay });

  it('moved or merged into an occurrence it has on the new day: follows', () => {
    expect(followedOccurrence(held(true, false, true), '2026-11-25')).toBe('FOLLOWS');
  });

  it('merged into an occurrence it does not have that day: would disappear', () => {
    expect(followedOccurrence(held(true, false, false), '2026-11-25')).toBe('STRANDED');
  });

  it('not there before, still there after (kept apart), or cancelled: stays', () => {
    expect(followedOccurrence(held(false, false, false), '2026-11-25')).toBe('STAYS');
    expect(followedOccurrence(held(true, true, false), '2026-11-25')).toBe('STAYS');
    expect(followedOccurrence(held(true, false, false), null)).toBe('STAYS');
  });
});

describe('mergeRefusal', () => {
  it('a sub-routine that would lose its occurrence', () => {
    expect(mergeRefusal(1)).toBe('Une sous-routine qui suit ses exceptions n’a pas d’occurrence ce jour-là : gardez les deux.');
  });

  it('more rows than a merge notes', () => {
    expect(mergeRefusal(0, MAX_MERGED_ROWS)).toBeNull();
    expect(mergeRefusal(0, MAX_MERGED_ROWS + 1)).toMatch(/^Cette occurrence a trop de commentaires, listes et liens pour être fusionnée \(1.000 au plus\) : gardez les deux\.$/);
  });

  it('accepted otherwise', () => {
    expect(mergeRefusal(0)).toBeNull();
  });
});

describe('shiftedRoutineRule: the rule going on from an occurrence changed', () => {
  it('monthly on a day of the month: the day of the month of the new day', () => {
    const shifted = shiftedRoutineRule(rule({ frequency: 'MONTHLY', monthDay: 10 }), '2026-01-10', '2026-11-10', '2026-11-12', true);
    expect(shifted.monthDay).toBe(12);
  });

  it('monthly on a weekday of the month: the weekday and position of the new day', () => {
    // 2nd Tuesday (2026-11-10) moved to the 3rd Thursday (2026-11-19).
    const shifted = shiftedRoutineRule(rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', weekday: 2, position: 2 }), '2026-01-13', '2026-11-10', '2026-11-19', false);
    expect(shifted).toMatchObject({ weekday: 4, position: 3 });
    expect(occurrenceDates(shifted, '2026-11-19', '2026-11-19', '2026-12-31')).toEqual(['2026-11-19', '2026-12-17']);
  });

  it('yearly: the month and day of the new day', () => {
    expect(shiftedRoutineRule(rule({ frequency: 'YEARLY', month: 11, monthDay: 10 }), '2025-11-10', '2026-11-10', '2026-12-01', false)).toMatchObject({ month: 12, monthDay: 1 });
  });

  it('its times only changed: the rule as it was', () => {
    const monthly = rule({ frequency: 'MONTHLY', monthDay: 10 });
    expect(shiftedRoutineRule(monthly, '2026-01-10', '2026-11-10', '2026-11-10', false)).toEqual(monthly);
  });

  it('weekly on listed days: the new weekday instead of the former one; counted: the occurrences left', () => {
    const weekly = rule({ frequency: 'WEEKLY', weekdays: [1, 3], count: 10 });
    const shifted = shiftedRoutineRule(weekly, '2026-11-02', '2026-11-09', '2026-11-10', true);
    expect(shifted.weekdays).toEqual([2, 3]);
    expect(shifted.count).toBe(8);
    expect(shifted.monthDay).toBe(weekly.monthDay);
  });

  it('daily: unchanged values', () => {
    const daily = rule({ frequency: 'DAILY' });
    expect(shiftedRoutineRule(daily, '2026-11-01', '2026-11-10', '2026-11-12', false)).toEqual(daily);
  });
});

describe('dayTakenByMoves: whether a day identifies another occurrence, by the exceptions', () => {
  const MON = '2026-11-23';
  const TUE = '2026-11-24';
  const WED = '2026-11-25';
  const THU = '2026-11-26';

  it('another one moved there, kept apart or cancelled from it: taken', () => {
    expect(dayTakenByMoves([move({ from: TUE, to: MON })], WED, MON)).toBe(true);
    expect(dayTakenByMoves([move({ from: MON, to: TUE, apart: true })], WED, MON)).toBe(true);
    expect(dayTakenByMoves([move({ from: MON, to: null })], WED, MON)).toBe(true);
  });

  it('its own exception does not take its day', () => {
    expect(dayTakenByMoves([move({ from: MON, to: TUE, apart: true })], MON, MON)).toBe(false);
  });

  it('the day of its own rule: free unless another one is identified by it', () => {
    expect(dayTakenByMoves([], MON, MON)).toBe(false);
    expect(dayTakenByMoves([move({ from: TUE, to: MON })], MON, MON)).toBe(true);
  });

  it('the occurrence of the rule there moved elsewhere: free', () => {
    expect(dayTakenByMoves([move({ from: MON, to: THU })], WED, MON)).toBe(false);
  });

  it('the occurrence of the rule there merged into another one: taken until the merge is undone (rows of its own may have stayed there)', () => {
    const moves = [move({ from: MON, to: TUE, merged: true, mergedRows: [] })];
    expect(dayTakenByMoves(moves, WED, MON)).toBe(true);
    expect(mergedAway(moves, MON)).toBe(true);
    expect(mergedAway(moves, TUE)).toBe(false);
  });

  it('its own merge does not take the day of its rule (undoing it brings it back there)', () => {
    expect(dayTakenByMoves([move({ from: MON, to: TUE, merged: true })], MON, MON)).toBe(false);
  });

  it('a merged one does not take the day it went into: up to the rule there', () => {
    expect(dayTakenByMoves([move({ from: MON, to: TUE, merged: true })], WED, TUE)).toBeNull();
  });

  it('no exception about the day: up to the rule', () => {
    expect(dayTakenByMoves([], WED, MON)).toBeNull();
    expect(dayTakenByMoves([move({ from: THU, to: WED })], THU, MON)).toBeNull();
  });
});

describe('withMove', () => {
  it('moving again changes its exception; back to its day with its times removes it', () => {
    const moves = withMove([], '2026-11-23', '2026-11-25');
    expect(moves).toEqual([{ from: '2026-11-23', to: '2026-11-25', times: null }]);
    expect(withMove(moves, '2026-11-25', '2026-11-26')).toEqual([{ from: '2026-11-23', to: '2026-11-26', times: null }]);
    expect(withMove(moves, '2026-11-25', '2026-11-23')).toEqual([]);
  });

  it('only times that differ are kept; other times on its day make an exception', () => {
    expect(withMove([], '2026-11-23', '2026-11-23', [null, null])).toEqual([]);
    expect(withMove([], '2026-11-23', '2026-11-23', [{ fromTime: '07:00', dueTime: null }])).toEqual([{ from: '2026-11-23', to: '2026-11-23', times: [{ fromTime: '07:00', dueTime: null }] }]);
  });

  it('kept apart or merged as asked, as it was otherwise; a cancel or a merge keeps no times', () => {
    const apart = withMove([], '2026-11-23', '2026-11-25', [{ fromTime: '07:00', dueTime: null }], 'APART');
    expect(apart).toEqual([{ from: '2026-11-23', to: '2026-11-25', times: [{ fromTime: '07:00', dueTime: null }], apart: true }]);
    expect(withMove(apart, '2026-11-23', '2026-11-26')[0].apart).toBe(true);
    expect(withMove(apart, '2026-11-23', '2026-11-26', undefined, 'MERGED')).toEqual([{ from: '2026-11-23', to: '2026-11-26', times: null, merged: true }]);
    expect(withMove(apart, '2026-11-23', null)).toEqual([{ from: '2026-11-23', to: null, times: null }]);
  });

  it('exceptions stay in the order of their days', () => {
    expect(withMove([move({ from: '2026-11-30', to: '2026-12-01' })], '2026-11-23', '2026-11-24').map((item) => item.from)).toEqual(['2026-11-23', '2026-11-30']);
  });
});

describe('withMovedTimes', () => {
  it('the times its exception changes, the others those of its rule', () => {
    const slots = [
      { fromTime: '08:00', dueTime: '09:00', optional: false },
      { fromTime: '20:00', dueTime: null, optional: true },
    ];
    expect(withMovedTimes(slots, [null, { fromTime: '21:00', dueTime: '22:00' }])).toEqual([slots[0], { fromTime: '21:00', dueTime: '22:00', optional: true }]);
    expect(withMovedTimes(slots, null)).toEqual(slots);
  });
});

describe('event links moved with their event', () => {
  it('shiftedRoutineLink: an occurrence shown on its own day is asked on the new day; one kept apart keeps its day', () => {
    expect(shiftedRoutineLink({ routineId: 'r', date: '2026-11-23' }, '2026-11-23', 2)).toEqual({ routineId: 'r', date: '2026-11-25', shownDate: '2026-11-25' });
    expect(shiftedRoutineLink({ routineId: 'r', date: '2026-11-23' }, '2026-11-24', 2)).toEqual({ routineId: 'r', date: '2026-11-23', shownDate: '2026-11-26' });
    expect(shiftedRoutineLink({ routineId: 'r', date: '2026-11-23' }, '2026-11-23', -1).shownDate).toBe('2026-11-22');
  });

  it('relinkedOccurrence: the one it was linked to if still there, else the one of the same kind, else the other; none: dropped', () => {
    const own = { routineId: 'r', date: '2026-11-25', shownDate: '2026-11-25' };
    const apart = { routineId: 'r', date: '2026-11-23', shownDate: '2026-11-25' };
    expect(relinkedOccurrence({ routineId: 'r', date: '2026-11-23', shownDate: '2026-11-25' }, [own, apart])).toBe('2026-11-23');
    expect(relinkedOccurrence({ routineId: 'r', date: '2026-11-20', shownDate: '2026-11-25' }, [own, apart])).toBe('2026-11-23');
    expect(relinkedOccurrence({ routineId: 'r', date: '2026-11-25' }, [apart, own])).toBe('2026-11-25');
    expect(relinkedOccurrence({ routineId: 'r', date: '2026-11-24', shownDate: '2026-11-25' }, [own])).toBe('2026-11-25');
    expect(relinkedOccurrence({ routineId: 'r', date: '2026-11-25' }, [{ ...own, cancelled: true }])).toBeNull();
    expect(relinkedOccurrence({ routineId: 'other', date: '2026-11-25' }, [own])).toBeNull();
  });
});

describe('routineOccurrences: current and next', () => {
  const weekly = rule({ weekdays: [1] });

  it('the current one is the last on or before today, the next the first after', () => {
    expect(routineOccurrences(weekly, '2026-11-02', '2026-11-25')).toEqual({ current: '2026-11-23', next: '2026-11-30' });
    expect(routineOccurrences(weekly, '2026-11-02', '2026-11-23')).toEqual({ current: '2026-11-23', next: '2026-11-30' });
  });

  it('nothing current before the first date', () => {
    expect(routineOccurrences(weekly, '2026-11-30', '2026-11-25')).toEqual({ current: null, next: '2026-11-30' });
  });

  it('once the rule has ended, a past last occurrence is no longer current; the last one today still is', () => {
    expect(routineOccurrences({ ...weekly, until: '2026-11-16' }, '2026-11-02', '2026-11-25')).toEqual({ current: null, next: null });
    expect(routineOccurrences({ ...weekly, until: '2026-11-23' }, '2026-11-02', '2026-11-23')).toEqual({ current: '2026-11-23', next: null });
  });

  it('with an « Ouverture », the next one becomes current from its open day', () => {
    const monthly = rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' });
    const opens = { mode: 'BEFORE' as const, days: 3 };
    expect(routineOccurrences(monthly, '2026-10-30', '2026-11-26', opens).current).toBe('2026-10-30');
    expect(routineOccurrences(monthly, '2026-10-30', '2026-11-27', opens)).toEqual({ current: '2026-11-30', next: '2026-12-30' });
  });

  it('routineState: upcoming without current, done, late before today, due today', () => {
    expect(routineState(null, false, '2026-11-23')).toBe('upcoming');
    expect(routineState('2026-11-20', true, '2026-11-23')).toBe('done');
    expect(routineState('2026-11-20', false, '2026-11-23')).toBe('late');
    expect(routineState('2026-11-23', false, '2026-11-23')).toBe('due');
    expect(routineState('2026-11-30', false, '2026-11-23')).toBe('due');
  });
});

describe('movedOccurrences: with exceptions', () => {
  const weekly = rule({ weekdays: [1] });
  const compute = (today: string) => routineOccurrences(weekly, '2026-11-02', today);

  it('a moved occurrence occurs on the day it went to', () => {
    const moves = [move({ from: '2026-11-30', to: '2026-11-27' })];
    expect(movedOccurrences(compute, moves, '2026-11-25')).toEqual({ current: '2026-11-23', next: '2026-11-27' });
    expect(movedOccurrences(compute, moves, '2026-11-28')).toEqual({ current: '2026-11-27', next: '2026-12-07' });
  });

  it('the latest one postponed: nothing due until the day it goes to (the previous ones do not come back)', () => {
    const moves = [move({ from: '2026-11-23', to: '2026-11-26' })];
    expect(movedOccurrences(compute, moves, '2026-11-24')).toEqual({ current: null, next: '2026-11-26' });
  });

  it('a cancelled one is skipped', () => {
    expect(movedOccurrences(compute, [move({ from: '2026-11-30', to: null })], '2026-11-25').next).toBe('2026-12-07');
  });

  it('two due the same day (one kept apart): both by the days that identify them, the first by default', () => {
    const moves = [move({ from: '2026-11-23', to: '2026-11-30', apart: true })];
    expect(movedOccurrences(compute, moves, '2026-11-30')).toEqual({ current: '2026-11-23', next: '2026-12-07' });
    expect(movedOccurrences(compute, moves, '2026-11-30', (dates) => dates[dates.length - 1]).current).toBe('2026-11-30');
  });

  it('a merged one is no occurrence of its own', () => {
    const moves = [move({ from: '2026-11-23', to: '2026-11-30', merged: true })];
    expect(movedOccurrences(compute, moves, '2026-11-30')).toEqual({ current: '2026-11-30', next: '2026-12-07' });
  });
});

describe('« Ouverture »', () => {
  it('opensFits: days before always; a day of the month for a monthly rule, of a month for a yearly one', () => {
    expect(opensFits({ mode: 'BEFORE', days: 2 }, 'WEEKLY')).toBe(true);
    expect(opensFits({ mode: 'DAY', day: 1, month: null }, 'MONTHLY')).toBe(true);
    expect(opensFits({ mode: 'DAY', day: 1, month: 3 }, 'MONTHLY')).toBe(false);
    expect(opensFits({ mode: 'DAY', day: 1, month: null }, 'YEARLY')).toBe(false);
    expect(opensFits({ mode: 'WEEK', week: 7, weekday: 1 }, 'MONTHLY')).toBe(false);
    expect(opensFits({ mode: 'WEEK', week: 12, weekday: 1 }, 'YEARLY')).toBe(true);
    expect(opensFits({ mode: 'DAY', day: 1, month: null }, 'WEEKLY')).toBe(false);
  });

  it('opensMisfits: a routine with cases has none of its own', () => {
    expect(opensMisfits({ opensOn: { mode: 'BEFORE', days: 2 }, cases: [{}], recurrence: { frequency: 'DAILY' } })).toBe(true);
    expect(opensMisfits({ opensOn: { mode: 'BEFORE', days: 2 }, cases: [], recurrence: { frequency: 'DAILY' } })).toBe(false);
    expect(opensMisfits({ opensOn: null, cases: [{}], recurrence: null })).toBe(false);
  });

  it('readOpens: the former "DD" and "MM-DD"', () => {
    expect(readOpens('05')).toEqual({ mode: 'DAY', day: 5, month: null });
    expect(readOpens('03-15')).toEqual({ mode: 'DAY', day: 15, month: 3 });
    expect(readOpens('nope')).toBeNull();
  });

  it('routineOpenDate: in its period, the one before when that day comes after the due day', () => {
    expect(routineOpenDate('2026-11-30', { mode: 'DAY', day: 25, month: null }, 'MONTHLY')).toBe('2026-11-25');
    expect(routineOpenDate('2026-11-10', { mode: 'DAY', day: 25, month: null }, 'MONTHLY')).toBe('2026-10-25');
    expect(routineOpenDate('2026-01-10', { mode: 'DAY', day: 25, month: null }, 'MONTHLY')).toBe('2025-12-25');
    expect(routineOpenDate('2026-02-28', { mode: 'DAY', day: 31, month: null }, 'MONTHLY')).toBe('2026-02-28');
    expect(routineOpenDate('2026-11-30', { mode: 'WEEKDAY', position: -1, weekday: 5, month: null }, 'MONTHLY')).toBe('2026-11-27');
    expect(routineOpenDate('2026-11-30', { mode: 'WEEKDAY', position: 2, weekday: 2, month: null }, 'MONTHLY')).toBe('2026-11-10');
    expect(routineOpenDate('2026-11-30', { mode: 'BEFORE', days: 3 }, 'WEEKLY')).toBe('2026-11-27');
    expect(routineOpenDate('2026-06-30', { mode: 'DAY', day: 15, month: 3 }, 'YEARLY')).toBe('2026-03-15');
    expect(routineOpenDate('2026-02-01', { mode: 'DAY', day: 15, month: 3 }, 'YEARLY')).toBe('2025-03-15');
    expect(routineOpenDate('2026-11-30', { mode: 'DAY', day: 1, month: 3 }, 'MONTHLY')).toBe('2026-11-30');
  });

  it('a weekday of week n of the month: weeks from Monday, the first that of the 1st, kept within the month', () => {
    // November 2026 starts on a Sunday: the Monday of week 1 falls before the 1st, so it is the first Monday (the 2nd).
    expect(routineOpenDate('2026-11-30', { mode: 'WEEK', week: 1, weekday: 1 }, 'MONTHLY')).toBe('2026-11-02');
    expect(routineOpenDate('2026-11-30', { mode: 'WEEK', week: 2, weekday: 7 }, 'MONTHLY')).toBe('2026-11-08');
    expect(routineOpenDate('2026-11-30', { mode: 'WEEK', week: 6, weekday: 7 }, 'MONTHLY')).toBe('2026-11-29');
  });

  it('yearly on an ISO week', () => {
    expect(routineOpenDate('2026-12-31', { mode: 'WEEK', week: 12, weekday: 1 }, 'YEARLY')).toBe('2026-03-16');
    expect(routineOpenDate('2026-03-01', { mode: 'WEEK', week: 12, weekday: 1 }, 'YEARLY')).toBe('2025-03-17');
  });
});

describe('times of a routine', () => {
  it('routineSchedule: leave by the latest time less travel and time spent, back after travel', () => {
    expect(routineSchedule({ fromTime: null, dueTime: '09:00', estimate: 20, travelBefore: 10, travelAfter: 15 })).toEqual({ leaveAt: '08:30', backAt: '09:15' });
    expect(routineSchedule({ fromTime: '08:00', dueTime: null, estimate: null, travelBefore: 10, travelAfter: 15 })).toEqual({ leaveAt: '07:50', backAt: '08:45' });
    expect(routineSchedule({ fromTime: null, dueTime: null, estimate: 20, travelBefore: 10, travelAfter: 15 })).toEqual({ leaveAt: null, backAt: null });
  });

  it('times stay within the day', () => {
    expect(shiftTime('00:10', -20)).toBe('23:50');
    expect(shiftTime('23:50', 20)).toBe('00:10');
  });

  it('routineSlotSpan: without « jusqu’à » start + time spent (midnight at most); without « dès » end − time spent (00:00 at the earliest); 30 min by default', () => {
    expect(routineSlotSpan({ fromTime: '08:00', dueTime: null }, null)).toEqual({ start: '08:00', end: '08:30' });
    expect(routineSlotSpan({ fromTime: null, dueTime: '10:00' }, 0)).toEqual({ start: '09:30', end: '10:00' });
    expect(routineSlotSpan({ fromTime: null, dueTime: '00:10' }, 30)).toEqual({ start: '00:00', end: '00:10' });
    expect(routineSlotSpan({ fromTime: '23:45', dueTime: null }, 30)).toEqual({ start: '23:45', end: null });
    expect(routineSlotSpan({ fromTime: null, dueTime: null }, 30)).toBeNull();
  });

  it('routineHasHours: a moment with an hour or a condition; with cases, theirs only', () => {
    const none = { moments: [{ fromTime: null, dueTime: null }], slotCondition: null, cases: [] };
    expect(routineHasHours(none)).toBe(false);
    expect(routineHasHours({ ...none, moments: [{ fromTime: '08:00', dueTime: null }] })).toBe(true);
    expect(routineHasHours({ ...none, fromTime: '08:00', cases: [{ slots: [{ fromTime: null, dueTime: null }], condition: null }] })).toBe(false);
    const condition = { type: 'group' as const, id: 'g', combinator: 'and' as const, children: [{ type: 'condition' as const, id: 'c', field: 'freeTime' as const, operator: 'isEmpty' }] };
    expect(routineHasHours({ ...none, slotCondition: condition })).toBe(true);
  });
});

describe('cases of a routine', () => {
  const routineCase = (fields: Partial<RoutineCase>): RoutineCase =>
    routineCaseSchema.parse({ recurrence: rule({ weekdays: [1] }), slots: [{ fromTime: null, dueTime: null }], ...fields });

  it('a day due by several cases follows the first; a case counts from its from (never before the routine)', () => {
    const mondays = routineCase({});
    const daily = routineCase({ recurrence: rule({ frequency: 'DAILY' }), from: '2026-11-25' });
    expect(routineCaseOn([mondays, daily], '2026-11-02', '2026-11-23')).toBe(mondays);
    expect(routineCaseOn([mondays, daily], '2026-11-02', '2026-11-24')).toBeNull();
    expect(routineCaseOn([mondays, daily], '2026-11-02', '2026-11-26')).toBe(daily);
    expect(routineCaseOn([mondays, daily], '2026-11-02', '2026-11-30')).toBe(mondays);
  });

  it('a case needs a moment, at least one required, 10 at most', () => {
    expect(routineCaseSchema.safeParse({ recurrence: rule({}), slots: [] }).error?.issues[0].message).toBe('Ajoutez au moins un moment.');
    expect(routineCaseSchema.safeParse({ recurrence: rule({}), slots: [{ optional: true }] }).error?.issues[0].message).toBe('Au moins un moment doit être obligatoire.');
    expect(routineCaseSchema.safeParse({ recurrence: rule({}), slots: Array(11).fill({}) }).error?.issues[0].message).toBe('10 moments au plus.');
  });

  it('its « Ouverture » must fit its repetition', () => {
    expect(routineCaseSchema.safeParse({ recurrence: rule({}), slots: [{}], opens: { mode: 'DAY', day: 1 } }).success).toBe(false);
  });
});
