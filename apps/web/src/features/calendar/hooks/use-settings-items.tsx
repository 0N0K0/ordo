import { calendarCategoryFormSchema, DEFAULT_SCHEDULE_DISPLAY, labelFormSchema, readScheduleDisplay, type ScheduleDisplay } from '@ordo/shared';
import { itemMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { useCalendarCategoryMutations, useWorkScheduleMutations, type CalendarCategory, type ScheduleType } from '../api';
import { ScheduleLookEditor } from '../components/ScheduleLookEditor';

/**
 * Categories of the calendar, for their settings list and their form (a creation from a select too): name, color
 * (required), image and parent.
 * @returns {SettingsItemKind<CalendarCategory>} List and form.
 */
export function useCalendarCategoryItems(): SettingsItemKind<CalendarCategory> {
  const { create, update } = useCalendarCategoryMutations();
  /**
   * Input of a category from the form values.
   * @param {{ name: string, color: string, parentId: string | null }} values Values.
   * @returns {{ name: string, color: string, parentId: string | null }} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null }) => ({ name: values.name, color: values.color, parentId: values.parentId });
  return { kind: 'CALENDAR_CATEGORY', colorRequired: true, schema: calendarCategoryFormSchema, ...itemMutations({ create, update }, input) };
}

/**
 * Kinds of time slots, for their settings list and their form (a creation from a select too): name, color, image and
 * display in the calendar.
 * @returns {SettingsItemKind<ScheduleType, ScheduleDisplay>} List and form.
 */
export function useScheduleTypeItems(): SettingsItemKind<ScheduleType, ScheduleDisplay> {
  const { createType, updateType } = useWorkScheduleMutations();
  /**
   * Input of a kind from the form values.
   * @param {{ name: string, color: string } & ScheduleDisplay} values Values.
   * @returns {{ name: string, color: string } & ScheduleDisplay} Input.
   */
  const input = (values: { name: string; color: string } & ScheduleDisplay) => ({ name: values.name, color: values.color, ...readScheduleDisplay(values) });
  return {
    kind: 'SCHEDULE_TYPE',
    schema: labelFormSchema,
    extra: {
      initial: (type) => (type ? readScheduleDisplay(type) : DEFAULT_SCHEDULE_DISPLAY),
      render: (form) => <ScheduleLookEditor name={form.getValues().name} value={form.getValues()} onChange={(display) => form.setValues(display)} />,
    },
    ...itemMutations({ create: createType, update: updateType }, input),
  };
}
