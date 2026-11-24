import { describe, expect, it } from 'vitest';
import { blockingEvent, busyUntil, nextAllowedMoment, nextInSlotsOf, sharePeople, type BusyEvent } from '../../src/calendar/event-busy';
import { scheduleSlotsOn } from '../../src/calendar/slot-conditions';
import { PARIS_ZONE } from '../../src/dates/days';
import { schedule, scheduleCase } from './schedules';

const ME = 'me';
const DAY = '2026-11-23';

/**
 * Timed event of a test, 10:00–11:00 in Paris on DAY (09:00–10:00 UTC), with nobody (« Moi »).
 * @param {Partial<BusyEvent>} fields Fields changed.
 * @returns {BusyEvent} Event.
 */
const event = (fields: Partial<BusyEvent> = {}): BusyEvent => ({
  label: 'Réunion',
  allDay: false,
  startDate: DAY,
  endDate: DAY,
  start: '2026-11-23T09:00:00.000Z',
  end: '2026-11-23T10:00:00.000Z',
  contributorIds: [],
  taskIds: [],
  calledOff: false,
  ...fields,
});
const at = (iso: string) => new Date(iso);

describe('blockingEvent', () => {
  it('an event at the moment, with someone in common, keeps the item from being done; its end is excluded', () => {
    expect(blockingEvent([event()], { assigneeIds: [] }, ME, at('2026-11-23T09:30:00Z'), DAY)).toBeDefined();
    expect(blockingEvent([event()], { assigneeIds: [] }, ME, at('2026-11-23T10:00:00Z'), DAY)).toBeUndefined();
  });

  it('an event without anyone and an item without assignee count as « Moi »', () => {
    expect(blockingEvent([event({ contributorIds: [ME] })], { assigneeIds: [] }, ME, at('2026-11-23T09:30:00Z'), DAY)).toBeDefined();
    expect(blockingEvent([event()], { assigneeIds: [ME] }, ME, at('2026-11-23T09:30:00Z'), DAY)).toBeDefined();
    expect(blockingEvent([event({ contributorIds: ['ana'] })], { assigneeIds: ['bob'] }, ME, at('2026-11-23T09:30:00Z'), DAY)).toBeUndefined();
  });

  it('a called off event, one about the task, or about the routine that day, does not block', () => {
    const moment = at('2026-11-23T09:30:00Z');
    expect(blockingEvent([event({ calledOff: true })], { assigneeIds: [] }, ME, moment, DAY)).toBeUndefined();
    expect(blockingEvent([event({ taskIds: ['t'] })], { assigneeIds: [], taskId: 't' }, ME, moment, DAY)).toBeUndefined();
    expect(blockingEvent([event({ routineLinks: [{ routineId: 'r', date: DAY }] })], { assigneeIds: [], routineId: 'r' }, ME, moment, DAY)).toBeUndefined();
    expect(blockingEvent([event({ routineLinks: [{ routineId: 'r', date: '2026-11-22' }] })], { assigneeIds: [], routineId: 'r' }, ME, moment, DAY)).toBeDefined();
    expect(blockingEvent([event({ routineLinks: [{ routineId: 'r', date: '2026-11-22', shownDate: DAY }] })], { assigneeIds: [], routineId: 'r' }, ME, moment, DAY)).toBeUndefined();
  });

  it('an all-day event blocks its whole Paris days', () => {
    const allDay = event({ allDay: true, endDate: '2026-11-24' });
    expect(blockingEvent([allDay], { assigneeIds: [] }, ME, at('2026-11-24T22:30:00Z'), '2026-11-24')).toBeDefined();
    expect(blockingEvent([allDay], { assigneeIds: [] }, ME, at('2026-11-24T23:30:00Z'), '2026-11-25')).toBeUndefined();
  });

  it('nobody: nothing blocks', () => {
    expect(blockingEvent([event()], { assigneeIds: [] }, null, at('2026-11-23T09:30:00Z'), DAY)).toBeUndefined();
  });
});

describe('busyUntil', () => {
  it('the end of a timed event; the Paris midnight after the last day of an all-day one', () => {
    expect(busyUntil(event()).toISOString()).toBe('2026-11-23T10:00:00.000Z');
    expect(busyUntil(event({ allDay: true })).toISOString()).toBe('2026-11-23T23:00:00.000Z');
    // The midnight starting 2026-10-25 is still summer time (the change is at 03:00).
    expect(busyUntil(event({ allDay: true, endDate: '2026-10-24' })).toISOString()).toBe('2026-10-24T22:00:00.000Z');
  });
});

describe('nextAllowedMoment', () => {
  const context = { events: [event(), event({ start: '2026-11-23T10:00:00.000Z', end: '2026-11-23T11:00:00.000Z' })], meId: ME, timeZone: PARIS_ZONE };

  it('the moment itself when free; past the events in a row otherwise', () => {
    expect(nextAllowedMoment({ assigneeIds: [] }, at('2026-11-23T08:00:00Z'), context)?.toISOString()).toBe('2026-11-23T08:00:00.000Z');
    expect(nextAllowedMoment({ assigneeIds: [] }, at('2026-11-23T09:15:00Z'), context)?.toISOString()).toBe('2026-11-23T11:00:00.000Z');
  });

  it('the next moment the condition allows, in Paris time, then past the events', () => {
    const slotsOn = scheduleSlotsOn([schedule([scheduleCase({ frequency: 'DAILY' }, { times: { allDay: false, ranges: [{ start: '10:00', end: '12:00' }] } })], { id: 'work' })]);
    const nextInSlots = nextInSlotsOf({ type: 'group', id: 'g', combinator: 'and', children: [{ type: 'condition', id: 'c', field: 'schedules', operator: 'in', value: ['work'] }] }, slotsOn);
    // 08:00 in Paris: the slot opens at 10:00 Paris (09:00 UTC); events fill it until its end (12:00 Paris): the next
    // day at 10:00 Paris.
    expect(nextInSlots(at('2026-11-23T07:00:00Z'))?.toISOString()).toBe('2026-11-23T09:00:00.000Z');
    expect(nextAllowedMoment({ assigneeIds: [] }, at('2026-11-23T07:00:00Z'), { ...context, nextInSlots })?.toISOString()).toBe('2026-11-24T09:00:00.000Z');
    const shortContext = { ...context, events: [event()], nextInSlots };
    expect(nextAllowedMoment({ assigneeIds: [] }, at('2026-11-23T07:00:00Z'), shortContext)?.toISOString()).toBe('2026-11-23T10:00:00.000Z');
  });

  it('none within 14 days: null', () => {
    expect(nextAllowedMoment({ assigneeIds: [] }, at('2026-11-23T08:00:00Z'), { ...context, nextInSlots: () => null })).toBeNull();
    expect(nextAllowedMoment({ assigneeIds: [] }, at('2026-11-23T08:00:00Z'), { ...context, nextInSlots: () => at('2026-12-08T08:00:00Z') })).toBeNull();
  });
});

describe('sharePeople', () => {
  it('a task can be about an event when they share someone, or one side has nobody', () => {
    expect(sharePeople(['a'], ['a', 'b'])).toBe(true);
    expect(sharePeople([], ['b'])).toBe(true);
    expect(sharePeople(['a'], [])).toBe(true);
    expect(sharePeople(['a'], ['b'])).toBe(false);
  });
});
