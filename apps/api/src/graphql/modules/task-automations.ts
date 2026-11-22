import { taskAutomationActionsSchema, taskAutomationConditionSchema, taskAutomationTriggerSchema } from '@ordo/shared';
import { prisma } from '../../db';
import { BY_POSITION } from '../../services/core/ordering';
import { taskAutomations } from '../../services/tasks/task-automations';
import { builder } from '../builder';
import { labelMutations, labelObject } from '../label-inputs';

labelObject('TaskAutomation', { description: 'Automation of the tasks (« quand … alors … ») of the workspace, a settings list: applied in their order to every task of every project.' });

builder.prismaObjectFields('TaskAutomation', (t) => ({
  enabled: t.exposeBoolean('enabled', { description: 'On; off: kept, never applied.' }),
  trigger: t.field({
    type: 'JSON',
    nullable: true,
    description: 'What triggers it: { event, field, change, value } (`taskAutomationTriggerSchema`); null when unreadable.',
    resolve: (rule) => taskAutomationTriggerSchema.safeParse(rule.trigger).data ?? null,
  }),
  condition: t.field({
    type: 'JSON',
    nullable: true,
    description: 'Filter of the task table the task must meet (columns of `TASK_AUTOMATION_FILTER_KINDS`); null: every task.',
    resolve: (rule) => taskAutomationConditionSchema.safeParse(rule.condition ?? null).data ?? null,
  }),
  actions: t.field({
    type: 'JSON',
    description: 'What it does, in order: [{ kind, field, value }] (`taskAutomationActionSchema`).',
    resolve: (rule) => taskAutomationActionsSchema.safeParse(rule.actions).data ?? [],
  }),
}));

const TaskAutomationInput = builder.inputType('TaskAutomationInput', {
  fields: (t) => ({
    label: t.string({ required: true, description: 'Its name, unique in the workspace.' }),
    color: t.string({ required: true }),
    enabled: t.boolean({ description: 'On (default) or off.' }),
    trigger: t.field({ type: 'JSON', required: true, description: '{ event, field, change, value }: checked by `taskAutomationTriggerSchema`.' }),
    condition: t.field({ type: 'JSON', description: 'Filter of the task table (checked by `taskAutomationConditionSchema`); null or empty: every task.' }),
    actions: t.field({ type: 'JSON', required: true, description: '[{ kind, field, value }], 1 to 20: checked by `taskAutomationActionSchema`.' }),
  }),
});

const TaskAutomationPatch = builder.inputType('TaskAutomationPatch', {
  description: 'Changes of a rule (omitted fields unchanged; a null condition: every task).',
  fields: (t) => ({
    label: t.string(),
    color: t.string(),
    enabled: t.boolean(),
    trigger: t.field({ type: 'JSON' }),
    condition: t.field({ type: 'JSON' }),
    actions: t.field({ type: 'JSON' }),
  }),
});

builder.queryFields((t) => ({
  taskAutomations: t.prismaField({
    type: ['TaskAutomation'],
    description: 'Automations of the tasks of the workspace, in their order (archived ones included).',
    resolve: (query) => prisma.taskAutomation.findMany({ ...query, orderBy: BY_POSITION }),
  }),
}));

labelMutations('TaskAutomation', taskAutomations, { create: TaskAutomationInput, update: TaskAutomationPatch });
