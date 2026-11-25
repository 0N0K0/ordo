import { MY_DAY_IDS_MAX, type MyDaySettings } from '@ordo/shared';
import * as myDay from '../../services/calendar/my-day-settings';
import { builder } from '../builder';
import { signedInSession } from '../context';

/** Settings of « Ma journée » of the user in the current workspace. */
const MyDaySettingsRef = builder.objectRef<MyDaySettings>('MyDaySettings').implement({
  description: 'Settings of the page « Ma journée » of the user in the current workspace (one set, saved on the server).',
  fields: (t) => ({
    showRoutines: t.exposeBoolean('showRoutines', { description: 'Routines shown.' }),
    showTasks: t.exposeBoolean('showTasks', { description: 'Tasks shown.' }),
    showEvents: t.exposeBoolean('showEvents', { description: 'Events shown.' }),
    showEphemerides: t.exposeBoolean('showEphemerides', { description: 'Éphémérides shown.' }),
    showBirthdays: t.exposeBoolean('showBirthdays', { description: 'Birthdays shown.' }),
    projectIds: t.exposeStringList('projectIds', { description: 'Projects whose items are shown; empty (and withoutProject false): every item. A project deleted since may stay listed.' }),
    withoutProject: t.exposeBoolean('withoutProject', { description: '« Sans projet » chosen in the projects filter: the items of no project are shown too.' }),
    mineOrUnassigned: t.exposeBoolean('mineOrUnassigned', { description: 'Only the items assigned to « Moi » or to nobody; false: everyone’s.' }),
    showDone: t.exposeBoolean('showDone', { description: 'Items done shown.' }),
    showCancelled: t.exposeBoolean('showCancelled', { description: 'Items cancelled shown.' }),
    hiddenSlotIds: t.exposeStringList('hiddenSlotIds', {
      description: 'Slots hidden one by one, of this workspace or of a kind of another one it subscribes to (a slot created later is shown). A slot deleted since may stay listed.',
    }),
    hiddenSlotKinds: t.exposeStringList('hiddenSlotKinds', {
      description: 'Kinds of slots of other workspaces subscribed to (ws:<workspaceId>:<typeId | default>) hidden as a whole, their slots added later too. One no longer subscribed to may stay listed.',
    }),
  }),
});

const MyDaySettingsInput = builder.inputType('MyDaySettingsInput', {
  description: 'Settings of « Ma journée », saved as a whole.',
  fields: (t) => ({
    showRoutines: t.boolean({ required: true }),
    showTasks: t.boolean({ required: true }),
    showEvents: t.boolean({ required: true }),
    showEphemerides: t.boolean({ required: true }),
    showBirthdays: t.boolean({ required: true }),
    projectIds: t.stringList({ required: true, description: `${MY_DAY_IDS_MAX} at most.` }),
    withoutProject: t.boolean({ required: true }),
    mineOrUnassigned: t.boolean({ required: true }),
    showDone: t.boolean({ required: true }),
    showCancelled: t.boolean({ required: true }),
    hiddenSlotIds: t.stringList({ required: true, description: `${MY_DAY_IDS_MAX} at most.` }),
    hiddenSlotKinds: t.stringList({ required: true, description: `${MY_DAY_IDS_MAX} at most.` }),
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
