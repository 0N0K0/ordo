import { describe, expect, it } from 'vitest';
import {
  countdownExtensionSchema,
  countdownInputSchema,
  countdownRemaining,
  countdownRingText,
  deadTimesSchema,
  readDeadTimes,
  recordRingAgain,
  savedCountdownLinksSchema,
} from '../../src/dates/countdowns';
import { RING_LATE_MS } from '../../src/dates/ringing';

describe('timers', () => {
  it('a timer lasts 1 minute to 24 hours; its ringtone outside the bank reads as none; no name: none', () => {
    expect(countdownInputSchema.safeParse({ seconds: 59 }).success).toBe(false);
    expect(countdownInputSchema.safeParse({ seconds: 86_401 }).success).toBe(false);
    expect(countdownInputSchema.parse({ seconds: 600, ringtone: 'gone' })).toMatchObject({ label: null, seconds: 600, ringtone: null });
  });

  it('extended by 1 to 60 minutes', () => {
    expect(countdownExtensionSchema.safeParse(0).error?.issues[0].message).toBe('Au moins 1 minute.');
    expect(countdownExtensionSchema.safeParse(61).error?.issues[0].message).toBe('60 minutes maximum.');
  });

  it('seconds left: until its end while it runs (rounded up), those kept while paused, 0 once over', () => {
    const now = Date.parse('2026-11-23T10:00:00Z');
    expect(countdownRemaining({ endsAt: '2026-11-23T10:01:00.500Z', remainingSeconds: null }, now)).toBe(61);
    expect(countdownRemaining({ endsAt: null, remainingSeconds: 42 }, now)).toBe(42);
    expect(countdownRemaining({ endsAt: '2026-11-23T09:59:00Z', remainingSeconds: null }, now)).toBe(0);
  });

  it('its ring: its name (else « Minuteur »), its item and « Minuteur de 1 h 30 terminé »', () => {
    expect(countdownRingText({ label: null, subject: 'Lessive', durationSeconds: 5400 })).toEqual({ title: 'Minuteur', lines: ['Lessive', 'Minuteur de 1 h 30 terminé'] });
    expect(countdownRingText({ label: 'Thé', subject: null, durationSeconds: 180 })).toEqual({ title: 'Thé', lines: ['Minuteur de 3 min terminé'] });
  });

  it('20 saved timers at most per item, each once', () => {
    expect(savedCountdownLinksSchema.parse(['a', 'b', 'a'])).toEqual(['a', 'b']);
    expect(savedCountdownLinksSchema.safeParse(Array.from({ length: 21 }, (_, index) => `c${index}`)).error?.issues[0].message).toBe('20 minuteurs au plus.');
  });
});

describe('recordRingAgain: the ring of a timer the API did not record yet (a device clock ahead)', () => {
  const end = '2026-11-23T10:00:00.000Z';
  const rang = { endsAt: end, remainingSeconds: null };
  const now = Date.parse(end) - 10_000;

  it('still shown with the end it rang at: recorded again', () => {
    expect(recordRingAgain(rang, { endsAt: end, remainingSeconds: null }, now)).toBe(true);
    expect(recordRingAgain(rang, { endsAt: new Date(end), remainingSeconds: null }, now)).toBe(true);
  });

  it('paused, given more minutes, rung or cancelled elsewhere meanwhile: not recorded again', () => {
    expect(recordRingAgain(rang, { endsAt: null, remainingSeconds: 30 }, now)).toBe(false);
    expect(recordRingAgain(rang, { endsAt: '2026-11-23T10:01:00.000Z', remainingSeconds: null }, now)).toBe(false);
    expect(recordRingAgain(rang, undefined, now)).toBe(false);
  });

  it('ended more than 6 hours ago: no longer recorded (the API does it as it reads them)', () => {
    expect(recordRingAgain(rang, rang, Date.parse(end) + RING_LATE_MS)).toBe(true);
    expect(recordRingAgain(rang, rang, Date.parse(end) + RING_LATE_MS + 1)).toBe(false);
  });

  it('a timer paused when it rang has no end to record', () => {
    expect(recordRingAgain({ endsAt: null, remainingSeconds: 0 }, { endsAt: null, remainingSeconds: 0 }, now)).toBe(false);
  });
});

describe('dead times', () => {
  it('a label, 1 minute to 24 hours, 20 at most', () => {
    expect(deadTimesSchema.safeParse([{ label: '', minutes: 30 }]).error?.issues[0].message).toBe('Le libellé est requis.');
    expect(deadTimesSchema.safeParse([{ label: 'Lessive', minutes: 1441 }]).error?.issues[0].message).toBe('24 heures maximum.');
    expect(deadTimesSchema.safeParse(Array(21).fill({ label: 'Lessive', minutes: 30 })).error?.issues[0].message).toBe('20 temps morts au plus.');
  });

  it('read back: invalid ones left out, a ringtone kept only when chosen', () => {
    expect(readDeadTimes([{ label: 'Lessive', minutes: 90 }, { label: 'Four', minutes: 0 }, { label: 'Thé', minutes: 3, ringtone: 'bip' }])).toEqual([
      { label: 'Lessive', minutes: 90 },
      { label: 'Thé', minutes: 3, ringtone: 'bip' },
    ]);
  });
});
