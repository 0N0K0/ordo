import { calendarCategoryFormSchema, DEFAULT_SCHEDULE_DISPLAY, labelFormSchema, readScheduleDisplay, type ScheduleDisplay } from '@ordo/shared';
import { itemMutations, treeItemInput, type TreeItemValues } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { Checkbox, Stack, Switch } from '@mantine/core';
import { useCalendarCategoryMutations, useWorkScheduleMutations, type CalendarCategory, type ScheduleType, type ScheduleTypeFields } from '../api';
import { ScheduleLookEditor } from '../components/ScheduleLookEditor';
import { UnavailableSwitch } from '../components/UnavailableSwitch';
import { withLossConfirmation } from '../../time/lib/confirm-loss';

/**
 * Categories of the calendar, for their settings list and their form (a creation from a select too): label, color
 * (required), image and parent.
 * @returns {SettingsItemKind<CalendarCategory>} List and form.
 */
export function useCalendarCategoryItems(): SettingsItemKind<CalendarCategory> {
  const { create, update } = useCalendarCategoryMutations();
  return {
    kind: 'CALENDAR_CATEGORY',
    colorRequired: true,
    schema: calendarCategoryFormSchema,
    ...itemMutations({ create, update }, (values: TreeItemValues) => ({ ...treeItemInput(values), color: values.color })),
  };
}

/**
 * Fields of the form of a kind beyond its label and color: its display, « Indisponible », and the budget fields of a
 * kind of éphémérides.
 */
export type ScheduleTypeExtra = ScheduleDisplay & { ephemeris: boolean; unavailable: boolean; budgetContext: boolean; sharedContext: boolean };

/**
 * Kinds of time slots, for their settings list and their form (a creation from a select too): label, color, image and
 * display in the calendar, « Indisponible » (in this workspace; the occurrences of routines it makes disappear
 * confirmed first); a kind of éphémérides also « Sert de contexte au budget » and, then, « Partagé entre espaces ».
 * The nature of a new kind is the one asked (a conversion changes it afterwards).
 * @param {{ ephemeris?: boolean, budgetContext?: boolean }} [options] Nature of a new kind, and a new kind of éphémérides as a context. Optional. Default = créneaux.
 * @returns {SettingsItemKind<ScheduleType, ScheduleTypeExtra>} List and form.
 */
export function useScheduleTypeItems({ ephemeris = false, budgetContext = false }: { ephemeris?: boolean; budgetContext?: boolean } = {}): SettingsItemKind<ScheduleType, ScheduleTypeExtra> {
  const { createType, updateType } = useWorkScheduleMutations();
  /**
   * Input of a kind from the form values (a kind of créneaux is no context).
   * @param {{ label: string, color: string } & ScheduleTypeExtra} values Values.
   * @returns {ScheduleTypeFields} Input.
   */
  const input = (values: { label: string; color: string } & ScheduleTypeExtra): ScheduleTypeFields => ({
    label: values.label,
    color: values.color,
    ...readScheduleDisplay(values),
    ephemeris: values.ephemeris,
    unavailable: values.unavailable,
    budgetContext: values.ephemeris && values.budgetContext,
    sharedContext: values.ephemeris && values.budgetContext && values.sharedContext,
  });
  return {
    kind: 'SCHEDULE_TYPE',
    // Archiving or restoring a kind changes what its schedules give the slot conditions.
    confirmLoss: withLossConfirmation,
    schema: labelFormSchema,
    extra: {
      initial: (type) => ({
        ...(type ? readScheduleDisplay(type) : DEFAULT_SCHEDULE_DISPLAY),
        ephemeris: type ? type.ephemeris : ephemeris,
        unavailable: type?.unavailable ?? false,
        budgetContext: type ? type.budgetContext : budgetContext,
        sharedContext: type?.sharedContext ?? false,
      }),
      render: (form) => {
        const values = form.getValues();
        return (
          <>
            <ScheduleLookEditor name={values.label} value={values} onChange={(display) => form.setValues(display)} />
            <UnavailableSwitch checked={values.unavailable} onChange={(unavailable) => form.setValues({ unavailable })} />
            {values.ephemeris && (
              <Stack gap={6}>
                <Switch
                  label="Sert de contexte au budget"
                  description="Le type est un contexte de la trésorerie ; ses éphémérides en sont les périodes (les lignes datées ces jours-là le reçoivent)."
                  checked={values.budgetContext}
                  onChange={(event) => form.setValues({ budgetContext: event.currentTarget.checked, ...(!event.currentTarget.checked && { sharedContext: false }) })}
                />
                {values.budgetContext && (
                  <Checkbox
                    label="Partagé entre espaces"
                    description="Contexte dans tous vos espaces, pas seulement dans celui-ci."
                    checked={values.sharedContext}
                    onChange={(event) => form.setValues({ sharedContext: event.currentTarget.checked })}
                  />
                )}
              </Stack>
            )}
          </>
        );
      },
    },
    ...itemMutations({ create: createType, update: updateType }, input),
  };
}
