import { describe, expect, it } from 'vitest';
import { upcomingReminders, UPCOMING_REMINDER_DAYS } from '../../src/dates/upcoming-reminders';
import { routineRings, taskRings } from '../../src/dates/reminder-rings';
import { scheduleCase } from '../calendar/schedules';
import type { ReminderValue } from '../../src/dates/reminders';

// 09:00 in Paris (UTC+1 in November).
const NOW = new Date('2026-11-26T08:00:00Z');

/**
 * An event occurrence of a series, with hours (Paris).
 * @param {string} eventId Event.
 * @param {string} day Day.
 * @param {string} time Start (HH:MM, Paris).
 * @param {ReminderValue[]} reminders Reminders of the series.
 * @param {boolean} [calledOff] Cancelled. Optional.
 * @returns {object} Occurrence.
 */
const occurrence = (eventId: string, day: string, time: string, reminders: ReminderValue[], calledOff = false) => {
  const start = new Date(`${day}T${time}:00+01:00`);
  return {
    eventId,
    key: `${eventId}|${day}`,
    label: `Évènement ${eventId}`,
    allDay: false,
    startDate: day,
    startTime: time,
    endDate: day,
    start,
    end: new Date(start.getTime() + 3600_000),
    calledOff,
    reminders,
  };
};

/**
 * An open task.
 * @param {string} id Task.
 * @param {object} fields Other fields.
 * @returns {object} Task.
 */
const task = (
  id: string,
  fields: {
    minDate?: string | null;
    deadline?: string | null;
    reminders: ReminderValue[];
    closed?: boolean;
    label?: string;
  },
) => ({
  id,
  label: fields.label ?? `Tâche ${id}`,
  closed: fields.closed ?? false,
  archived: false,
  effectiveMinDate: fields.minDate ?? null,
  effectiveDeadline: fields.deadline ?? null,
  reminders: fields.reminders,
});

/**
 * A routine without hours, with the occurrences its reminders ring for.
 * @param {string} id Routine.
 * @param {string[]} dates Due days of its occurrences (opening the same day).
 * @param {ReminderValue[]} reminders Reminders.
 * @param {boolean} [hasSubRoutines] A parent. Optional.
 * @returns {object} Routine.
 */
const routine = (id: string, dates: string[], reminders: ReminderValue[], hasSubRoutines = false) => ({
  id,
  label: `Routine ${id}`,
  archived: false,
  estimate: null,
  currentDate: dates[0],
  reminders,
  reminderOccurrences: dates.map((date) => ({
    date,
    day: date,
    slots: [{ slot: 0, fromTime: null, dueTime: null }],
  })),
  slots: [{ index: 0, fromTime: null, dueTime: null }],
  hasSubRoutines,
});

/**
 * Keys and instants of reminders to come.
 * @param {{ key: string, at: Date }[]} list Reminders.
 * @returns {[string, string][]} Keys and ISO instants.
 */
const shown = (list: { key: string; at: Date }[]) => list.map((ring) => [ring.key, ring.at.toISOString()]);

describe('upcomingReminders', () => {
  it('looks 30 days ahead', () => {
    expect(UPCOMING_REMINDER_DAYS).toBe(30);
  });

  it('an event: the reminders of its next occurrence only', () => {
    const series = [
      occurrence('e', '2026-11-27', '10:00', [
        { before: 15, at: null },
        { before: 60, at: null },
      ]),
      occurrence('e', '2026-12-04', '10:00', [
        { before: 15, at: null },
        { before: 60, at: null },
      ]),
    ];
    expect(shown(upcomingReminders({ occurrences: series, tasks: [], routines: [] }, NOW))).toEqual([
      ['event:e|2026-11-27:before:60', '2026-11-27T08:00:00.000Z'],
      ['event:e|2026-11-27:before:15', '2026-11-27T08:45:00.000Z'],
    ]);
  });

  it('an occurrence whose reminders have all rung, or cancelled, gives way to the next one', () => {
    const series = [
      occurrence('e', '2026-11-26', '09:10', [{ before: 15, at: null }]),
      occurrence('e', '2026-11-27', '09:10', [{ before: 15, at: null }], true),
      occurrence('e', '2026-11-28', '09:10', [{ before: 15, at: null }]),
    ];
    expect(shown(upcomingReminders({ occurrences: series, tasks: [], routines: [] }, NOW))).toEqual([['event:e|2026-11-28:before:15', '2026-11-28T07:55:00.000Z']]);
  });

  it('within the next 30 days only', () => {
    const inside = occurrence('a', '2027-01-10', '10:00', [{ before: null, at: '09:00', days: 30 }]);
    const outside = occurrence('b', '2027-01-30', '10:00', [{ before: null, at: '09:00', days: 30 }]);
    expect(shown(upcomingReminders({ occurrences: [inside, outside], tasks: [], routines: [] }, NOW))).toEqual([['event:a|2027-01-10:days:30:09:00', '2026-12-11T08:00:00.000Z']]);
  });

  it('a task: its next day only for « À HH:MM » (several times that day), with its « N jours avant »; those passed and of closed tasks left out', () => {
    const open = task('t', {
      minDate: '2026-11-25',
      deadline: '2026-11-28',
      reminders: [
        { before: null, at: '08:00' },
        { before: null, at: '12:00' },
        { before: null, at: '18:00', days: 2 },
      ],
    });
    const closed = task('c', {
      deadline: '2026-11-28',
      reminders: [{ before: null, at: '08:00' }],
      closed: true,
    });
    expect(shown(upcomingReminders({ occurrences: [], tasks: [open, closed], routines: [] }, NOW))).toEqual([
      ['task:t:2026-11-26:at:12:00', '2026-11-26T11:00:00.000Z'],
      ['task:t:2026-11-28:days:2:18:00', '2026-11-26T17:00:00.000Z'],
    ]);
  });

  it('a task whose times of today have all rung: its next day', () => {
    const daily = task('d', { minDate: '2026-11-20', deadline: '2026-12-31', reminders: [{ before: null, at: '08:00' }] });
    expect(shown(upcomingReminders({ occurrences: [], tasks: [daily], routines: [] }, NOW))).toEqual([['task:d:2026-11-27:at:08:00', '2026-11-27T07:00:00.000Z']]);
  });

  it('only the reminders of the item itself: a sub-task going by the dates of its parent has none of its reminders', () => {
    const parent = task('p', {
      deadline: '2026-11-27',
      reminders: [{ before: null, at: '08:00' }],
    });
    const child = task('s', { deadline: '2026-11-27', reminders: [] });
    expect(upcomingReminders({ occurrences: [], tasks: [parent, child], routines: [] }, NOW).map((ring) => ring.item.id)).toEqual(['p']);
  });

  it('a routine: its next occurrence only; a parent routine rings nothing, its sub-routines their own', () => {
    const daily = routine('r', ['2026-11-26', '2026-11-27'], [{ before: null, at: '18:00' }]);
    const parent = routine('p', ['2026-11-26'], [{ before: null, at: '12:00' }], true);
    const sub = routine('s', ['2026-11-27'], [{ before: null, at: '07:00' }]);
    const list = upcomingReminders({ occurrences: [], tasks: [], routines: [daily, parent, sub] }, NOW);
    expect(shown(list)).toEqual([
      ['routine:r|2026-11-26:at:18:00', '2026-11-26T17:00:00.000Z'],
      ['routine:s|2026-11-27:at:07:00', '2026-11-27T06:00:00.000Z'],
    ]);
    expect(list.map((ring) => (ring.kind === 'routine' ? [ring.occurrenceDate, ring.due?.day] : null))).toEqual([
      ['2026-11-26', '2026-11-26'],
      ['2026-11-27', '2026-11-27'],
    ]);
  });

  it('a routine: its next occurrence by due day (one moved later and kept apart comes after)', () => {
    const moved = {
      ...routine('r', [], [{ before: null, at: '18:00' }]),
      reminderOccurrences: [
        {
          date: '2026-11-26',
          dueDate: '2026-11-30',
          day: '2026-11-30',
          slots: [{ slot: 0, fromTime: null, dueTime: null }],
        },
        {
          date: '2026-11-28',
          day: '2026-11-28',
          slots: [{ slot: 0, fromTime: null, dueTime: null }],
        },
      ],
    };
    const list = upcomingReminders({ occurrences: [], tasks: [], routines: [moved] }, NOW);
    expect(shown(list)).toEqual([['routine:r|2026-11-28:at:18:00', '2026-11-28T17:00:00.000Z']]);
  });

  it('a reminder of a routine moved to the next free moment is listed at that moment', () => {
    const daily = routine('r', ['2026-11-26'], [{ before: null, at: '18:00' }]);
    const later = new Date('2026-11-26T19:30:00Z');
    expect(
      shown(
        upcomingReminders(
          {
            occurrences: [],
            tasks: [],
            routines: [daily],
            deferRoutine: () => later,
          },
          NOW,
        ),
      ),
    ).toEqual([['routine:r|2026-11-26:at:18:00', later.toISOString()]]);
  });

  it('sorted by ring time across events, tasks and routines, then by title', () => {
    const list = upcomingReminders(
      {
        occurrences: [occurrence('e', '2026-11-27', '10:00', [{ before: 0, at: null }])],
        tasks: [
          task('t', {
            deadline: '2026-11-27',
            reminders: [{ before: null, at: '10:00' }],
            label: 'A',
          }),
          task('u', {
            deadline: '2026-11-26',
            reminders: [{ before: null, at: '20:00' }],
          }),
        ],
        routines: [routine('r', ['2026-11-26'], [{ before: null, at: '12:00' }])],
      },
      NOW,
    );
    expect(list.map((ring) => [ring.kind, ring.title])).toEqual([
      ['routine', 'Routine r'],
      ['task', 'Tâche u'],
      ['task', 'A'],
      ['event', 'Évènement e'],
    ]);
    expect(list.map((ring) => ring.due)).toEqual([
      { day: '2026-11-26', time: null },
      { day: '2026-11-26', time: null },
      { day: '2026-11-27', time: null },
      { day: '2026-11-27', time: '10:00' },
    ]);
  });
});

describe('reminders of a routine opened before the first day it shows on', () => {
  // Due on Saturday 28, opened on Friday 27 whose condition allows no moment: it shows from Saturday only, its moment 0
  // there from 10:00 to 12:00 (08:30–20:30 on its due day), its moment 1 not allowed on Saturday.
  const reminders: ReminderValue[] = [
    { before: null, at: '08:00' },
    { before: 15, at: null },
    { before: 10, at: null, anchor: 'openEnd' },
    { before: null, at: '09:00', days: 1 },
    { before: 10, at: null, anchor: 'end' },
  ];
  const slots = [
    { slot: 0, fromTime: '08:30', dueTime: '20:30' },
    { slot: 1, fromTime: '18:00', dueTime: '19:00' },
  ];
  /**
   * Rings of the routine, as [key, ISO instant], by instant.
   * @param {object} fields First day it shows on and its times of the day that day.
   * @returns {[string, string][]} Rings.
   */
  const rings = (fields: { firstDay?: string | null; openingSlots?: typeof slots }) =>
    routineRings([
      {
        ...routine('r', [], reminders),
        currentDate: '2026-11-28',
        reminderOccurrences: [{ date: '2026-11-28', dueDate: '2026-11-28', day: '2026-11-27', slots, ...fields }],
      },
    ])
      .map((ring): [string, string] => [ring.key.replace('routine:r|2026-11-28:', ''), ring.at.toISOString()])
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));

  it('from the opening: the first day it shows on, for the moments allowed that day, at their hours that day', () => {
    expect(rings({ firstDay: '2026-11-28', openingSlots: [{ slot: 0, fromTime: '10:00', dueTime: '12:00' }] })).toEqual([
      // 1 day before the first day it shows on, at 09:00.
      ['days:1:09:00', '2026-11-27T08:00:00.000Z'],
      ['at:08:00', '2026-11-28T07:00:00.000Z'],
      // 15 min before 10:00, 10 min before 12:00: moment 0 that day only.
      ['0:before:15', '2026-11-28T08:45:00.000Z'],
      ['0:openEnd:before:10', '2026-11-28T10:50:00.000Z'],
      // 10 min before the end of each moment on its due day.
      ['1:end:before:10', '2026-11-28T17:50:00.000Z'],
      ['0:end:before:10', '2026-11-28T19:20:00.000Z'],
    ]);
  });

  it('without a first day given: its opening day and its times of the day, as before', () => {
    expect(rings({}).map(([key]) => key)).toEqual(['days:1:09:00', 'at:08:00', '0:before:15', '1:before:15', '1:openEnd:before:10', '0:openEnd:before:10', '1:end:before:10', '0:end:before:10']);
  });

  it('no day it shows on: nothing from the opening, « N jours avant » included', () => {
    expect(rings({ firstDay: null, openingSlots: [] }).map(([key]) => key)).toEqual(['1:end:before:10', '0:end:before:10']);
  });
});

describe('reminders of a task with « Horaires »', () => {
  // Open from Thursday 26 to Monday 30 November, doable Monday to Friday.
  const weekdays = [scheduleCase({ weekdays: [1, 2, 3, 4, 5] })];
  const reminders: ReminderValue[] = [
    { before: null, at: '08:00' },
    { before: null, at: '09:00', days: 1 },
  ];
  /**
   * Keys of the rings of the task over the next days.
   * @param {unknown} hours Its « Horaires ».
   * @returns {string[]} Keys.
   */
  const keys = (hours: unknown) =>
    taskRings([{ id: 't', label: 'Tâche', closed: false, archived: false, effectiveMinDate: '2026-11-26', effectiveDeadline: '2026-11-30', hours, reminders }], NOW, 4)
      .map((ring) => ring.key)
      .sort();

  it('« À HH:MM » only on the days its hours allow; « N jours avant » still from its « Échéance »', () => {
    expect(keys(weekdays)).toEqual(['task:t:2026-11-26:at:08:00', 'task:t:2026-11-27:at:08:00', 'task:t:2026-11-30:at:08:00', 'task:t:2026-11-30:days:1:09:00']);
  });

  it('without hours: every day of its opening', () => {
    expect(keys([])).toHaveLength(6);
    expect(keys(undefined)).toHaveLength(6);
  });
});
