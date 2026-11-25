import { describe, expect, it } from 'vitest';
import { myDayRows, type MyDayItem, type MyDayLayout, type MyDaySlot } from '../../src/calendar/my-day';
import { parisInstant } from '../../src/dates/reminders';

const TODAY = '2026-11-25';
const NOW = parisInstant(TODAY, '10:30');

/**
 * Item of a test.
 * @param {string} key Key.
 * @param {MyDayItem['kind']} kind Kind.
 * @param {Partial<MyDayItem>} [fields] Other fields. Optional.
 * @returns {MyDayItem} Item.
 */
const item = (key: string, kind: MyDayItem['kind'], fields: Partial<MyDayItem> = {}): MyDayItem => ({ key, kind, ...fields });

/**
 * Keys of the blocks of a layout, the hours as « HH: keys ».
 * @param {MyDayLayout<MyDayItem, MyDaySlot>} layout Layout.
 * @returns {object} Keys.
 */
const keys = (layout: MyDayLayout<MyDayItem, MyDaySlot>) => ({
  header: layout.header.map((row) => row.item.key),
  unscheduled: layout.unscheduled.map((row) => row.item.key),
  hours: layout.hours.map((hour) => `${hour.hour}: ${hour.rows.map((row) => row.item.key).join(' ')}`.trim()),
  finished: layout.finished.map((row) => row.item.key),
});

describe('myDayRows: the blocks of a day', () => {
  it('head: éphémérides, events of the whole day, birthdays, late routines (today only)', () => {
    const items = [
      item('late', 'routine', { late: true, time: { start: '08:00', end: null } }),
      item('birthday', 'birthday'),
      item('holiday', 'event', { allDay: true }),
      item('ephemeris', 'ephemeris'),
    ];
    expect(keys(myDayRows(items, { day: TODAY, now: NOW })).header).toEqual(['ephemeris', 'holiday', 'birthday', 'late']);
    // Another day, a late routine is at its time.
    expect(keys(myDayRows(items, { day: '2026-11-24', now: NOW }))).toMatchObject({ header: ['ephemeris', 'holiday', 'birthday'], hours: ['8: late'] });
  });

  it('an event over several days: at its start the first day, in the head the middle days, at its end the last day', () => {
    const trip = item('trip', 'event', { startDate: '2026-11-24', endDate: '2026-11-26', time: { start: '18:00', end: '14:00' } });
    const first = myDayRows([trip], { day: '2026-11-24', now: NOW });
    expect(keys(first).hours).toEqual(['18: trip']);
    expect(first.hours[0].rows[0].part).toBe('start');
    expect(keys(myDayRows([trip], { day: TODAY, now: NOW }))).toMatchObject({ header: ['trip'], hours: ['10:'] });
    const last = myDayRows([trip], { day: '2026-11-26', now: NOW });
    expect(keys(last).hours).toEqual(['14: trip']);
    expect(last.hours[0].rows[0]).toMatchObject({ time: '14:00', part: 'end' });
    // Ending at midnight: it ended the day before.
    expect(keys(myDayRows([{ ...trip, time: { start: '18:00', end: '00:00' } }], { day: '2026-11-26', now: NOW })).hours).toEqual([]);
    expect(keys(myDayRows([trip], { day: '2026-11-27', now: NOW }))).toEqual({ header: [], unscheduled: [], hours: [], finished: [] });
  });

  it('without hours nor limit at the top; no window that day at the top too', () => {
    const layout = myDayRows([item('free', 'task'), item('never', 'task', { windows: [] }), item('routine', 'routine')], { day: TODAY, now: NOW });
    expect(keys(layout).unscheduled).toEqual(['routine', 'free', 'never']);
    expect(keys(myDayRows([item('never', 'task', { windows: [] }), item('free', 'task')], { day: TODAY, now: NOW })).unscheduled).toEqual(['free', 'never']);
    // A single window of the whole day: nothing limits it.
    expect(keys(myDayRows([item('whole', 'task', { windows: [{ fromTime: null, dueTime: null }] })], { day: TODAY, now: NOW })).unscheduled).toEqual(['whole']);
  });

  it('ordered by time, then events, routines, tasks; a time « jusqu’à » alone places it', () => {
    const items = [
      item('task', 'task', { windows: [{ fromTime: '09:00', dueTime: null }] }),
      item('until', 'routine', { time: { start: null, end: '09:00' } }),
      item('meeting', 'event', { time: { start: '09:00', end: '10:00' } }),
      item('early', 'routine', { time: { start: '09:15', end: null } }),
    ];
    expect(keys(myDayRows(items, { day: '2026-11-26', now: NOW })).hours).toEqual(['9: meeting until task early']);
  });

  it('several windows: the next one still to come today, the first one another day, the others told', () => {
    const windows = [
      { fromTime: null, dueTime: '08:00' },
      { fromTime: '12:00', dueTime: '13:00' },
      { fromTime: '19:00', dueTime: null },
    ];
    const today = myDayRows([item('call', 'task', { windows })], { day: TODAY, now: NOW });
    expect(keys(today).hours).toEqual(['10:', '12: call']);
    expect(today.hours[1].rows[0]).toMatchObject({ time: '12:00', window: windows[1], otherWindows: [windows[0], windows[2]] });
    expect(keys(myDayRows([item('call', 'task', { windows })], { day: '2026-11-26', now: NOW })).hours).toEqual(['0: call']);
    // A window under way is still to come; once all are past, the last one.
    expect(keys(myDayRows([item('call', 'task', { windows })], { day: TODAY, now: parisInstant(TODAY, '12:59') })).hours).toEqual(['12: call']);
    // Under way today: at the time of now.
    const underWay = myDayRows([item('call', 'task', { windows: [{ fromTime: null, dueTime: '12:00' }] })], { day: TODAY, now: NOW });
    expect(underWay.hours.map((hour) => [hour.hour, hour.rows.map((row) => row.time).join()])).toEqual([[10, '10:30']]);
    const past = [windows[0], windows[1]];
    expect(keys(myDayRows([item('call', 'task', { windows: past })], { day: TODAY, now: parisInstant(TODAY, '20:00') })).hours).toEqual(['12: call', '20:']);
  });

  it('done at the bottom in the order they were done, then cancelled; a cancelled event stays at its place', () => {
    const items = [
      item('cancelled', 'task', { cancelled: true }),
      item('late-done', 'routine', { done: true, doneAt: '09:40', time: { start: '08:00', end: null } }),
      item('done-early', 'task', { done: true, doneAt: '07:05' }),
      item('called-off', 'event', { cancelled: true, time: { start: '15:00', end: '16:00' } }),
    ];
    expect(keys(myDayRows(items, { day: TODAY, now: NOW }))).toMatchObject({ hours: ['10:', '15: called-off'], finished: ['done-early', 'late-done', 'cancelled'] });
    // Done or cancelled before late or all day.
    const others = [item('late-cancelled', 'routine', { late: true, cancelled: true }), item('all-day-done', 'routine', { allDay: true, done: true })];
    expect(keys(myDayRows(others, { day: TODAY, now: NOW }))).toMatchObject({ header: [], finished: ['all-day-done', 'late-cancelled'] });
  });

  it('linked to an event shown that day: under it, nowhere else, done last', () => {
    const items = [
      item('slides', 'task', { eventKeys: ['other', 'meeting'], windows: [{ fromTime: '08:00', dueTime: null }] }),
      item('notes', 'task', { eventKeys: ['meeting'], done: true, doneAt: '09:00' }),
      item('meeting', 'event', { time: { start: '14:00', end: '15:00' } }),
      item('alone', 'task', { eventKeys: ['absent'] }),
    ];
    const layout = myDayRows(items, { day: TODAY, now: NOW });
    expect(keys(layout)).toEqual({ header: [], unscheduled: ['alone'], hours: ['10:', '14: meeting'], finished: [] });
    expect(layout.hours[1].rows[0].children.map((row) => row.item.key)).toEqual(['slides', 'notes']);
  });

  it('hours shown: those with a row, a slot, or the hour of now; slots met and unavailable', () => {
    const slots: MyDaySlot[] = [
      { scheduleId: 'work', start: '09:00', end: '10:30', allDay: false },
      { scheduleId: 'sleep', start: '22:30', end: '23:59', allDay: false, unavailable: true },
    ];
    const layout = myDayRows([item('meeting', 'event', { time: { start: '14:00', end: '15:00' } })], { day: TODAY, now: NOW, slots });
    expect(layout.hours.map(({ hour, current, unavailable, slots }) => [hour, current, unavailable, slots.map((slot) => slot.scheduleId).join()])).toEqual([
      [9, false, false, 'work'],
      [10, true, false, 'work'],
      [14, false, false, ''],
      [22, false, true, 'sleep'],
      [23, false, true, 'sleep'],
    ]);
    // A slot of the whole day colours the hours shown, without showing them all.
    const off: MyDaySlot = { scheduleId: 'off', start: '00:00', end: '23:59', allDay: false, unavailable: true };
    expect(myDayRows([], { day: TODAY, now: NOW, slots: [off] }).hours.map(({ hour, unavailable }) => [hour, unavailable])).toEqual([[10, true]]);
    // Another day: no hour of now.
    expect(myDayRows([], { day: '2026-11-26', now: NOW }).hours).toEqual([]);
  });

  it('today and the hour of now in Paris, around the changes of time', () => {
    // 2026-03-29: 01:59 then 03:00 in Paris.
    const spring = myDayRows([], { day: '2026-03-29', now: new Date('2026-03-29T01:30:00Z') });
    expect(spring.hours.map((hour) => [hour.hour, hour.current])).toEqual([[3, true]]);
    // 2026-10-25: 02:00–02:59 twice; 23:30 in Paris is 22:30 UTC.
    expect(myDayRows([], { day: '2026-10-25', now: new Date('2026-10-25T22:30:00Z') }).hours.map((hour) => hour.hour)).toEqual([23]);
    expect(myDayRows([], { day: '2026-10-25', now: new Date('2026-10-25T23:30:00Z') }).hours).toEqual([]);
    // Midnight in Paris is still the day before in New York, already the day after in Tokyo.
    expect(myDayRows([], { day: TODAY, now: new Date('2026-11-24T23:10:00Z') }).hours.map((hour) => hour.hour)).toEqual([0]);
  });
});
