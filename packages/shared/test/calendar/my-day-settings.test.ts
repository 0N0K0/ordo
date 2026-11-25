import { describe, expect, it } from 'vitest';
import { DEFAULT_MY_DAY_SETTINGS, MY_DAY_IDS_MAX, myDaySettingsSchema, myDayShows, myDayShowsSlot, readMyDaySettings, type MyDaySettings } from '../../src/calendar/my-day-settings';
import { foreignSlotKind } from '../../src/calendar/slot-kinds';

/** Settings with every field changed from the defaults. */
const CHANGED: MyDaySettings = {
  showRoutines: false,
  showTasks: false,
  showEvents: false,
  showEphemerides: false,
  showBirthdays: false,
  projectIds: ['p1', 'p2'],
  withoutProject: true,
  mineOrUnassigned: true,
  showDone: false,
  showCancelled: false,
  hiddenSlotIds: ['s1'],
  hiddenSlotKinds: [foreignSlotKind('w2', null)],
};

describe('readMyDaySettings: defaults', () => {
  it('none chosen (null, not an object, a list): everything shown (birthdays too), every project, everyone, done and cancelled, every slot', () => {
    for (const value of [null, undefined, 'x', 3, [], [true]]) {
      expect(readMyDaySettings(value)).toEqual({
        showRoutines: true,
        showTasks: true,
        showEvents: true,
        showEphemerides: true,
        showBirthdays: true,
        projectIds: [],
        withoutProject: false,
        mineOrUnassigned: false,
        showDone: true,
        showCancelled: true,
        hiddenSlotIds: [],
        hiddenSlotKinds: [],
      });
    }
  });

  it('the defaults are not shared: changing a read value leaves them as they are', () => {
    const read = readMyDaySettings(null);
    read.projectIds.push('p1');
    read.hiddenSlotIds.push('s1');
    expect(DEFAULT_MY_DAY_SETTINGS.projectIds).toEqual([]);
    expect(DEFAULT_MY_DAY_SETTINGS.hiddenSlotIds).toEqual([]);
  });

  it('every field stored is read as it is', () => {
    expect(readMyDaySettings(CHANGED)).toEqual(CHANGED);
  });

  it('a field missing or of the wrong type takes its default, the others are kept', () => {
    expect(readMyDaySettings({ showTasks: false, showDone: 'no', projectIds: 'p1', hiddenSlotIds: null })).toEqual({ ...DEFAULT_MY_DAY_SETTINGS, showTasks: false });
  });

  it('unknown keys are dropped', () => {
    expect(readMyDaySettings({ ...CHANGED, view: 'x', hiddenCalendarIds: ['c1'] })).toEqual(CHANGED);
  });
});

describe('readMyDaySettings: ids of projects and slots', () => {
  it('only strings of an id shape, each once, in their order', () => {
    expect(readMyDaySettings({ projectIds: ['p1', 2, '', 'p1', 'p2', 'x'.repeat(65)], hiddenSlotIds: ['s2', 's1', 's2'] })).toMatchObject({
      projectIds: ['p1', 'p2'],
      hiddenSlotIds: ['s2', 's1'],
    });
  });

  it('at most MY_DAY_IDS_MAX ids are kept', () => {
    const ids = Array.from({ length: MY_DAY_IDS_MAX + 5 }, (_, index) => `p${index}`);
    expect(readMyDaySettings({ projectIds: ids }).projectIds).toHaveLength(MY_DAY_IDS_MAX);
  });

  it('a project or a slot deleted since is not an error: its id is kept when the known ids are not given', () => {
    expect(readMyDaySettings({ projectIds: ['gone'], hiddenSlotIds: ['gone'] })).toMatchObject({ projectIds: ['gone'], hiddenSlotIds: ['gone'] });
  });

  it('with the known ids, those deleted since are left out', () => {
    expect(readMyDaySettings({ projectIds: ['p1', 'gone'], hiddenSlotIds: ['gone', 's1'] }, { projectIds: ['p1', 'p2'], slotIds: new Set(['s1']) })).toMatchObject({
      projectIds: ['p1'],
      hiddenSlotIds: ['s1'],
    });
  });

  it('a projects filter whose projects are all deleted shows every project again (empty: all)', () => {
    expect(readMyDaySettings({ projectIds: ['gone'] }, { projectIds: ['p1'] }).projectIds).toEqual([]);
  });

  it('a slot created later is shown: only the hidden slots are stored', () => {
    const settings = readMyDaySettings({ hiddenSlotIds: ['s1'] }, { slotIds: ['s1', 'new'] });
    expect(settings.hiddenSlotIds.includes('new')).toBe(false);
  });

  it('a kind of another workspace no longer subscribed to is left out with the known kinds; a subscribed slot is kept with the known slots', () => {
    const kept = foreignSlotKind('w2', 't1');
    expect(readMyDaySettings({ hiddenSlotIds: ['foreign'], hiddenSlotKinds: [kept, foreignSlotKind('w3', null)] }, { slotIds: ['own', 'foreign'], slotKinds: [kept] })).toMatchObject({
      hiddenSlotIds: ['foreign'],
      hiddenSlotKinds: [kept],
    });
  });

  it('a projects filter whose projects are all deleted, with « Sans projet », keeps « Sans projet » alone', () => {
    expect(readMyDaySettings({ projectIds: ['gone'], withoutProject: true }, { projectIds: ['p1'] })).toMatchObject({ projectIds: [], withoutProject: true });
  });

  it('known ids of one list only: the other list is kept as stored', () => {
    expect(readMyDaySettings({ projectIds: ['gone'], hiddenSlotIds: ['gone'] }, { slotIds: [] })).toMatchObject({ projectIds: ['gone'], hiddenSlotIds: [] });
  });
});

describe('myDaySettingsSchema: settings as sent', () => {
  it('accepts full settings and drops unknown keys', () => {
    expect(myDaySettingsSchema.parse({ ...CHANGED, extra: 1 })).toEqual(CHANGED);
  });

  it('refuses a field missing or of the wrong type', () => {
    const missing: Partial<MyDaySettings> = { ...CHANGED };
    delete missing.showDone;
    expect(myDaySettingsSchema.safeParse(missing).success).toBe(false);
    expect(myDaySettingsSchema.safeParse({ ...CHANGED, showTasks: 'yes' }).success).toBe(false);
    expect(myDaySettingsSchema.safeParse({ ...CHANGED, projectIds: [''] }).success).toBe(false);
  });

  it('refuses a list longer than MY_DAY_IDS_MAX, with its message', () => {
    const ids = Array.from({ length: MY_DAY_IDS_MAX + 1 }, (_, index) => `s${index}`);
    const result = myDaySettingsSchema.safeParse({ ...CHANGED, hiddenSlotIds: ids });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(`${MY_DAY_IDS_MAX} créneaux maximum.`);
    const kinds = myDaySettingsSchema.safeParse({ ...CHANGED, hiddenSlotKinds: ids });
    expect(kinds.error?.issues[0]?.message).toBe(`${MY_DAY_IDS_MAX} types de créneaux maximum.`);
  });

  it('ids of projects or slots deleted since are accepted (not checked against the workspace)', () => {
    expect(myDaySettingsSchema.safeParse({ ...CHANGED, projectIds: ['gone'], hiddenSlotIds: ['gone'] }).success).toBe(true);
  });
});

describe('myDayShows: the settings filter the items', () => {
  const all = DEFAULT_MY_DAY_SETTINGS;

  it('by default every item is shown, with a project or not, done or cancelled', () => {
    for (const kind of ['ephemeris', 'event', 'birthday', 'routine', 'task'] as const) expect(myDayShows(all, { kind, projectId: null, done: true, cancelled: true })).toBe(true);
  });

  it('each kind is shown or hidden by its own setting, birthdays apart from éphémérides and events', () => {
    const settings = { ...all, showBirthdays: false };
    expect(myDayShows(settings, { kind: 'birthday' })).toBe(false);
    expect(myDayShows(settings, { kind: 'ephemeris' })).toBe(true);
    expect(myDayShows(settings, { kind: 'event', projectId: null })).toBe(true);
    expect(myDayShows({ ...all, showEphemerides: false }, { kind: 'birthday' })).toBe(true);
  });

  it('done and cancelled ones are hidden by their settings (a cancelled event too)', () => {
    expect(myDayShows({ ...all, showDone: false }, { kind: 'task', projectId: null, done: true })).toBe(false);
    expect(myDayShows({ ...all, showDone: false }, { kind: 'task', projectId: null })).toBe(true);
    expect(myDayShows({ ...all, showCancelled: false }, { kind: 'event', projectId: null, cancelled: true })).toBe(false);
  });

  it('projects chosen: their items only; « Sans projet » adds the items of no project', () => {
    const settings = { ...all, projectIds: ['p1'] };
    expect(myDayShows(settings, { kind: 'task', projectId: 'p1' })).toBe(true);
    expect(myDayShows(settings, { kind: 'routine', projectId: 'p2' })).toBe(false);
    expect(myDayShows(settings, { kind: 'event', projectId: null })).toBe(false);
    expect(myDayShows({ ...settings, withoutProject: true }, { kind: 'event', projectId: null })).toBe(true);
  });

  it('« Sans projet » alone: only the items of no project', () => {
    const settings = { ...all, withoutProject: true };
    expect(myDayShows(settings, { kind: 'task', projectId: null })).toBe(true);
    expect(myDayShows(settings, { kind: 'task', projectId: 'p1' })).toBe(false);
  });

  it('éphémérides and birthdays have no project: the projects filter leaves them', () => {
    const settings = { ...all, projectIds: ['p1'] };
    expect(myDayShows(settings, { kind: 'ephemeris' })).toBe(true);
    expect(myDayShows(settings, { kind: 'birthday' })).toBe(true);
  });

  it('« à moi / sans assigné » is not applied', () => {
    expect(myDayShows({ ...all, mineOrUnassigned: true }, { kind: 'task', projectId: null })).toBe(true);
  });
});

describe('myDayShowsSlot: slots hidden on the hours', () => {
  it('a slot hidden one by one, of the workspace or subscribed to', () => {
    const settings = { ...DEFAULT_MY_DAY_SETTINGS, hiddenSlotIds: ['own', 'foreign'] };
    expect(myDayShowsSlot(settings, { scheduleId: 'own' })).toBe(false);
    expect(myDayShowsSlot(settings, { scheduleId: 'foreign', kind: foreignSlotKind('w2', null) })).toBe(false);
    expect(myDayShowsSlot(settings, { scheduleId: 'other' })).toBe(true);
  });

  it('a kind of another workspace hidden: all its slots, those added later too', () => {
    const settings = { ...DEFAULT_MY_DAY_SETTINGS, hiddenSlotKinds: [foreignSlotKind('w2', 't1')] };
    expect(myDayShowsSlot(settings, { scheduleId: 'later', kind: foreignSlotKind('w2', 't1') })).toBe(false);
    expect(myDayShowsSlot(settings, { scheduleId: 'x', kind: foreignSlotKind('w2', null) })).toBe(true);
    expect(myDayShowsSlot(settings, { scheduleId: 'own', kind: null })).toBe(true);
  });
});
