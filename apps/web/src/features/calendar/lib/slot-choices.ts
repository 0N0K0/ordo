import { DEFAULT_SCHEDULE_KIND_LABEL, foreignSlotKind, ownSlotKind } from '@ordo/shared';
import { unarchived } from '../../../lib/archive';
import { inWorkspace } from './layer-label';

/** What a slot condition can name: the schedules and kinds of the workspace and of the other workspaces of the user. */
export interface SlotSources {
  /** Schedules of the workspace (none while loading). Optional. */
  schedules?: readonly { id: string; label: string; archived?: boolean }[];
  /** Kinds of schedules of the workspace. Optional. */
  types?: readonly { id: string; label: string; archived?: boolean }[];
  /** Kind of its schedules without kind. Optional. */
  defaultKind?: { label: string } | null;
  /** Schedules of the other workspaces. Optional. */
  foreignSchedules?: readonly { id: string; label: string; archived: boolean; workspaceLabel: string }[];
  /** Kinds of schedules of the other workspaces (their schedules without kind among them). Optional. */
  foreignKinds?: readonly { workspaceId: string; workspaceLabel: string; typeId?: string | null; label: string; archived: boolean }[];
}

/** Option of a select. */
interface Choice {
  value: string;
  label: string;
}

/** What a slot condition offers, by field, and the names of all it can name. */
export interface SlotChoices {
  /** Schedules (« Créneau »): of the workspace, then of the other ones (« Sport · Perso »). */
  schedules: Choice[];
  /** Kinds (« Type de créneau »): of the workspace (its schedules without kind first), then of the other ones. */
  kinds: Choice[];
  /** Schedules kept out of the free time: those of the workspace. */
  freeTime: Choice[];
  /** Schedules and kinds together (the « Plages » column of the tables). */
  all: Choice[];
  /** Name of every schedule and kind, archived ones too, by id or kind reference. */
  names: Map<string, string>;
}

/**
 * What a slot condition offers: the schedules and kinds of the workspace and of the other workspaces of the user (with
 * their workspace), the archived ones left out but those already chosen, and the names of all of them.
 * @param {SlotSources} sources Schedules and kinds.
 * @param {readonly string[]} [keep] Schedules and kinds chosen already, offered even when archived. Optional. Default = none.
 * @returns {SlotChoices} Choices.
 */
export function slotChoices(sources: SlotSources, keep: readonly string[] = []): SlotChoices {
  const ownSchedules = (sources.schedules ?? []).map((schedule) => ({ id: schedule.id, label: schedule.label, archived: schedule.archived }));
  const foreignSchedules = (sources.foreignSchedules ?? []).map((schedule) => ({ id: schedule.id, label: inWorkspace(schedule.label, schedule.workspaceLabel), archived: schedule.archived }));
  const kinds = [
    { id: ownSlotKind(null), label: sources.defaultKind?.label || DEFAULT_SCHEDULE_KIND_LABEL, archived: false },
    ...(sources.types ?? []).map((type) => ({ id: ownSlotKind(type.id), label: type.label, archived: type.archived })),
    ...(sources.foreignKinds ?? []).map((kind) => ({ id: foreignSlotKind(kind.workspaceId, kind.typeId), label: inWorkspace(kind.label, kind.workspaceLabel), archived: kind.archived })),
  ];
  /**
   * Options of some items, the archived ones left out but those kept.
   * @param {readonly { id: string, label: string, archived?: boolean }[]} items Items.
   * @returns {Choice[]} Options.
   */
  const offered = (items: readonly { id: string; label: string; archived?: boolean }[]) => unarchived(items, keep).map((item) => ({ value: item.id, label: item.label }));
  const schedules = offered([...ownSchedules, ...foreignSchedules]);
  const kindChoices = offered(kinds);
  return {
    schedules,
    kinds: kindChoices,
    freeTime: offered(ownSchedules),
    all: [...schedules, ...kindChoices],
    names: new Map([...ownSchedules, ...foreignSchedules, ...kinds].map((item) => [item.id, item.label])),
  };
}
