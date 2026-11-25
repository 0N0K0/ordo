import { describe, expect, it } from 'vitest';
import { cutRoutineBefore, shiftedRoutinePiece, shiftMovesAll, weekdayMovedCase } from '../../src/routines/routines';
import { crossedWeeks, occurrenceDates, occurrencesBefore, weeksChange, type Recurrence } from '../../src/dates/recurrence';
import { addDays, weekdayOfDate } from '../../src/dates/days';
import { rule } from '../rules';

/**
 * Pseudo-random numbers, always the same from a seed (the moves tested stay the same from one run to the next).
 * @param {number} seed Seed.
 * @returns {(n: number) => number} An integer from 0 to n - 1.
 */
const randomOf = (seed: number) => {
  let state = seed;
  return (n: number) => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state % n;
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

/**
 * Moves of one weekday alone, generated: weekdays, rhythm, first day, end (none, a day, a number), excluded days and a
 * pause, the occurrence and its new day.
 * @param {number} seed Seed.
 * @param {number} wanted How many.
 * @returns {Move[]} Moves.
 */
function movesOf(seed: number, wanted: number): Move[] {
  const random = randomOf(seed);
  const moves: Move[] = [];
  while (moves.length < wanted) {
    const weekdays = [...new Set([1 + random(7), 1 + random(7), 1 + random(7)])].sort();
    if (weekdays.length < 2) continue;
    const start = addDays('2026-11-02', random(14));
    const rhythm = [{ interval: 1 }, { interval: 2 }, { weekParity: 'EVEN' as const }][random(3)];
    const end = random(3);
    let weekly = rule({ frequency: 'WEEKLY', weekdays, ...rhythm, until: end === 1 ? addDays(start, 60 + random(120)) : null, count: end === 2 ? 5 + random(15) : null });
    const old = occurrenceDates(weekly, start, start, LAST);
    if (old.length < 6) continue;
    if (random(2)) weekly = { ...weekly, exceptions: [old[2 + random(3)]], pauses: [{ from: old[4 + random(2)], to: addDays(old[4], random(10)) }] };
    const occurrences = occurrenceDates(weekly, start, start, LAST);
    if (occurrences.length < 4) continue;
    const date = occurrences[random(Math.min(occurrences.length, 12))];
    const days = random(13) - 6;
    const to = addDays(date, days);
    if (!days || to < start || shiftMovesAll(weekly) || weekdays.includes(weekdayOfDate(to)) || weeksChange(weekly, crossedWeeks(weekdayOfDate(date), days))) continue;
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
