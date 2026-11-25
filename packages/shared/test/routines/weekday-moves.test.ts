import { describe, expect, it } from 'vitest';
import { caseAfterItsEnd, cutRoutineBefore, INEXACT_MOVE_REFUSAL, NEXT_CASE_REFUSAL, shiftedRoutinePiece, shiftMovesAll, weekdayMovedCase } from '../../src/routines/routines';
import { crossedWeeks, occurrenceDates, occurrencesBefore, weeksChange, type Recurrence } from '../../src/dates/recurrence';
import { addDays, daysBetween, weekdayOfDate } from '../../src/dates/days';
import { rule } from '../rules';

/**
 * Pseudo-random numbers (mulberry32, on 32-bit integers), always the same from a seed (the moves tested stay the same
 * from one run to the next).
 * @param {number} seed Seed.
 * @returns {(n: number) => number} An integer from 0 to n - 1.
 */
const randomOf = (seed: number) => {
  let state = seed >>> 0;
  return (n: number) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296) * n);
  };
};

/**
 * Rule ending before a day, as the API ends it (as many occurrences as before it, or up to the day before).
 * @param {Recurrence} weekly Rule.
 * @param {string} start First day.
 * @param {string} date First day left out.
 * @returns {Recurrence} Rule.
 */
const endedBefore = (weekly: Recurrence, start: string, date: string): Recurrence =>
  weekly.count !== null ? { ...weekly, count: Math.max(1, occurrencesBefore(weekly, start, date)) } : { ...weekly, until: addDays(date, -1) };

const LAST = '2029-12-31';
const SEEN = '2028-12-31';

/** A generated move: a weekly rule on several listed weekdays, one occurrence moved to another weekday of its week. */
interface Move {
  weekly: Recurrence;
  start: string;
  date: string;
  to: string;
}

/** Kinds of moves generated. */
interface MovesOptions {
  /** A single listed weekday (it moves with all its occurrences), the routine starting on any weekday. */
  single?: boolean;
  /** Pauses up to two years long (else up to ten days). */
  longPauses?: boolean;
}

/**
 * Moves of one weekday alone, generated: weekdays, rhythm, first day, end (none, a day, a number), excluded days and a
 * pause, the occurrence and its new day.
 * @param {number} seed Seed.
 * @param {number} wanted How many.
 * @param {MovesOptions} [options] Kinds of moves. Optional. Default = several weekdays, short pauses.
 * @returns {Move[]} Moves.
 */
function movesOf(seed: number, wanted: number, { single = false, longPauses = false }: MovesOptions = {}): Move[] {
  const random = randomOf(seed);
  const moves: Move[] = [];
  while (moves.length < wanted) {
    const weekdays = single ? [1 + random(7)] : [...new Set([1 + random(7), 1 + random(7), 1 + random(7)])].sort();
    if (!single && weekdays.length < 2) continue;
    const start = addDays('2026-11-02', random(14));
    const rhythm = [{ interval: 1 }, { interval: 2 }, { weekParity: 'EVEN' as const }][random(3)];
    const end = random(3);
    let weekly = rule({ frequency: 'WEEKLY', weekdays, ...rhythm, until: end === 1 ? addDays(start, 60 + random(120)) : null, count: end === 2 ? 5 + random(15) : null });
    const old = occurrenceDates(weekly, start, start, LAST);
    if (old.length < 6) continue;
    if (random(2)) weekly = { ...weekly, exceptions: [old[2 + random(3)]], pauses: [{ from: old[4 + random(2)], to: addDays(old[4], longPauses ? random(730) : random(10)) }] };
    const occurrences = occurrenceDates(weekly, start, start, LAST);
    if (occurrences.length < 4) continue;
    const date = occurrences[random(Math.min(occurrences.length, 12))];
    const days = random(13) - 6;
    const to = addDays(date, days);
    if (!days || to < start || shiftMovesAll(weekly) !== single || weekdays.includes(weekdayOfDate(to)) || weeksChange(weekly, crossedWeeks(weekdayOfDate(date), days))) continue;
    moves.push({ weekly, start, date, to });
  }
  return moves;
}

/**
 * Former occurrences, those of the weekday moved by as many days (from the cut on, when cut).
 * @param {Move} move Move.
 * @param {boolean} split Cut at the occurrence.
 * @returns {string[]} Expected occurrences, in order.
 */
function expectedOf({ weekly, start, date, to }: Move, split: boolean): string[] {
  const days = (new Date(to).getTime() - new Date(date).getTime()) / 86_400_000;
  return occurrenceDates(weekly, start, start, LAST)
    .map((day) => (weekdayOfDate(day) === weekdayOfDate(date) && (!split || day >= date) ? addDays(day, days) : day))
    .filter((day) => day <= SEEN)
    .sort();
}

describe('one weekday of several moved alone: exactly the former occurrences (generated moves)', () => {
  it('« Toutes »', () => {
    for (const move of movesOf(1, 250)) {
      const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, false);
      const actual = occurrenceDates(piece.recurrence, piece.start, piece.start, SEEN);
      expect(actual, JSON.stringify(move)).toEqual(expectedOf(move, false));
    }
  });

  it('« Celle-ci et les suivantes »: the rule ended before the cut and the one going on, nothing twice, nothing lost', () => {
    for (const move of movesOf(2, 250)) {
      // Nothing before it: the API moves them all (« Toutes »).
      if (occurrenceDates(move.weekly, move.start, move.start, addDays(move.date, -1)).length === 0) continue;
      const before = cutRoutineBefore(move.weekly, move.start, move.date, move.to) ?? endedBefore(move.weekly, move.start, move.date);
      const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, true);
      const actual = [...occurrenceDates(before, move.start, move.start, SEEN), ...occurrenceDates(piece.recurrence, piece.start, piece.start, SEEN)].sort();
      expect(actual, JSON.stringify(move)).toEqual(expectedOf(move, true));
    }
  });

  it('a case with its own end (no next case)', () => {
    for (const move of movesOf(3, 120)) {
      const until = addDays(move.start, 90);
      const item = { until, recurrence: move.weekly };
      const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, false);
      const result = weekdayMovedCase(item, piece.recurrence, move.start, piece.start, move.date, move.to, [], move.start, false);
      const actual = result.until ? occurrenceDates({ ...result.recurrence, until: result.until < (result.recurrence.until ?? result.until) ? result.until : (result.recurrence.until ?? result.until) }, piece.start, piece.start, SEEN) : [];
      const expected = expectedOf({ ...move, weekly: { ...move.weekly, until: move.weekly.until && move.weekly.until < until ? move.weekly.until : until } }, false);
      if (move.date > until) continue;
      expect(actual, JSON.stringify(move)).toEqual(expected);
    }
  });
});

/**
 * Rule ended before the cut, as the API makes it.
 * @param {Move} move Move.
 * @returns {Recurrence} Rule.
 */
const ruleBefore = (move: Move): Recurrence => cutRoutineBefore(move.weekly, move.start, move.date, move.to) ?? endedBefore(move.weekly, move.start, move.date);

describe('weekday moves, more generated moves', () => {
  it('« Toutes », a single listed weekday, the routine starting on any weekday: nothing gained before, nothing lost after', () => {
    for (const move of movesOf(4, 250, { single: true })) {
      const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, false);
      expect(occurrenceDates(piece.recurrence, piece.start, piece.start, SEEN), JSON.stringify(move)).toEqual(expectedOf(move, false));
    }
  });

  it('long pauses holding moved occurrences: cut at them, their other days never turned into excluded dates', () => {
    for (const move of movesOf(5, 250, { longPauses: true })) {
      const shift = daysBetween(move.date, move.to);
      const former = new Set(move.weekly.exceptions.flatMap((day) => [day, addDays(day, shift)]));
      const paused = (day: string) => !former.has(day) && move.weekly.pauses.some((pause) => day >= pause.from && day <= pause.to);
      const all = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, false);
      expect(occurrenceDates(all.recurrence, all.start, all.start, SEEN), JSON.stringify(move)).toEqual(expectedOf(move, false));
      expect(all.recurrence.exceptions.filter(paused), JSON.stringify(move)).toEqual([]);
      if (occurrenceDates(move.weekly, move.start, move.start, addDays(move.date, -1)).length === 0) continue;
      const before = ruleBefore(move);
      const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, true);
      const actual = [...occurrenceDates(before, move.start, move.start, SEEN), ...occurrenceDates(piece.recurrence, piece.start, piece.start, SEEN)].sort();
      expect(actual, JSON.stringify(move)).toEqual(expectedOf(move, true));
      expect([...before.exceptions, ...piece.recurrence.exceptions].filter(paused), JSON.stringify(move)).toEqual([]);
    }
  });

  it('excluded dates already at their most: exactly the former occurrences, or refused (never inexact)', () => {
    /**
     * Result of a move, or null when it is refused as it cannot be exact.
     * @param {() => T} compute Move.
     * @returns {T | null} Result.
     */
    const exactOrRefused = <T,>(compute: () => T): T | null => {
      try {
        return compute();
      } catch (error) {
        expect((error as Error).message).toBe(INEXACT_MOVE_REFUSAL);
        return null;
      }
    };
    let refused = 0;
    let exact = 0;
    for (const move of movesOf(6, 120)) {
      // 5 000 excluded dates in all, years before it, on a weekday it never has.
      const free = [1, 2, 3, 4, 5, 6, 7].find((day) => !move.weekly.weekdays.includes(day) && day !== weekdayOfDate(move.to))!;
      const first = addDays('1990-01-01', (free - weekdayOfDate('1990-01-01') + 7) % 7);
      const padding = Array.from({ length: 5000 - move.weekly.exceptions.length }, (_, index) => addDays(first, 7 * index));
      const crowded: Move = { ...move, weekly: { ...move.weekly, exceptions: [...padding, ...move.weekly.exceptions] } };
      const all = exactOrRefused(() => shiftedRoutinePiece(crowded.weekly, crowded.start, crowded.date, crowded.to, false));
      if (all) expect(occurrenceDates(all.recurrence, all.start, all.start, SEEN), JSON.stringify(move)).toEqual(expectedOf(crowded, false));
      if (all) exact += 1;
      else refused += 1;
      // Cut: the rule before and the one going on, both exact, or refused.
      if (occurrenceDates(crowded.weekly, crowded.start, crowded.start, addDays(crowded.date, -1)).length) {
        const cut = exactOrRefused(() => ({ before: ruleBefore(crowded), piece: shiftedRoutinePiece(crowded.weekly, crowded.start, crowded.date, crowded.to, true) }));
        if (cut) {
          const actual = [...occurrenceDates(cut.before, crowded.start, crowded.start, SEEN), ...occurrenceDates(cut.piece.recurrence, cut.piece.start, cut.piece.start, SEEN)].sort();
          expect(actual, JSON.stringify(move)).toEqual(expectedOf(crowded, true));
        }
      }
      // In a case with its own end.
      const until = addDays(crowded.start, 90);
      if (!all || crowded.date > until) continue;
      const made = exactOrRefused(() => weekdayMovedCase({ until, recurrence: crowded.weekly }, all.recurrence, crowded.start, all.start, crowded.date, crowded.to, [], crowded.start, false));
      if (!made) continue;
      const end = made.recurrence.until && made.recurrence.until < made.until! ? made.recurrence.until : made.until!;
      const former = expectedOf({ ...crowded, weekly: { ...crowded.weekly, until: crowded.weekly.until && crowded.weekly.until < until ? crowded.weekly.until : until } }, false);
      expect(occurrenceDates({ ...made.recurrence, until: end }, all.start, all.start, SEEN), JSON.stringify(move)).toEqual(former);
    }
    // Both happen: the refusal is reached, and a move that fits stays exact.
    expect(refused).toBeGreaterThan(0);
    expect(exact).toBeGreaterThan(0);
  }, 60_000);

  it('« Celle-ci et les suivantes » in a case followed by another one: its piece holds the occurrence moved, or starts past its end (refused)', () => {
    const random = randomOf(70);
    for (const move of movesOf(7, 250)) {
      const until = addDays(move.date, random(4));
      const others = [{ from: addDays(until, 1) }];
      if (occurrenceDates(move.weekly, move.start, move.start, addDays(move.date, -1)).length === 0) continue;
      const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, true);
      const made = { from: move.to, ...weekdayMovedCase({ until, recurrence: move.weekly }, piece.recurrence, move.start, move.to, move.date, move.to, others, move.start, true) };
      if (caseAfterItsEnd(made, move.start)) {
        expect(move.to > made.until!, JSON.stringify(move)).toBe(true);
        continue;
      }
      expect(made.until! < others[0].from, JSON.stringify(move)).toBe(true);
      const end = made.recurrence.until && made.recurrence.until < made.until! ? made.recurrence.until : made.until;
      expect(occurrenceDates({ ...made.recurrence, until: end }, move.to, move.to, SEEN)[0], JSON.stringify(move)).toBe(move.to);
    }
  });
});

describe('one weekday of several moved alone: the cases found', () => {
  it('cut, counted, the new day later with another weekday between: the rule ended before keeps it, the count stays', () => {
    // Mondays and Thursdays ×9 from Monday 2026-10-05; « Celle-ci et les suivantes » on Thursday 10-08 moved to Tuesday 10-13.
    const move: Move = { weekly: rule({ frequency: 'WEEKLY', weekdays: [1, 4], count: 9 }), start: '2026-10-05', date: '2026-10-08', to: '2026-10-13' };
    const before = cutRoutineBefore(move.weekly, move.start, move.date, move.to)!;
    const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, true);
    expect(occurrenceDates(before, move.start, move.start, SEEN)).toEqual(['2026-10-05', '2026-10-12']);
    expect(piece.recurrence.exceptions).toEqual([]);
    expect(occurrenceDates(piece.recurrence, piece.start, piece.start, SEEN)).toEqual(['2026-10-13', '2026-10-19', '2026-10-20', '2026-10-26', '2026-10-27', '2026-11-02', '2026-11-03']);
  });

  it('a case whose only occurrence left moves into the next case (« Toutes »): refused with the next case message', () => {
    // Thursdays and Fridays ×385 from Tuesday 2026-11-10, the case until Thursday 11-12, the next one from 11-13.
    const weekly = rule({ frequency: 'WEEKLY', weekdays: [4, 5], count: 385 });
    const piece = shiftedRoutinePiece(weekly, '2026-11-10', '2026-11-12', '2026-11-17', false);
    expect(() => weekdayMovedCase({ until: '2026-11-12', recurrence: weekly }, piece.recurrence, '2026-11-10', piece.start, '2026-11-12', '2026-11-17', [{ from: '2026-11-13' }], '2026-11-10', false)).toThrow(
      NEXT_CASE_REFUSAL,
    );
  });

  it('a ten-year pause holding a moved occurrence: cut at that day, not a thousand excluded dates', () => {
    // Mondays and Thursdays from Monday 2026-11-02, paused from 11-10 for ten years; the Mondays moved to Wednesdays.
    const weekly = rule({ frequency: 'WEEKLY', weekdays: [1, 4], pauses: [{ from: '2026-11-10', to: '2036-11-10' }] });
    const piece = shiftedRoutinePiece(weekly, '2026-11-02', '2026-11-02', '2026-11-04', false);
    expect(piece.recurrence.pauses).toEqual([
      { from: '2026-11-10', to: '2026-11-10' },
      { from: '2026-11-12', to: '2036-11-10' },
    ]);
    // The Monday 2036-11-10 was paused: its Wednesday stays away.
    expect(piece.recurrence.exceptions).toEqual(['2036-11-12']);
    expect(occurrenceDates(piece.recurrence, piece.start, piece.start, '2026-12-31')).toEqual(['2026-11-04', '2026-11-05', '2026-11-11']);
  });

  it('a single listed weekday, the routine starting on another weekday (« Toutes »): its first day is no occurrence, the count keeps its last one', () => {
    // Mondays ×3 from Friday 2026-11-06, moved to Fridays.
    const weekly = rule({ frequency: 'WEEKLY', weekdays: [1], count: 3 });
    const piece = shiftedRoutinePiece(weekly, '2026-11-06', '2026-11-09', '2026-11-13', false);
    expect(occurrenceDates(piece.recurrence, piece.start, piece.start, SEEN)).toEqual(['2026-11-13', '2026-11-20', '2026-11-27']);
  });

  it('pauses: a paused occurrence stays away once moved, a moved one landing in a pause the other weekdays keep is not lost', () => {
    const weekly = rule({ frequency: 'WEEKLY', weekdays: [1, 4] });
    for (const pauses of [[{ from: '2027-11-08', to: '2027-11-08' }], [{ from: '2027-11-09', to: '2027-11-09' }]]) {
      for (const until of [null, '2028-01-01']) {
        const move: Move = { weekly: { ...weekly, pauses, until }, start: '2026-11-02', date: '2026-11-09', to: '2026-11-10' };
        const piece = shiftedRoutinePiece(move.weekly, move.start, move.date, move.to, false);
        expect(occurrenceDates(piece.recurrence, piece.start, piece.start, SEEN), JSON.stringify(move)).toEqual(expectedOf(move, false));
      }
    }
  });
});
