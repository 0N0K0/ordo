import {
  emptyTableFilter,
  taskAutomationActionsSchema,
  taskAutomationConditionSchema,
  taskAutomationSchema,
  taskAutomationTriggerSchema,
} from '@ordo/shared';
import { itemMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { useTaskAutomationMutations, type TaskAutomation } from '../api/automations';
import { TaskAutomationFields, type ActionValues, type TaskAutomationExtra, type TriggerValues } from '../components/TaskAutomationFields';
import type { TaskContext } from './use-task-context';

/** Trigger of a new rule: « Quand le début est renseigné ». */
const NEW_TRIGGER: TriggerValues = { event: 'FIELD_CHANGED', field: 'START_DATE', change: 'SET', value: null };
/** Action of a new rule, its value to choose: « Alors le statut prend… ». */
const NEW_ACTION: ActionValues = { kind: 'SET', field: 'STATUS', value: null };

/**
 * Values of the form of a rule: those it has (read by their schemas), or those of a new one.
 * @param {TaskAutomation} [rule] Rule. Optional.
 * @returns {TaskAutomationExtra} Values.
 */
function extraOf(rule?: TaskAutomation): TaskAutomationExtra {
  const trigger = taskAutomationTriggerSchema.safeParse(rule?.trigger);
  const condition = taskAutomationConditionSchema.safeParse(rule?.condition ?? null);
  const actions = taskAutomationActionsSchema.safeParse(rule?.actions);
  return {
    enabled: rule?.enabled ?? true,
    trigger: trigger.success ? trigger.data : NEW_TRIGGER,
    condition: (condition.success ? condition.data : null) ?? emptyTableFilter(),
    actions: actions.success ? actions.data : [NEW_ACTION],
  };
}

/**
 * Automations of the tasks, for their settings list and their form: name, color, image, on or off, trigger,
 * condition (the filter of the task table) and actions, checked by `taskAutomationSchema`; saved as every settings list.
 * @param {TaskContext | null} context Task context (the choices of the fields, the columns of the condition).
 * @returns {SettingsItemKind<TaskAutomation, TaskAutomationExtra>} List and form.
 */
export function useTaskAutomationItems(context: TaskContext | null): SettingsItemKind<TaskAutomation, TaskAutomationExtra> {
  const { create, update } = useTaskAutomationMutations();
  return {
    kind: 'TASK_AUTOMATION',
    labelField: 'Nom',
    labelPlaceholder: 'Démarrage, clôture des parents…',
    schema: taskAutomationSchema,
    extra: {
      initial: extraOf,
      render: (form) => (
        <TaskAutomationFields
          values={form.getValues()}
          errors={form.errors}
          context={context}
          onChange={(key, value) => form.setFieldValue(key, value as never)}
        />
      ),
    },
    ...itemMutations({ create, update }, (values: { label: string; color: string } & TaskAutomationExtra) => ({
      label: values.label,
      color: values.color,
      enabled: values.enabled,
      trigger: values.trigger,
      // An empty filter: every task.
      condition: values.condition.children.length ? values.condition : null,
      actions: values.actions,
    })),
  };
}
