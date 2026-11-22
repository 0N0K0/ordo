import { z } from 'zod';
import { agreed, countOf } from '../core/text';
import { requiredText } from '../core/rules';
import { colorSchema } from '../core/workspace';
import { filterConditionSchemaFor, filterDaySchema, type FilterConditionOf, type FilterFieldKind, type FilterGroupOf } from '../tables/filters';
import { tableFilterSchema } from '../tables/table-views';
import { TASK_STATUS_CATEGORIES } from './task-columns';
import { effortSchema, type TaskBulkChanges } from './tasks';

/**
 * Automations of the tasks: rules « quand … alors … » of a workspace, for every task of every project. A rule has a
 * trigger (a field changes, the task is created, closed, reopened, archived, all its sub-tasks are closed, a chrono
 * starts on it), an optional condition (a filter of the task table) and actions (a value given, added, removed or
 * emptied; the task closed, reopened or archived).
 */

/** Fields of a task a rule watches or changes. */
export const TASK_AUTOMATION_FIELDS = ['STATUS', 'PRIORITY', 'TYPE', 'TAGS', 'ASSIGNEES', 'MILESTONE', 'SPRINTS', 'PROJECT', 'MIN_DATE', 'DEADLINE', 'START_DATE', 'END_DATE', 'EFFORT'] as const;
export type TaskAutomationField = (typeof TASK_AUTOMATION_FIELDS)[number];

/** Kind of value of a field of a rule: one item of a list, several, a day, a number. */
export type TaskAutomationFieldKind = 'reference' | 'list' | 'day' | 'number';

/** Each field of a rule: its name (lowercase, in the messages), its gender and number (« vidée », « vidés »), its kind. */
export const TASK_AUTOMATION_FIELD_META: Record<TaskAutomationField, { label: string; feminine: boolean; plural: boolean; kind: TaskAutomationFieldKind }> = {
  STATUS: { label: 'statut', feminine: false, plural: false, kind: 'reference' },
  PRIORITY: { label: 'priorité', feminine: true, plural: false, kind: 'reference' },
  TYPE: { label: 'type', feminine: false, plural: false, kind: 'reference' },
  TAGS: { label: 'étiquettes', feminine: true, plural: true, kind: 'list' },
  ASSIGNEES: { label: 'assignés', feminine: false, plural: true, kind: 'list' },
  MILESTONE: { label: 'jalon', feminine: false, plural: false, kind: 'reference' },
  SPRINTS: { label: 'sprints', feminine: false, plural: true, kind: 'list' },
  PROJECT: { label: 'projet', feminine: false, plural: false, kind: 'reference' },
  MIN_DATE: { label: 'ouverture', feminine: true, plural: false, kind: 'day' },
  DEADLINE: { label: 'échéance', feminine: true, plural: false, kind: 'day' },
  START_DATE: { label: 'début', feminine: false, plural: false, kind: 'day' },
  END_DATE: { label: 'fin', feminine: true, plural: false, kind: 'day' },
  EFFORT: { label: 'effort', feminine: false, plural: false, kind: 'number' },
};

/** What triggers a rule on a task. */
export const TASK_AUTOMATION_EVENTS = ['FIELD_CHANGED', 'CREATED', 'CLOSED', 'REOPENED', 'ARCHIVED', 'SUBTASKS_CLOSED', 'TIMER_STARTED'] as const;
export type TaskAutomationEvent = (typeof TASK_AUTOMATION_EVENTS)[number];

/** Names of the triggers, in the form of a rule (« Quand … »). */
export const TASK_AUTOMATION_EVENT_LABELS: Record<TaskAutomationEvent, string> = {
  FIELD_CHANGED: 'Un champ change',
  CREATED: 'La tâche est créée',
  CLOSED: 'La tâche est fermée',
  REOPENED: 'La tâche est rouverte',
  ARCHIVED: 'La tâche est archivée',
  SUBTASKS_CLOSED: 'Toutes ses sous-tâches sont fermées',
  TIMER_STARTED: 'Un chrono démarre sur elle',
};

/**
 * How a watched field changes: any change, renseigné (it had no value, it has one), vidé (it had one, it has none), or
 * given a precise value (a field of a list of items: it takes that item; a list: it receives it).
 */
export const TASK_AUTOMATION_CHANGES = ['CHANGED', 'SET', 'CLEARED', 'IS'] as const;
export type TaskAutomationChange = (typeof TASK_AUTOMATION_CHANGES)[number];

/** Names of the changes of a field, in the form of a rule. */
export const TASK_AUTOMATION_CHANGE_LABELS: Record<TaskAutomationChange, string> = {
  CHANGED: 'change',
  SET: 'est renseigné',
  CLEARED: 'est vidé',
  IS: 'prend la valeur',
};

/** What a rule does to the task. */
export const TASK_AUTOMATION_ACTIONS = ['SET', 'ADD', 'REMOVE', 'CLEAR', 'CLOSE', 'REOPEN', 'ARCHIVE'] as const;
export type TaskAutomationActionKind = (typeof TASK_AUTOMATION_ACTIONS)[number];

/** Names of the actions, in the form of a rule (« Alors … »). */
export const TASK_AUTOMATION_ACTION_LABELS: Record<TaskAutomationActionKind, string> = {
  SET: 'Donner une valeur',
  ADD: 'Ajouter',
  REMOVE: 'Retirer',
  CLEAR: 'Vider',
  CLOSE: 'Fermer la tâche',
  REOPEN: 'Rouvrir la tâche',
  ARCHIVE: 'Archiver la tâche',
};

/** Actions on a field (the others act on the task). */
export const TASK_AUTOMATION_FIELD_ACTIONS: readonly TaskAutomationActionKind[] = ['SET', 'ADD', 'REMOVE', 'CLEAR'];

/** Most actions of a rule. */
export const TASK_AUTOMATION_ACTIONS_MAX = 20;

/** Most rules applied one after the other from one change (a rule triggering another one). */
export const TASK_AUTOMATION_CHAIN_MAX = 5;

/** Most characters of an id given as a value of a rule (internal bound). */
const VALUE_MAX = 200;
/** Most items of a list given as a value of a rule. */
const LIST_MAX = 50;

/**
 * Columns of the task table a condition of a rule may filter on, with the kind of their filter (as the task table
 * gives it): the values the API knows of a task, those it goes by (inherited) included.
 */
export const TASK_AUTOMATION_FILTER_KINDS = {
  label: 'text',
  description: 'text',
  number: 'number',
  project: 'multiReference',
  status: 'category',
  statusCategory: 'category',
  priority: 'category',
  type: 'category',
  assignees: 'multiReference',
  tags: 'multiReference',
  milestone: 'category',
  sprint: 'multiReference',
  parent: 'multiReference',
  effort: 'number',
  startDate: 'date',
  endDate: 'date',
  deadline: 'date',
  minDate: 'date',
  closed: 'boolean',
  archived: 'boolean',
  hasSubtasks: 'boolean',
} as const satisfies Record<string, FilterFieldKind>;
export type TaskAutomationFilterField = keyof typeof TASK_AUTOMATION_FILTER_KINDS;

/** Columns of the filters of the rules. */
export const TASK_AUTOMATION_FILTER_FIELDS = Object.keys(TASK_AUTOMATION_FILTER_KINDS) as TaskAutomationFilterField[];

/** One condition of a rule: a column of the list, its operator and value fitting its kind (the ids of the lists of the workspace: any). */
const automationConditionSchema = filterConditionSchemaFor<TaskAutomationFilterField>(TASK_AUTOMATION_FILTER_KINDS, {
  statusCategory: TASK_STATUS_CATEGORIES,
  status: null,
  priority: null,
  type: null,
  milestone: null,
});

/**
 * Conditions of a filter tree.
 * @param {FilterGroupOf<string>} group Group.
 * @returns {FilterConditionOf<string>[]} Conditions, at every level.
 */
function conditionsOf(group: FilterGroupOf<string>): FilterConditionOf<string>[] {
  return group.children.flatMap((child) => (child.type === 'group' ? conditionsOf(child) : [child]));
}

/** Condition of a rule: a filter of the task table on the columns of `TASK_AUTOMATION_FILTER_KINDS`, each condition complete; none (or empty): every task. */
export const taskAutomationConditionSchema = tableFilterSchema
  .nullable()
  .superRefine((group, ctx) => {
    if (!group) return;
    for (const condition of conditionsOf(group)) {
      if (!(condition.field in TASK_AUTOMATION_FILTER_KINDS)) {
        ctx.addIssue({ code: 'custom', message: 'Une condition porte sur une colonne qu’une règle ne lit pas.' });
        return;
      }
      if (!automationConditionSchema.safeParse(condition).success) {
        ctx.addIssue({ code: 'custom', message: 'Une condition est incomplète.' });
        return;
      }
    }
  })
  .transform((group) => (group && group.children.length ? group : null));
export type TaskAutomationCondition = FilterGroupOf<string> | null;

/** Trigger of a rule: what happens to the task, and for a field, which one and how it changes. */
export const taskAutomationTriggerSchema = z
  .object({
    event: z.enum(TASK_AUTOMATION_EVENTS, { error: 'Choisissez le déclencheur.' }),
    field: z.enum(TASK_AUTOMATION_FIELDS).nullable().optional(),
    change: z.enum(TASK_AUTOMATION_CHANGES).nullable().optional(),
    value: z.string().max(VALUE_MAX).nullable().optional(),
  })
  .superRefine((trigger, ctx) => {
    if (trigger.event !== 'FIELD_CHANGED') return;
    if (!trigger.field) {
      ctx.addIssue({ code: 'custom', path: ['field'], message: 'Choisissez le champ.' });
      return;
    }
    if (!trigger.change) {
      ctx.addIssue({ code: 'custom', path: ['change'], message: 'Choisissez le changement.' });
      return;
    }
    if (trigger.change !== 'IS') return;
    const { kind } = TASK_AUTOMATION_FIELD_META[trigger.field];
    if (kind !== 'reference' && kind !== 'list') ctx.addIssue({ code: 'custom', path: ['change'], message: 'Une valeur précise se choisit pour un champ à liste de choix.' });
    else if (!trigger.value) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Choisissez la valeur.' });
  })
  .transform((trigger) => {
    const onField = trigger.event === 'FIELD_CHANGED';
    return {
      event: trigger.event,
      field: onField ? (trigger.field ?? null) : null,
      change: onField ? (trigger.change ?? null) : null,
      value: onField && trigger.change === 'IS' ? (trigger.value ?? null) : null,
    };
  });
export type TaskAutomationTrigger = z.output<typeof taskAutomationTriggerSchema>;

/** Value of an action: an id, several, a day (`YYYY-MM-DD`, `today`, `today+3`…), a number, or none. */
const actionValueSchema = z.union([z.string().max(VALUE_MAX), z.number(), z.array(z.string().max(VALUE_MAX)).max(LIST_MAX), z.null()]).optional();

/**
 * Message of the value an action on a field needs, when the value given does not fit; none when it fits.
 * @param {TaskAutomationActionKind} kind Action.
 * @param {TaskAutomationFieldKind} fieldKind Kind of the field.
 * @param {unknown} value Value given.
 * @returns {string | null} Message.
 */
function actionValueIssue(kind: TaskAutomationActionKind, fieldKind: TaskAutomationFieldKind, value: unknown): string | null {
  if (kind === 'CLEAR') return null;
  if (kind === 'ADD' || kind === 'REMOVE') {
    if (fieldKind !== 'list') return 'Ajouter ou retirer se fait dans une liste (étiquettes, assignés, sprints).';
    return Array.isArray(value) && value.length ? null : 'Choisissez au moins une valeur.';
  }
  switch (fieldKind) {
    case 'reference':
      return typeof value === 'string' && value ? null : 'Choisissez la valeur.';
    case 'list':
      return Array.isArray(value) && value.length ? null : 'Choisissez au moins une valeur.';
    case 'day':
      return filterDaySchema.safeParse(value).success ? null : 'Date invalide.';
    case 'number':
      return typeof value === 'number' && effortSchema.safeParse(value).success ? null : 'Nombre attendu.';
  }
}

/** Action of a rule: on a field (a value given, added, removed, emptied), or on the task (closed, reopened, archived). */
export const taskAutomationActionSchema = z
  .object({
    kind: z.enum(TASK_AUTOMATION_ACTIONS, { error: 'Choisissez l’action.' }),
    field: z.enum(TASK_AUTOMATION_FIELDS).nullable().optional(),
    value: actionValueSchema,
  })
  .superRefine((action, ctx) => {
    if (!TASK_AUTOMATION_FIELD_ACTIONS.includes(action.kind)) return;
    if (!action.field) {
      ctx.addIssue({ code: 'custom', path: ['field'], message: 'Choisissez le champ.' });
      return;
    }
    const issue = actionValueIssue(action.kind, TASK_AUTOMATION_FIELD_META[action.field].kind, action.value);
    if (issue) ctx.addIssue({ code: 'custom', path: ['value'], message: issue });
  })
  .transform((action) => {
    const onField = TASK_AUTOMATION_FIELD_ACTIONS.includes(action.kind);
    return { kind: action.kind, field: onField ? (action.field ?? null) : null, value: onField && action.kind !== 'CLEAR' ? (action.value ?? null) : null };
  });
export type TaskAutomationAction = z.output<typeof taskAutomationActionSchema>;

/** Actions of a rule: one at least. */
export const taskAutomationActionsSchema = z
  .array(taskAutomationActionSchema)
  .min(1, 'Ajoutez au moins une action.')
  .max(TASK_AUTOMATION_ACTIONS_MAX, `${TASK_AUTOMATION_ACTIONS_MAX} actions au plus.`);

/** A rule of the workspace, as saved: its name and color (a settings list), on or off, trigger, condition, actions. */
export const taskAutomationSchema = z.object({
  label: requiredText('Le nom est requis.'),
  color: colorSchema,
  enabled: z.boolean().default(true),
  trigger: taskAutomationTriggerSchema,
  condition: taskAutomationConditionSchema.default(null),
  actions: taskAutomationActionsSchema,
});
export type TaskAutomationInput = z.input<typeof taskAutomationSchema>;

/** What gives a task back as it was before a rule: its project (moved back), its fields, its open / closed and archived states. */
export interface TaskAutomationRevert {
  taskId: string;
  /** Project it is moved back to (undefined: not moved). */
  projectId?: string | null;
  changes: TaskBulkChanges;
  /** Open / closed state given back (undefined: unchanged). */
  closed?: boolean;
  /** Restored when the rule archived it. */
  restore?: boolean;
}

/** A rule applied during a change: its name, what it did, the tasks it changed and how to undo it; or why it could not. */
export interface TaskAutomationReport {
  ruleId: string;
  label: string;
  /** What it did, in words (« statut « En cours » »). */
  changes: string[];
  taskIds: string[];
  reverts: TaskAutomationRevert[];
  /** Why it could not change a task (the refusal of the change); null when applied. */
  error: string | null;
}

/** Key of the extensions of a GraphQL answer listing the rules applied during it (`TaskAutomationReport[]`). */
export const TASK_AUTOMATIONS_EXTENSION = 'taskAutomations';

/**
 * Message of the toast of a rule applied: « Règle « Démarrage » : statut « En cours » », the number of tasks when
 * several; for a rule refused, why.
 * @param {TaskAutomationReport} report Rule applied.
 * @returns {string} Message.
 */
export function taskAutomationMessage(report: TaskAutomationReport): string {
  const tasks = report.taskIds.length > 1 ? ` (${countOf(report.taskIds.length, 'tâche')})` : '';
  if (report.error) return `Règle « ${report.label} » non appliquée${tasks} : ${report.error}`;
  return `Règle « ${report.label} » : ${report.changes.join(', ')}${tasks}`;
}

/**
 * What an action does, in words: « statut « En cours » », « étiquettes + « Bug » », « échéance vidée », « fermée ».
 * @param {TaskAutomationAction} action Action.
 * @param {(field: TaskAutomationField, value: string) => string} nameOf Name of an item of a field (a status, a tag…).
 * @param {(day: string) => string} dayOf Text of a day value (« aujourd’hui », « 22 nov. 2026 »).
 * @returns {string} Words.
 */
export function taskAutomationActionText(action: TaskAutomationAction, nameOf: (field: TaskAutomationField, value: string) => string, dayOf: (day: string) => string): string {
  if (action.kind === 'CLOSE') return 'fermée';
  if (action.kind === 'REOPEN') return 'rouverte';
  if (action.kind === 'ARCHIVE') return 'archivée';
  const field = action.field!;
  const meta = TASK_AUTOMATION_FIELD_META[field];
  if (action.kind === 'CLEAR') return `${meta.label} ${agreed('vidé', meta.feminine, meta.plural ? 2 : 1)}`;
  const names = (Array.isArray(action.value) ? action.value : [String(action.value)]).map((value) => `« ${nameOf(field, value)} »`).join(', ');
  if (action.kind === 'ADD') return `${meta.label} + ${names}`;
  if (action.kind === 'REMOVE') return `${meta.label} − ${names}`;
  if (meta.kind === 'day') return `${meta.label} « ${dayOf(String(action.value))} »`;
  if (meta.kind === 'number') return `${meta.label} ${String(action.value)}`;
  return `${meta.label} ${names}`;
}
