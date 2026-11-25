import { z } from 'zod';
import type { MyDayKind } from './my-day';

/** Most ids in a list of the settings of « Ma journée » (projects chosen, slots and kinds of slots hidden). */
export const MY_DAY_IDS_MAX = 500;

/** Most characters of an id kept in the settings of « Ma journée »: an id, not a free text. */
const MY_DAY_ID_MAX = 64;

/**
 * Settings of the page « Ma journée » of a user in a workspace: one set, saved on the server, the same in every tab and
 * device. Filters of the page, not rules: what the day holds is told by `taskDayReasons` and `myDayRows`.
 */
export interface MyDaySettings {
  /** Kinds of items shown: routines, tasks, events, éphémérides, birthdays. */
  showRoutines: boolean;
  showTasks: boolean;
  showEvents: boolean;
  showEphemerides: boolean;
  showBirthdays: boolean;
  /** Projects whose items are shown; empty (and « Sans projet » not chosen): every item, with a project or not. */
  projectIds: string[];
  /** « Sans projet » chosen in the projects filter: the items of no project are shown too (alone when no project is chosen). */
  withoutProject: boolean;
  /** Only the items assigned to « Moi » or to nobody (« à moi / sans assigné »); off: everyone's. */
  mineOrUnassigned: boolean;
  /** Items done (tasks, moments of routines) shown. */
  showDone: boolean;
  /** Items cancelled shown. */
  showCancelled: boolean;
  /**
   * Slots (« créneaux ») hidden, one by one: those of the workspace and those of other workspaces it subscribes to; the
   * hidden ones, so that a slot created later is shown.
   */
  hiddenSlotIds: string[];
  /**
   * Kinds of slots of other workspaces subscribed to (`foreignSlotKind`) hidden as a whole: their slots added later
   * too.
   */
  hiddenSlotKinds: string[];
}

/** Settings of a user who chose none: everything shown, everyone's. */
export const DEFAULT_MY_DAY_SETTINGS: Readonly<MyDaySettings> = Object.freeze({
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

/** Yes / no settings of « Ma journée ». */
const MY_DAY_FLAGS = ['showRoutines', 'showTasks', 'showEvents', 'showEphemerides', 'showBirthdays', 'withoutProject', 'mineOrUnassigned', 'showDone', 'showCancelled'] as const;

/**
 * List of ids of the settings, as sent.
 * @param {string} what What is listed, plural (« projets »), for the message of a list too long.
 * @returns {z.ZodArray<z.ZodString>} Schema.
 */
const idList = (what: string) => z.array(z.string().min(1, 'Id invalide.').max(MY_DAY_ID_MAX, 'Id invalide.')).max(MY_DAY_IDS_MAX, `${MY_DAY_IDS_MAX} ${what} maximum.`);

/** Settings of « Ma journée », as sent: every field required, unknown keys dropped. */
export const myDaySettingsSchema = z.object({
  showRoutines: z.boolean(),
  showTasks: z.boolean(),
  showEvents: z.boolean(),
  showEphemerides: z.boolean(),
  showBirthdays: z.boolean(),
  projectIds: idList('projets'),
  withoutProject: z.boolean(),
  mineOrUnassigned: z.boolean(),
  showDone: z.boolean(),
  showCancelled: z.boolean(),
  hiddenSlotIds: idList('créneaux'),
  hiddenSlotKinds: idList('types de créneaux'),
});

/** Ids still known, to drop from the settings those of projects, slots or subscriptions deleted since. */
export interface MyDayKnownIds {
  /** Projects of the workspace. Optional. Default = every id kept. */
  projectIds?: Iterable<string>;
  /** Slots of the workspace and of the kinds of other workspaces it subscribes to. Optional. Default = every id kept. */
  slotIds?: Iterable<string>;
  /** Kinds of other workspaces it subscribes to (`foreignSlotKind`). Optional. Default = every kind kept. */
  slotKinds?: Iterable<string>;
}

/**
 * Ids of a stored list: the strings of an id's shape, each once, in their order, at most `MY_DAY_IDS_MAX`; those not
 * known left out when known ones are given.
 * @param {unknown} value Stored list.
 * @param {Iterable<string> | undefined} known Ids still known; none: every id kept.
 * @returns {string[]} Ids.
 */
function readIds(value: unknown, known: Iterable<string> | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const kept = known ? new Set(known) : null;
  const ids = new Set<string>();
  for (const id of value) {
    if (typeof id === 'string' && id.length > 0 && id.length <= MY_DAY_ID_MAX && (!kept || kept.has(id))) ids.add(id);
  }
  return [...ids].slice(0, MY_DAY_IDS_MAX);
}

/**
 * Settings of « Ma journée » read from a stored value: the defaults for what is missing or invalid, unknown keys
 * dropped. A project, a slot or a subscription deleted since is not an error: its id stays stored (the API keeps the ids
 * it is sent), and is left out when the ids still known are given (a projects filter whose projects are all deleted then
 * shows every item, or only those of no project with « Sans projet »).
 * @param {unknown} value Stored JSON (null: none chosen).
 * @param {MyDayKnownIds} [known] Ids of the projects, slots and kinds subscribed to still known. Optional. Default = every id kept.
 * @returns {MyDaySettings} Settings.
 */
export function readMyDaySettings(value: unknown, known: MyDayKnownIds = {}): MyDaySettings {
  const stored = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const settings: MyDaySettings = {
    ...DEFAULT_MY_DAY_SETTINGS,
    projectIds: readIds(stored.projectIds, known.projectIds),
    hiddenSlotIds: readIds(stored.hiddenSlotIds, known.slotIds),
    hiddenSlotKinds: readIds(stored.hiddenSlotKinds, known.slotKinds),
  };
  for (const flag of MY_DAY_FLAGS) {
    if (typeof stored[flag] === 'boolean') settings[flag] = stored[flag];
  }
  return settings;
}

/** An item of « Ma journée » as its settings filter it: its kind, its project, done or cancelled. */
export interface MyDayFilterItem {
  kind: MyDayKind;
  /** Its project (null: none). Optional. Default = not filtered by project (an éphéméride, a birthday). */
  projectId?: string | null;
  /** Done (a task, a moment of a routine). Optional. Default = false. */
  done?: boolean;
  /** Cancelled (a task, an occurrence of a routine or of an event). Optional. Default = false. */
  cancelled?: boolean;
}

/** Setting showing each kind of items. */
const KIND_SETTINGS: Record<MyDayKind, 'showEphemerides' | 'showEvents' | 'showBirthdays' | 'showRoutines' | 'showTasks'> = {
  ephemeris: 'showEphemerides',
  event: 'showEvents',
  birthday: 'showBirthdays',
  routine: 'showRoutines',
  task: 'showTasks',
};

/**
 * Whether the settings of « Ma journée » show an item: its kind shown, done ones and cancelled ones shown or not, and
 * the projects filter (none chosen and not « Sans projet »: every item; else the items of the projects chosen, and
 * those of no project with « Sans projet »). Éphémérides and birthdays have no project: the projects filter leaves
 * them. « À moi / sans assigné » is not applied here.
 * @param {MyDaySettings} settings Settings.
 * @param {MyDayFilterItem} item Item.
 * @returns {boolean} Shown.
 */
export function myDayShows(settings: MyDaySettings, item: MyDayFilterItem): boolean {
  if (!settings[KIND_SETTINGS[item.kind]]) return false;
  if ((item.done && !settings.showDone) || (item.cancelled && !settings.showCancelled)) return false;
  if (item.projectId === undefined || (!settings.projectIds.length && !settings.withoutProject)) return true;
  return item.projectId === null ? settings.withoutProject : settings.projectIds.includes(item.projectId);
}

/**
 * Whether the settings of « Ma journée » show the slots of a schedule on its hours: neither hidden one by one, nor of
 * a kind of another workspace hidden as a whole.
 * @param {MyDaySettings} settings Settings.
 * @param {{ scheduleId: string, kind?: string | null }} slot Schedule of the slot, and its kind (`foreignSlotKind` for one of another workspace). Kind optional.
 * @returns {boolean} Shown.
 */
export function myDayShowsSlot(settings: MyDaySettings, slot: { scheduleId: string; kind?: string | null }): boolean {
  return !settings.hiddenSlotIds.includes(slot.scheduleId) && !(slot.kind && settings.hiddenSlotKinds.includes(slot.kind));
}
