import { useMemo } from 'react';
import { useBirthdayPersonNames, useSlotBirthdays, useDefaultScheduleKind, useForeignScheduleKinds, useOtherWorkspaceSchedules, useScheduleTypes, useWorkSchedules } from '../api';
import { slotChoices, type SlotChoices, type SlotSources } from '../lib/slot-choices';

/** Nothing kept. */
const NONE: readonly string[] = [];

/**
 * What the slot conditions of tasks and routines name and are evaluated on: the schedules and kinds of the workspace
 * and of the other workspaces of the user (archived ones too), the birthdays of the people of the workspace (those of
 * archived people too; undefined while loading) and the names of all its people (a person cited without a birthday).
 * @returns {SlotSources & { schedules?: object[], foreignSchedules?: object[] }} Sources, with the cases of the schedules.
 */
export function useSlotSources() {
  const { data: schedules } = useWorkSchedules();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const { data: foreignSchedules } = useOtherWorkspaceSchedules();
  const { data: foreignKinds } = useForeignScheduleKinds();
  const { data: birthdays } = useSlotBirthdays();
  const { data: people } = useBirthdayPersonNames();
  return useMemo(
    () => ({ schedules, types, defaultKind, foreignSchedules, foreignKinds, birthdays, people }) satisfies SlotSources,
    [schedules, types, defaultKind, foreignSchedules, foreignKinds, birthdays, people],
  );
}

/**
 * What a slot condition offers and the names of all it can name (`slotChoices` on `useSlotSources`).
 * @param {readonly string[]} [keep] Schedules and kinds chosen already, offered even when archived. Optional. Default = none.
 * @returns {SlotChoices} Choices.
 */
export function useSlotChoices(keep: readonly string[] = NONE): SlotChoices {
  const sources = useSlotSources();
  return useMemo(() => slotChoices(sources, keep), [sources, keep]);
}
