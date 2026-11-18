import { unarchived } from '../../../lib/archive';

/**
 * Work schedules as a select offers them (the archived ones left out, but those kept), and their names by id (all).
 * @param {readonly { id: string, name: string, archived?: boolean }[] | undefined} schedules Schedules (none while loading).
 * @param {readonly (string | null | undefined)[]} [keep] Schedules chosen already, offered even when archived. Optional.
 * @returns {{ options: { value: string, label: string }[], names: Map<string, string> }} Options and names.
 */
export function scheduleChoices(schedules: readonly { id: string; name: string; archived?: boolean }[] | undefined, keep?: readonly (string | null | undefined)[]) {
  const list = schedules ?? [];
  return { options: unarchived(list, keep).map((schedule) => ({ value: schedule.id, label: schedule.name })), names: new Map(list.map((schedule) => [schedule.id, schedule.name])) };
}
