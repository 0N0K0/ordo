import { describe, expect, it } from 'vitest';
import { canScheduleAt, earliestSchedule, SCHEDULE_MIN_DELAY_MS } from '../../src/mail/mail';

describe('canScheduleAt', () => {
  const now = Date.parse('2026-11-25T10:00:00Z');

  it('accepts a moment at least the least delay after now', () => {
    expect(canScheduleAt(new Date(now + SCHEDULE_MIN_DELAY_MS), now)).toBe(true);
    expect(canScheduleAt(new Date(now + 3_600_000), now)).toBe(true);
  });

  it('refuses a moment passed, too close or invalid', () => {
    expect(canScheduleAt(new Date(now - 60_000), now)).toBe(false);
    expect(canScheduleAt(new Date(now + SCHEDULE_MIN_DELAY_MS - 1), now)).toBe(false);
    expect(canScheduleAt(new Date(Number.NaN), now)).toBe(false);
  });

  it('gives the earliest moment', () => {
    expect(earliestSchedule(now)).toBe(now + SCHEDULE_MIN_DELAY_MS);
  });
});
