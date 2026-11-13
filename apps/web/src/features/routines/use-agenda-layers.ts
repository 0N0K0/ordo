import { useCalendars, useScheduleTypes, useSubscribedSchedules, useWorkSchedules } from '../calendar/api';

/**
 * Options of the layers: the schedules (of this workspace, and of others subscribed to) and the calendars.
 * @returns {{ schedules: { value: string, label: string }[], calendars: { value: string, label: string }[] }} Options.
 */
export function useAgendaLayerOptions() {
  const { data: schedules } = useWorkSchedules();
  const { data: foreign } = useSubscribedSchedules();
  const { data: types } = useScheduleTypes();
  const { data: calendars } = useCalendars();
  const typeName = new Map((types ?? []).map((type) => [type.id, type.name]));
  return {
    schedules: [
      ...(schedules ?? []).map((schedule) => ({ value: schedule.id, label: schedule.typeId && typeName.get(schedule.typeId) ? `${schedule.name} (${typeName.get(schedule.typeId)})` : schedule.name })),
      ...(foreign ?? []).map((schedule) => ({ value: schedule.id, label: `${schedule.typeName ?? schedule.name} · ${schedule.workspaceName}` })),
    ],
    calendars: [
      ...(calendars?.calendars ?? []).map((calendar) => ({ value: calendar.id, label: calendar.name })),
      ...(calendars?.calendarSubscriptions ?? []).map((subscription) => ({ value: subscription.calendarId, label: `${subscription.name} · ${subscription.workspace.name}` })),
    ],
  };
}
