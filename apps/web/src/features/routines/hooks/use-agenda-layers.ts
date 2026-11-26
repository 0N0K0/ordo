import { countedSchedules } from '@ordo/shared';
import { itemOptions } from '../../../components/items/item-look';
import { unarchived } from '../../../lib/archive';
import { useCalendars, useScheduleTypes, useSubscribedSchedules, useWorkSchedules } from '../../calendar/api';
import { scheduleLayerLabel } from '../../calendar/lib/calendar-events';
import { inWorkspace } from '../../calendar/lib/layer-label';

/**
 * Options of the layers: the schedules (of this workspace, and of others subscribed to) and the calendars, the archived
 * ones left out (of another workspace: archived there, or of a kind archived there).
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
        label: scheduleLayerLabel(schedule.label, schedule.typeId ? typeName.get(schedule.typeId) : null),
      })),
      ...countedSchedules(foreign ?? []).map((schedule) => ({ value: schedule.id, label: scheduleLayerLabel(schedule.label, schedule.typeLabel, schedule.workspaceLabel) })),
    ],
    calendars: [
      ...itemOptions(calendars?.calendars ?? []),
      ...(calendars?.calendarSubscriptions ?? []).map((subscription) => ({ value: subscription.calendarId, label: inWorkspace(subscription.label, subscription.workspace.label) })),
    ],
  };
}
