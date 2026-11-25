import { describe, expect, it } from 'vitest';
import { DEFAULT_MY_DAY_SETTINGS, MY_DAY_IDS_MAX, myDaySettingsSchema, readMyDaySettings, type MyDaySettings } from '../../src/calendar/my-day-settings';

/** Settings with every field changed from the defaults. */
const CHANGED: MyDaySettings = {
  showRoutines: false,
  showTasks: false,
  showEvents: false,
  showEphemerides: false,
  projectIds: ['p1', 'p2'],
  mineOrUnassigned: true,
  showDone: false,
  showCancelled: false,
  hiddenSlotIds: ['s1'],
};

describe('readMyDaySettings: defaults', () => {
  it('none chosen (null, not an object, a list): everything shown, every project, everyone, done and cancelled, every slot', () => {
    for (const value of [null, undefined, 'x', 3, [], [true]]) {
      expect(readMyDaySettings(value)).toEqual({
        showRoutines: true,
        showTasks: true,
        showEvents: true,
        showEphemerides: true,
        projectIds: [],
        mineOrUnassigned: false,
        showDone: true,
        showCancelled: true,
        hiddenSlotIds: [],
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
    expect(readMyDaySettings({ ...CHANGED, view: 'x', showBirthdays: false })).toEqual(CHANGED);
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
  });

  it('ids of projects or slots deleted since are accepted (not checked against the workspace)', () => {
    expect(myDaySettingsSchema.safeParse({ ...CHANGED, projectIds: ['gone'], hiddenSlotIds: ['gone'] }).success).toBe(true);
  });
});
