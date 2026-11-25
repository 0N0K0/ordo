import { z } from 'zod';

/** Most ids in a list of the settings of « Ma journée » (projects chosen, slots hidden). */
export const MY_DAY_IDS_MAX = 500;

/** Most characters of an id kept in the settings of « Ma journée »: an id, not a free text. */
const MY_DAY_ID_MAX = 64;

/**
 * Settings of the page « Ma journée » of a user in a workspace: one set, saved on the server, the same in every tab and
 * device. Filters of the page, not rules: what the day holds is told by `taskDayReasons` and `myDayRows`.
 */
export interface MyDaySettings {
  /** Kinds of items shown: routines, tasks, events, éphémérides. */
  showRoutines: boolean;
  showTasks: boolean;
  showEvents: boolean;
  showEphemerides: boolean;
  /** Projects whose items are shown; empty: every item, with a project or not. */
  projectIds: string[];
  /** Only the items assigned to « Moi » or to nobody (« à moi / sans assigné »); off: everyone's. */
  mineOrUnassigned: boolean;
  /** Items done (tasks, moments of routines) shown. */
  showDone: boolean;
  /** Items cancelled shown. */
  showCancelled: boolean;
  /** Slots (« créneaux ») of the workspace hidden, one by one: the hidden ones, so that a slot created later is shown. */
  hiddenSlotIds: string[];
}

/** Settings of a user who chose none: everything shown, everyone's. */
export const DEFAULT_MY_DAY_SETTINGS: Readonly<MyDaySettings> = Object.freeze({
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

/** Yes / no settings of « Ma journée ». */
const MY_DAY_FLAGS = ['showRoutines', 'showTasks', 'showEvents', 'showEphemerides', 'mineOrUnassigned', 'showDone', 'showCancelled'] as const;

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
  projectIds: idList('projets'),
  mineOrUnassigned: z.boolean(),
  showDone: z.boolean(),
  showCancelled: z.boolean(),
  hiddenSlotIds: idList('créneaux'),
});

/** Ids still known, to drop from the settings those of projects or slots deleted since. */
export interface MyDayKnownIds {
  /** Projects of the workspace. Optional. Default = every id kept. */
  projectIds?: Iterable<string>;
  /** Slots of the workspace. Optional. Default = every id kept. */
  slotIds?: Iterable<string>;
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
 * dropped. A project or a slot deleted since is not an error: its id stays stored (the API keeps the ids it is sent), and
 * is left out when the ids still known are given (a projects filter whose projects are all deleted then shows every item).
 * @param {unknown} value Stored JSON (null: none chosen).
 * @param {MyDayKnownIds} [known] Ids of the projects and slots still in the workspace. Optional. Default = every id kept.
 * @returns {MyDaySettings} Settings.
 */
export function readMyDaySettings(value: unknown, known: MyDayKnownIds = {}): MyDaySettings {
  const stored = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const settings: MyDaySettings = { ...DEFAULT_MY_DAY_SETTINGS, projectIds: readIds(stored.projectIds, known.projectIds), hiddenSlotIds: readIds(stored.hiddenSlotIds, known.slotIds) };
  for (const flag of MY_DAY_FLAGS) {
    if (typeof stored[flag] === 'boolean') settings[flag] = stored[flag];
  }
  return settings;
}
