import { describe, expect, it } from 'vitest';
import { calendarViewConfig } from '../../src/calendar/calendar-views';
import { myDaySettingsSchema, readMyDaySettings, type MyDaySettings } from '../../src/calendar/my-day-settings';
import { emptyTableFilter } from '../../src/tables/table-views';

/** A filter of a kind with one condition. */
const ONE_CONDITION = {
  type: 'group' as const,
  id: 'root',
  combinator: 'and' as const,
  children: [{ type: 'condition' as const, id: 'c1', field: 'label', operator: 'contains', value: 'Réunion' }],
};

/** Settings with every field changed from the defaults. */
const CHANGED: MyDaySettings = {
  tasks: false,
  routines: false,
  schedules: false,
  hiddenCalendarIds: ['c1'],
  hiddenScheduleIds: ['s1', 's2'],
  filters: { ...calendarViewConfig().filters, events: ONE_CONDITION, tasks: ONE_CONDITION },
};

describe('readMyDaySettings: defaults', () => {
  it('none chosen (null, not an object, a list): tasks, routines, créneaux and éphémérides shown, nothing left out, no filter', () => {
    for (const value of [null, undefined, 'x', 3, [], [true]]) {
      expect(readMyDaySettings(value)).toEqual({
        tasks: true,
        routines: true,
        schedules: true,
        hiddenCalendarIds: [],
        hiddenScheduleIds: [],
        filters: { events: emptyTableFilter(), tasks: emptyTableFilter(), routines: emptyTableFilter(), timers: emptyTableFilter(), slots: emptyTableFilter(), ephemerides: emptyTableFilter() },
      });
    }
  });

  it('the defaults are those of a view of the agenda, for the fields a list of the day uses', () => {
    const view = calendarViewConfig();
    expect(readMyDaySettings(null)).toEqual({
      tasks: view.tasks,
      routines: view.routines,
      schedules: view.schedules,
      hiddenCalendarIds: view.hiddenCalendarIds,
      hiddenScheduleIds: view.hiddenScheduleIds,
      filters: view.filters,
    });
  });

  it('every field stored is read as it is', () => {
    expect(readMyDaySettings(CHANGED)).toEqual(CHANGED);
  });

  it('a field missing or of the wrong type takes its default, the others are kept', () => {
    expect(readMyDaySettings({ tasks: false, routines: 'no', hiddenCalendarIds: 'c1', hiddenScheduleIds: null })).toEqual({ ...readMyDaySettings(null), tasks: false });
  });

  it('an invalid filter of a kind is read as no filter, the others are kept', () => {
    const read = readMyDaySettings({ filters: { events: { type: 'nope' }, tasks: ONE_CONDITION } });
    expect(read.filters.events).toEqual(emptyTableFilter());
    expect(read.filters.tasks).toEqual(ONE_CONDITION);
  });
});

describe('readMyDaySettings: settings of the older page', () => {
  it('the old keys are dropped, and the fields they named take their defaults', () => {
    const old = {
      showRoutines: false,
      showTasks: false,
      showEvents: false,
      showEphemerides: false,
      showBirthdays: false,
      projectIds: ['p1'],
      withoutProject: true,
      mineOrUnassigned: true,
      showDone: false,
      showCancelled: false,
      hiddenSlotIds: ['s1'],
      hiddenSlotKinds: ['ws:w2:default'],
    };
    expect(readMyDaySettings(old)).toEqual(readMyDaySettings(null));
  });

  it('old keys mixed with new ones: only the new ones are kept', () => {
    const read = readMyDaySettings({ ...CHANGED, showTasks: true, hiddenSlotIds: ['s9'], fineSlots: true, display: 'DAY' });
    expect(read).toEqual(CHANGED);
    expect(Object.keys(read).sort()).toEqual(['filters', 'hiddenCalendarIds', 'hiddenScheduleIds', 'routines', 'schedules', 'tasks']);
  });
});

describe('readMyDaySettings: ids left out', () => {
  it('a calendar or a schedule deleted since is not an error: its id stays', () => {
    expect(readMyDaySettings({ hiddenCalendarIds: ['gone'], hiddenScheduleIds: ['gone'] })).toMatchObject({ hiddenCalendarIds: ['gone'], hiddenScheduleIds: ['gone'] });
  });

  it('a list that is not one of ids, or too long, is read as nothing left out (as a view of the agenda)', () => {
    expect(readMyDaySettings({ hiddenCalendarIds: ['c1', 2] }).hiddenCalendarIds).toEqual([]);
    expect(readMyDaySettings({ hiddenScheduleIds: Array.from({ length: 501 }, (_, index) => `s${index}`) }).hiddenScheduleIds).toEqual([]);
  });
});

describe('myDaySettingsSchema: the settings sent', () => {
  it('reads the settings sent as they are', () => {
    expect(myDaySettingsSchema.parse(CHANGED)).toEqual(CHANGED);
  });

  it('a field sent invalid takes its default, as a view of the agenda saved', () => {
    expect(myDaySettingsSchema.parse({ ...CHANGED, tasks: 'yes' }).tasks).toBe(true);
  });
});
