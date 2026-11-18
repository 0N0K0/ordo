import { itemOptions } from '../../../components/items/item-look';
import { unarchived } from '../../../lib/archive';
import { useCalendars, useScheduleTypes, useSubscribedSchedules, useWorkSchedules } from '../../calendar/api';

/**
 * Options of the layers: the schedules (of this workspace, and of others subscribed to) and the calendars, the archived
 * ones left out.
 * @returns {{ schedules: { value: string, label: string }[], calendars: { value: string, label: string }[] }} Options.
 */
export function useAgendaLayerOptions() {
  const { data: schedules } = useWorkSchedules();
  const { data: foreign } = useSubscribedSchedules();
  const { data: types } = useScheduleTypes();
  const { data: calendars } = useCalendars();
  const typeName = new Map((types ?? []).map((type) => [type.id, type.label]));
  return {
    schedules: [
      ...unarchived(schedules ?? []).map((schedule) => ({
        value: schedule.id,
        label: schedule.typeId && typeName.get(schedule.typeId) ? `${schedule.label} (${typeName.get(schedule.typeId)})` : schedule.label,
      })),
      ...(foreign ?? []).map((schedule) => ({ value: schedule.id, label: `${schedule.typeLabel ?? schedule.label} · ${schedule.workspaceLabel}` })),
    ],
    calendars: [
      ...itemOptions(calendars?.calendars ?? []),
      ...(calendars?.calendarSubscriptions ?? []).map((subscription) => ({ value: subscription.calendarId, label: `${subscription.label} · ${subscription.workspace.label}` })),
    ],
  };
}
