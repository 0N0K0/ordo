/**
 * Work schedules as a select offers them, and their names by id.
 * @param {readonly { id: string, name: string }[] | undefined} schedules Schedules (none while loading).
 * @returns {{ options: { value: string, label: string }[], names: Map<string, string> }} Options and names.
 */
export function scheduleChoices(schedules: readonly { id: string; name: string }[] | undefined) {
  const list = schedules ?? [];
  return { options: list.map((schedule) => ({ value: schedule.id, label: schedule.name })), names: new Map(list.map((schedule) => [schedule.id, schedule.name])) };
}
