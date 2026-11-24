import { describe, expect, it } from 'vitest';
import { linkedEventOccurrence, occurrencesShowing, type ShownEventOccurrence } from '../../src/calendar/calendar';

/**
 * Occurrence of a test, shown on its own days.
 * @param {string} occurrenceDate Day that identifies it.
 * @param {string} [startDate] First day shown. Optional. Default = the day that identifies it.
 * @param {string} [endDate] Last day shown. Optional. Default = its first day.
 * @returns {ShownEventOccurrence} Occurrence.
 */
const shown = (occurrenceDate: string, startDate = occurrenceDate, endDate = startDate): ShownEventOccurrence => ({ occurrenceDate, startDate, endDate });

describe('occurrencesShowing', () => {
  it('the occurrences whose days hold the day, first and last included', () => {
    const occurrences = [shown('2026-11-02', '2026-11-02', '2026-11-04'), shown('2026-11-09')];
    expect(occurrencesShowing(occurrences, '2026-11-02')).toEqual([occurrences[0]]);
    expect(occurrencesShowing(occurrences, '2026-11-04')).toEqual([occurrences[0]]);
    expect(occurrencesShowing(occurrences, '2026-11-05')).toEqual([]);
  });
});

describe('linkedEventOccurrence', () => {
  it('an occurrence on its day: the link follows it', () => {
    expect(linkedEventOccurrence([shown('2026-11-02'), shown('2026-11-09')], '2026-11-09')).toBe('2026-11-09');
  });

  it('an occurrence moved alone: the link shown on its new day follows it, not the occurrence of the rule of that day', () => {
    // The Monday 11-02 moved alone to Thursday 11-19, past a cut on 11-16.
    const occurrences = [shown('2026-11-02', '2026-11-19'), shown('2026-11-16')];
    expect(linkedEventOccurrence(occurrences, '2026-11-19')).toBe('2026-11-02');
  });

  it('an occurrence moved alone before a cut: the link of its new day follows it', () => {
    const occurrences = [shown('2026-11-09'), shown('2026-11-20', '2026-11-10')];
    expect(linkedEventOccurrence(occurrences, '2026-11-10')).toBe('2026-11-20');
  });

  it('an occurrence longer than its series: the links of its extra days follow it', () => {
    expect(linkedEventOccurrence([shown('2026-11-02', '2026-11-02', '2026-11-04')], '2026-11-04')).toBe('2026-11-02');
  });

  it('no occurrence on the day: none', () => {
    expect(linkedEventOccurrence([shown('2026-11-02')], '2026-11-03')).toBeNull();
  });

  it('several occurrences on the day (one moved onto another, overlapping ones): none, the link goes by its day', () => {
    expect(linkedEventOccurrence([shown('2026-11-02', '2026-11-09'), shown('2026-11-09')], '2026-11-09')).toBeNull();
    expect(linkedEventOccurrence([shown('2026-11-02', '2026-11-02', '2026-11-03'), shown('2026-11-03', '2026-11-03', '2026-11-04')], '2026-11-03')).toBeNull();
  });
});
