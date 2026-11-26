import type { MyDaySettings } from '@ordo/shared';
import * as myDay from '../../services/calendar/my-day-settings';
import { builder } from '../builder';
import { signedInSession } from '../context';

/** Settings of « Ma journée » of the user in the current workspace. */
const MyDaySettingsRef = builder.objectRef<MyDaySettings>('MyDaySettings').implement({
  description: 'Settings of the page « Ma journée » of the user in the current workspace (one set, saved on the server): those of a view of the agenda a list of the day uses.',
  fields: (t) => ({
    tasks: t.exposeBoolean('tasks', { description: 'Tasks shown.' }),
    routines: t.exposeBoolean('routines', { description: 'Routines shown.' }),
    schedules: t.exposeBoolean('schedules', { description: 'Créneaux, éphémérides and birthdays shown.' }),
    hiddenCalendarIds: t.exposeStringList('hiddenCalendarIds', { description: 'Calendars left out (a calendar created later is shown). A calendar deleted since may stay listed.' }),
    hiddenScheduleIds: t.exposeStringList('hiddenScheduleIds', {
      description: 'Créneaux and éphémérides left out, of this workspace or of a kind of another one it subscribes to (one created later is shown). One deleted since may stay listed.',
    }),
    filters: t.field({ type: 'JSON', description: 'Filter of each kind of items of the workspace ({ events, tasks, routines, timers, slots, ephemerides }), as those of a view of the agenda.', resolve: (settings) => settings.filters }),
  }),
});

const MyDaySettingsInput = builder.inputType('MyDaySettingsInput', {
  description: 'Settings of « Ma journée », saved as a whole, read as a view of the agenda (a field invalid takes its default).',
  fields: (t) => ({
    tasks: t.boolean({ required: true }),
    routines: t.boolean({ required: true }),
    schedules: t.boolean({ required: true }),
    hiddenCalendarIds: t.stringList({ required: true }),
    hiddenScheduleIds: t.stringList({ required: true }),
    filters: t.field({ type: 'JSON', required: true }),
  }),
});

builder.queryFields((t) => ({
  myDaySettings: t.field({
    type: MyDaySettingsRef,
    description: 'Settings of « Ma journée » of the user in the current workspace (the defaults when none were saved).',
    resolve: (_root, _args, ctx) => myDay.myDaySettingsOf(signedInSession(ctx).userId),
  }),
}));

builder.mutationFields((t) => ({
  updateMyDaySettings: t.field({
    type: MyDaySettingsRef,
    description: 'Saves the settings of « Ma journée » of the user in the current workspace.',
    args: { input: t.arg({ type: MyDaySettingsInput, required: true }) },
    resolve: (_root, { input }, ctx) => myDay.updateMyDaySettings(signedInSession(ctx).userId, input as MyDaySettings),
  }),
}));
