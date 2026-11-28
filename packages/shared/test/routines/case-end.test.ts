import { describe, expect, it } from 'vitest';
import { DEFAULT_RECURRENCE, type Recurrence } from '../../src/dates/recurrence';
import { addDays, daysBetween } from '../../src/dates/days';
import { caseStart, readRoutineCases, routineCaseOn, routineCaseSpans, shiftedRoutinePiece, type RoutineCase } from '../../src/routines/routines';

/** First time of the routines of the tests (a Monday). */
const START = '2026-11-02';

/**
 * Rule changed by some fields.
 * @param {Partial<Recurrence>} fields Fields.
 * @returns {Recurrence} Rule.
 */
const rule = (fields: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...fields });

/**
 * A case of a routine as stored, maybe with a last day of its own (its former period).
 * @param {Partial<Recurrence>} fields Fields of its rule.
 * @param {{ from?: string, until?: string }} [period] Its first and last days. Optional.
 * @returns {RoutineCase & { until: string | null }} Stored case.
 */
const stored = (fields: Partial<Recurrence>, period: { from?: string; until?: string } = {}) => ({
  from: period.from ?? null,
  until: period.until ?? null,
  condition: null,
  recurrence: rule(fields),
  slots: [{ fromTime: null, dueTime: null, optional: false }],
  opens: null,
});

/**
 * Cases as read.
 * @param {ReturnType<typeof stored>[]} cases Stored cases.
 * @returns {RoutineCase[]} Cases.
 */
const read = (cases: ReturnType<typeof stored>[]): RoutineCase[] => readRoutineCases(cases, START);

/**
 * Occurrences of a case read, as « first day → due day ».
 * @param {ReturnType<typeof stored>} item Stored case.
 * @param {string} [to] Last day. Optional.
 * @returns {string[]} Occurrences.
 */
const spans = (item: ReturnType<typeof stored>, to = '2027-06-30'): string[] => read([item]).flatMap((one) => routineCaseSpans(one, START, START, to).map((span) => `${span.start}→${span.end}`));

/**
 * A case once its occurrences moved (« Toutes »), as the API makes it: on its own, its rule (with its end) moved.
 * @param {ReturnType<typeof stored>} item Stored case.
 * @param {string} date Occurrence moved.
 * @param {string} to New day.
 * @returns {RoutineCase} Case moved.
 */
function movedCase(item: ReturnType<typeof stored>, date: string, to: string): RoutineCase {
  const [one] = read([item]);
  const own = caseStart(one, START);
  const piece = shiftedRoutinePiece(one.recurrence, own, date, to, false);
  const listed = one.recurrence.frequency === 'WEEKLY' && one.recurrence.weekdays.length > 0;
  const from = piece.start !== own ? piece.start : listed ? one.from && own : addDays(own, daysBetween(date, to));
  return { ...one, from, recurrence: piece.recurrence };
}

/**
 * Days of a case moved.
 * @param {RoutineCase} item Case.
 * @returns {string[]} Due days.
 */
const daysOf = (item: RoutineCase): string[] => routineCaseSpans(item, START, START, '2027-06-30').map((span) => span.end);

describe('routine cases stored with a last day of their own: their occurrences once read', () => {
  it('a rhythm counted from its first day, up to its last day', () => {
    expect(spans(stored({ frequency: 'DAILY', interval: 2 }, { from: '2026-11-05', until: '2026-11-12' }))).toEqual(['2026-11-05→2026-11-05', '2026-11-07→2026-11-07', '2026-11-09→2026-11-09', '2026-11-11→2026-11-11']);
  });

  it('a number of occurrences reaching past its last day: those up to it', () => {
    expect(spans(stored({ frequency: 'WEEKLY', weekdays: [1, 4], count: 10 }, { until: '2026-11-19' }))).toEqual([
      '2026-11-02→2026-11-02',
      '2026-11-05→2026-11-05',
      '2026-11-09→2026-11-09',
      '2026-11-12→2026-11-12',
      '2026-11-16→2026-11-16',
      '2026-11-19→2026-11-19',
    ]);
  });

  it('an earlier end date of its rule kept', () => {
    expect(spans(stored({ frequency: 'WEEKLY', weekdays: [3], until: '2026-11-18' }, { until: '2026-12-31' }))).toEqual(['2026-11-04→2026-11-04', '2026-11-11→2026-11-11', '2026-11-18→2026-11-18']);
  });

  it('monthly on the last day, its last day in March', () => {
    expect(spans(stored({ frequency: 'MONTHLY', monthDay: 31 }, { from: '2026-11-30', until: '2027-03-15' }))).toEqual(['2026-11-30→2026-11-30', '2026-12-31→2026-12-31', '2027-01-31→2027-01-31', '2027-02-28→2027-02-28']);
  });

  it('starting after its last day: no occurrence', () => {
    expect(spans(stored({ frequency: 'DAILY' }, { from: '2026-12-10', until: '2026-12-01' }))).toEqual([]);
    // Kept, without any occurrence: the routine keeps its cases.
    expect(read([stored({ frequency: 'DAILY' }, { from: '2026-12-10', until: '2026-12-01' })])).toHaveLength(1);
  });

  it('two cases one after the other: each day follows its own', () => {
    const cases = read([stored({ frequency: 'DAILY' }, { until: '2026-11-15' }), stored({ frequency: 'WEEKLY', weekdays: [5] }, { from: '2026-11-16' })]);
    expect(routineCaseOn(cases, START, '2026-11-14')).toBe(cases[0]);
    expect(routineCaseOn(cases, START, '2026-11-17')).toBeNull();
    expect(routineCaseOn(cases, START, '2026-11-20')).toBe(cases[1]);
  });
});

describe('a routine case with a last day of its own moved (« Toutes »)', () => {
  it('daily, alone: its first day and its end move as much', () => {
    const moved = movedCase(stored({ frequency: 'DAILY', interval: 3 }, { from: '2026-11-03', until: '2026-11-15' }), '2026-11-06', '2026-11-08');
    expect(daysOf(moved)).toEqual(['2026-11-05', '2026-11-08', '2026-11-11', '2026-11-14', '2026-11-17']);
  });

  it('one weekday of several moved alone: its end put off as far as that weekday goes, its occurrences exact', () => {
    const moved = movedCase(stored({ frequency: 'WEEKLY', weekdays: [1, 4] }, { until: '2026-11-24' }), '2026-11-09', '2026-11-14');
    expect(daysOf(moved)).toEqual(['2026-11-05', '2026-11-07', '2026-11-12', '2026-11-14', '2026-11-19', '2026-11-21', '2026-11-28']);
  });

  it('never compared with the next case: its end moves as much', () => {
    const cases = read([stored({ frequency: 'DAILY', interval: 3 }, { from: '2026-11-03', until: '2026-11-15' }), stored({ frequency: 'DAILY' }, { from: '2026-11-16' })]);
    const moved = movedCase(stored({ frequency: 'DAILY', interval: 3 }, { from: '2026-11-03', until: '2026-11-15' }), '2026-11-06', '2026-11-08');
    expect(daysOf(moved)).toEqual(['2026-11-05', '2026-11-08', '2026-11-11', '2026-11-14', '2026-11-17']);
    // The day both have follows the first one.
    expect(routineCaseOn([moved, cases[1]], START, '2026-11-17')).toEqual(moved);
  });
});

describe('occurrences of a case lasting several days', () => {
  it('the last one goes to its own last day', () => {
    expect(spans(stored({ frequency: 'DAILY', interval: 3, duration: { unit: 'DAYS', count: 2, day: null, week: null, month: null } } as Partial<Recurrence>, { until: '2026-11-08' }))).toEqual([
      '2026-11-02→2026-11-03',
      '2026-11-05→2026-11-06',
      '2026-11-08→2026-11-09',
    ]);
  });
});
