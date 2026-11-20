import { BIRTHDAY_SLOT_KIND, BIRTHDAY_SLOT_KIND_LABEL, birthdayLabel, birthdaySlotId, DEFAULT_SCHEDULE_KIND_LABEL, foreignSlotKind, ownSlotKind, slotSchedules } from '@ordo/shared';
import { archivedLabel, unarchived } from '../../../lib/archive';
import { inWorkspace } from './layer-label';

/**
 * What a slot condition can name: the schedules and kinds of the workspace and of the other workspaces of the user, and
 * the birthdays of the people of the workspace (lot 16c).
 */
export interface SlotSources {
  /** Schedules of the workspace (none while loading). Optional. */
  schedules?: readonly { id: string; label: string; archived?: boolean; ephemeris?: boolean }[];
  /** Kinds of schedules of the workspace. Optional. */
  types?: readonly { id: string; label: string; archived?: boolean; ephemeris?: boolean }[];
  /** Kind of its schedules without kind. Optional. */
  defaultKind?: { label: string } | null;
  /** Schedules of the other workspaces. Optional. */
  foreignSchedules?: readonly { id: string; label: string; archived: boolean; workspaceLabel: string; ephemeris?: boolean }[];
  /** Kinds of schedules of the other workspaces (their schedules without kind among them). Optional. */
  foreignKinds?: readonly { workspaceId: string; workspaceLabel: string; typeId?: string | null; label: string; archived: boolean; ephemeris?: boolean }[];
  /**
   * Birthdays of the people of the workspace (`useSlotBirthdays`: those of archived people flagged, with the other ids
   * naming each, decision FQ). Optional.
   */
  birthdays?: readonly { id: string; name: string; archived?: boolean; aliases?: readonly string[] }[];
}

/**
 * Name of a schedule or a kind in a slot condition: an éphéméride (or a kind of them, lot 16) told as one.
 * @param {string} label Label.
 * @param {boolean | null | undefined} ephemeris An éphéméride, or a kind of them.
 * @returns {string} « Vacances (éphéméride) », or the label.
 */
const ephemerisLabel = (label: string, ephemeris: boolean | null | undefined) => (ephemeris ? `${label} (éphéméride)` : label);

/**
 * Something a slot condition names: « (archivée) » after an archived éphéméride, « (archivé) » after the others
 * (créneau, type, anniversaire; decision FR).
 */
interface Named {
  id: string;
  label: string;
  archived?: boolean;
  /** Feminine (an éphéméride): « archivée ». Optional. Default = false. */
  feminine?: boolean | null;
}

/**
 * Name of something a slot condition names, marked when archived, agreed with its noun (decision FR).
 * @param {Named} item Item.
 * @returns {string} « Vacances (éphéméride) (archivée) », « Sport (archivé) », or the label.
 */
const namedLabel = (item: Named): string => archivedLabel(item, Boolean(item.feminine));

/** Option of a select. */
interface Choice {
  value: string;
  label: string;
}

/** What a slot condition offers, by field, and the names of all it can name. */
export interface SlotChoices {
  /** Schedules (« Créneau »): of the workspace, then of the other ones (« Sport · Perso »), then the birthdays. */
  schedules: Choice[];
  /** Kinds (« Type de créneau »): of the workspace (its schedules without kind first), then of the other ones, then every birthday. */
  kinds: Choice[];
  /** Schedules kept out of the free time: the créneaux of the workspace (its éphémérides never are in it). */
  freeTime: Choice[];
  /** Schedules and kinds together (the « Créneaux » column of the tables). */
  all: Choice[];
  /** Name of every schedule and kind, archived ones too, by id or kind reference. */
  names: Map<string, string>;
}

/**
 * What a slot condition offers: the schedules and kinds of the workspace and of the other workspaces of the user (with
 * their workspace), the archived ones left out but those already chosen (« (archivé) », « (archivée) » for an éphéméride, decisions FQ, FR), the birthdays of the people of the workspace
 * (« Anniversaire de Paul (éphéméride) ») and all of them (« Anniversaires (éphéméride) », lot 16c), and the names of
 * all of them.
 * @param {SlotSources} sources Schedules and kinds.
 * @param {readonly string[]} [keep] Schedules and kinds chosen already, offered even when archived. Optional. Default = none.
 * @returns {SlotChoices} Choices.
 */
export function slotChoices(sources: SlotSources, keep: readonly string[] = []): SlotChoices {
  const ownSchedules = (sources.schedules ?? []).map((schedule) => ({ id: schedule.id, label: ephemerisLabel(schedule.label, schedule.ephemeris), archived: schedule.archived, ephemeris: schedule.ephemeris, feminine: schedule.ephemeris }));
  const foreignSchedules = (sources.foreignSchedules ?? []).map((schedule) => ({
    id: schedule.id,
    label: inWorkspace(ephemerisLabel(schedule.label, schedule.ephemeris), schedule.workspaceLabel),
    archived: schedule.archived,
    feminine: schedule.ephemeris,
  }));
  const birthdays = (sources.birthdays ?? []).map((birthday) => ({ id: birthdaySlotId(birthday.id), label: ephemerisLabel(birthdayLabel(birthday.name, null), true), archived: birthday.archived ?? false }));
  // A relation linked to a contributor (or the reverse) names the birthday of the person (decision FQ): its name, never offered.
  const aliases = (sources.birthdays ?? []).flatMap((birthday, index) => (birthday.aliases ?? []).map((alias) => ({ ...birthdays[index], id: birthdaySlotId(alias) })));
  const kinds = [
    { id: ownSlotKind(null), label: sources.defaultKind?.label || DEFAULT_SCHEDULE_KIND_LABEL, archived: false },
    ...(sources.types ?? []).map((type) => ({ id: ownSlotKind(type.id), label: ephemerisLabel(type.label, type.ephemeris), archived: type.archived })),
    ...(sources.foreignKinds ?? []).map((kind) => ({
      id: foreignSlotKind(kind.workspaceId, kind.typeId),
      label: inWorkspace(ephemerisLabel(kind.label, kind.ephemeris), kind.workspaceLabel),
      archived: kind.archived,
    })),
    { id: BIRTHDAY_SLOT_KIND, label: ephemerisLabel(BIRTHDAY_SLOT_KIND_LABEL, true), archived: false },
  ];
  /**
   * Options of some items, the archived ones left out but those kept.
   * @param {readonly Named[]} items Items.
   * @returns {Choice[]} Options.
   */
  const offered = (items: readonly Named[]) => unarchived(items, keep).map((item) => ({ value: item.id, label: namedLabel(item) }));
  const schedules = offered([...ownSchedules, ...foreignSchedules, ...birthdays]);
  const kindChoices = offered(kinds);
  return {
    schedules,
    kinds: kindChoices,
    freeTime: offered(slotSchedules(ownSchedules)),
    all: [...schedules, ...kindChoices],
    // Archived ones still named, « (archivé) » or « (archivée) »: they give no moment (decisions FQ, FR).
    names: new Map([...ownSchedules, ...foreignSchedules, ...birthdays, ...aliases, ...kinds].map((item) => [item.id, namedLabel(item)])),
  };
}
