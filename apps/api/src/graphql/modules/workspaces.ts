import * as workspaces from '../../services/workspaces';
import { currentWorkspace } from '../../workspace-context';
import { builder } from '../builder';
import { requireSession } from '../context';

const WorkspaceKind = builder.enumType('WorkspaceKind', {
  description: 'Professional (invoicing, clients, company) or personal workspace.',
  values: ['PRO', 'PERSO'] as const,
});

const NotificationSource = builder.enumType('NotificationSource', {
  description: 'Kind of notification a workspace can give while another one is open.',
  values: ['ALARMS', 'CALENDAR', 'MAILS'] as const,
});

builder.prismaObject('Workspace', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    kind: t.expose('kind', { type: WorkspaceKind }),
    position: t.exposeInt('position'),
    notifyElsewhere: t.field({
      type: [NotificationSource],
      description: 'Notifications it still gives while another workspace is open.',
      resolve: (workspace) => workspace.notifyElsewhere,
    }),
  }),
});

const WorkspaceInput = builder.inputType('WorkspaceInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    kind: t.field({ type: WorkspaceKind, required: true }),
  }),
});

builder.queryFields((t) => ({
  workspaces: t.prismaField({
    type: ['Workspace'],
    description: 'Workspaces, in the order of the switcher.',
    resolve: (_query, _root, _args, ctx) => workspaces.listWorkspaces(requireSession(ctx).userId),
  }),
  currentWorkspaceId: t.id({
    description: 'Workspace the request works in (the one the app asks for, or the first one).',
    resolve: () => currentWorkspace().id,
  }),
}));

builder.mutationFields((t) => ({
  createWorkspace: t.prismaField({
    type: 'Workspace',
    args: { input: t.arg({ type: WorkspaceInput, required: true }) },
    resolve: (_query, _root, { input }, ctx) => workspaces.createWorkspace(input, requireSession(ctx).userId),
  }),
  updateWorkspace: t.prismaField({
    type: 'Workspace',
    description: 'Renames a workspace or changes its kind (it only becomes personal without clients nor invoicing documents).',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: WorkspaceInput, required: true }) },
    resolve: (_query, _root, { id, input }, ctx) => workspaces.updateWorkspace(id, input, requireSession(ctx).userId),
  }),
  setWorkspaceNotifications: t.prismaField({
    type: 'Workspace',
    description: 'Chooses the notifications a workspace still gives while another one is open.',
    args: { id: t.arg.id({ required: true }), sources: t.arg({ type: [NotificationSource], required: true }) },
    resolve: (_query, _root, { id, sources }, ctx) => workspaces.setWorkspaceNotifications(id, sources, requireSession(ctx).userId),
  }),
  moveWorkspace: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }, ctx) => {
      await workspaces.moveWorkspace(id, index, requireSession(ctx).userId);
      return true;
    },
  }),
  deleteWorkspace: t.boolean({
    description: 'Deletes a workspace and everything in it (not the last one).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      await workspaces.deleteWorkspace(id, requireSession(ctx).userId);
      return true;
    },
  }),
}));
