import { Fieldset, Group, NumberInput, Select, Stack, Switch, Text } from '@mantine/core';
import {
  capitalize,
  ME,
  RELATIVE_SPRINTS,
  TASK_AUTOMATION_ACTION_LABELS,
  TASK_AUTOMATION_ACTIONS,
  TASK_AUTOMATION_ACTIONS_MAX,
  TASK_AUTOMATION_CHANGE_LABELS,
  TASK_AUTOMATION_CHANGES,
  TASK_AUTOMATION_EVENT_LABELS,
  TASK_AUTOMATION_EVENTS,
  TASK_AUTOMATION_FIELD_ACTIONS,
  TASK_AUTOMATION_FIELD_META,
  TASK_AUTOMATION_FIELDS,
  TASK_AUTOMATION_FILTER_FIELDS,
  type TableFilterGroup,
  type TaskAutomationActionKind,
  type TaskAutomationChange,
  type TaskAutomationEvent,
  type TaskAutomationField,
} from '@ordo/shared';
import type { ComponentProps } from 'react';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { tableFilterFields } from '../../../components/data-table/table/table-engine';
import { DayValue, FieldsFilterBuilder, type FilterFields } from '../../../components/filters/FilterBuilder';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { FRENCH_NUMBER_FORMAT, optionalNumber } from '../../../components/inputs/number-format';
import { parisToday } from '../../../lib/dates';
import { useTaskColumns } from '../hooks/use-task-columns';
import type { TaskContext } from '../hooks/use-task-context';

/** Trigger of a rule, as its form holds it. */
export interface TriggerValues {
  event: TaskAutomationEvent;
  field: TaskAutomationField | null;
  change: TaskAutomationChange | null;
  value: string | null;
}

/** Action of a rule, as its form holds it. */
export interface ActionValues {
  kind: TaskAutomationActionKind;
  field: TaskAutomationField | null;
  value: string | number | string[] | null;
}

/** Fields of the form of a rule beyond its name and color. */
export interface TaskAutomationExtra {
  enabled: boolean;
  trigger: TriggerValues;
  condition: TableFilterGroup;
  actions: ActionValues[];
}

/** Column of the task table holding the choices of each field of a list of items. */
const FIELD_COLUMNS: Partial<Record<TaskAutomationField, string>> = {
  STATUS: 'status',
  PRIORITY: 'priority',
  TYPE: 'type',
  TAGS: 'tags',
  ASSIGNEES: 'assignees',
  MILESTONE: 'milestone',
  SPRINTS: 'sprint',
  PROJECT: 'project',
};

/** Values of the filters that are not items (« Moi », the relative sprints): a rule names items. */
const NOT_ITEMS = new Set<string>([ME, ...RELATIVE_SPRINTS]);

/** Fields, for their selects. */
const FIELD_OPTIONS = TASK_AUTOMATION_FIELDS.map((field) => ({ value: field, label: capitalize(TASK_AUTOMATION_FIELD_META[field].label) }));

/**
 * Value a field starts with when it is chosen: « Aujourd’hui » for a day (what the day editor shows), none otherwise.
 * @param {TaskAutomationField | null} field Field chosen.
 * @returns {string | null} Starting value.
 */
function startValue(field: TaskAutomationField | null): string | null {
  return field && TASK_AUTOMATION_FIELD_META[field].kind === 'day' ? 'today' : null;
}

/**
 * Choices of a field of a list of items (statuses, tags, people, projects…), as the filters of the task table offer
 * them (their avatars, the projects as their tree), the current values offered even when archived.
 * @param {FilterFields<string>} fields Fields of the filters of the tasks.
 * @param {TaskAutomationField} field Field.
 * @param {readonly string[]} values Current values.
 * @returns {Pick<ComponentProps<typeof BatchMultiSelect>, 'data' | 'renderOption' | 'filter'>} Select props.
 */
function choicesOf(fields: FilterFields<string>, field: TaskAutomationField, values: readonly string[]): Pick<ComponentProps<typeof BatchMultiSelect>, 'data' | 'renderOption' | 'filter'> {
  const column = FIELD_COLUMNS[field];
  if (!column) return { data: [] };
  const props = fields.options(column, values);
  return { ...props, data: ((props.data ?? []) as { value: string; label: string }[]).filter((option) => !NOT_ITEMS.has(option.value)) };
}

interface ValueEditorProps {
  fields: FilterFields<string>;
  field: TaskAutomationField;
  /** Several items (a list field, or « Ajouter » / « Retirer »). */
  multiple: boolean;
  value: ActionValues['value'];
  error?: string;
  onChange: (value: ActionValues['value']) => void;
}

/**
 * Value given by an action: an item, several, a day (a date, today or in N days), a number.
 * @param {ValueEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
function ValueEditor({ fields, field, multiple, value, error, onChange }: ValueEditorProps) {
  const { kind } = TASK_AUTOMATION_FIELD_META[field];
  if (kind === 'day')
    return (
      <Stack gap={2}>
        <DayValue value={typeof value === 'string' ? value : 'today'} onChange={onChange} />
        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}
      </Stack>
    );
  if (kind === 'number')
    return <NumberInput size="xs" aria-label="Valeur" {...FRENCH_NUMBER_FORMAT} min={0} value={typeof value === 'number' ? value : ''} error={error} onChange={(next) => onChange(optionalNumber(next))} w={120} />;
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const choices = choicesOf(fields, field, values);
  if (multiple) return <BatchMultiSelect size="xs" aria-label="Valeurs" placeholder="Choisir…" {...choices} value={values} error={error} onChange={onChange} />;
  return <Select size="xs" aria-label="Valeur" placeholder="Choisir…" searchable {...choices} value={values[0] ?? null} error={error} onChange={(next) => onChange(next)} />;
}

interface TaskAutomationFieldsProps {
  values: TaskAutomationExtra;
  errors: Record<string, unknown>;
  context: TaskContext | null;
  onChange: <K extends keyof TaskAutomationExtra>(key: K, value: TaskAutomationExtra[K]) => void;
}

/**
 * Fields of a rule: on or off; « Quand » (the trigger: what happens, and for a field, which one, how it changes, the
 * value); « Si » (the condition, with the filter of the task table on the columns a rule reads; none: every task);
 * « Alors » (the actions, in order: a value given, added, removed, emptied; the task closed, reopened or archived).
 * @param {TaskAutomationFieldsProps} props Values, their errors, the task context, the change of a field.
 * @returns {JSX.Element} Fields.
 */
export function TaskAutomationFields({ values, errors, context, onChange }: TaskAutomationFieldsProps) {
  const columns = useTaskColumns(context, parisToday(), { doable: false });
  const fields = tableFilterFields(columns.filter((column) => (TASK_AUTOMATION_FILTER_FIELDS as readonly string[]).includes(column.id)));
  const { trigger, actions } = values;
  const errorOf = (path: string) => (typeof errors[path] === 'string' ? (errors[path] as string) : undefined);
  /**
   * Changes the trigger.
   * @param {Partial<TriggerValues>} change Values changed.
   * @returns {void}
   */
  const setTrigger = (change: Partial<TriggerValues>) => onChange('trigger', { ...trigger, ...change });
  /**
   * Changes an action.
   * @param {number} index Action.
   * @param {Partial<ActionValues>} change Values changed.
   * @returns {void}
   */
  const setAction = (index: number, change: Partial<ActionValues>) =>
    onChange(
      'actions',
      actions.map((action, other) => (other === index ? { ...action, ...change } : action)),
    );
  const precise = trigger.field ? ['reference', 'list'].includes(TASK_AUTOMATION_FIELD_META[trigger.field].kind) : false;

  return (
    <Stack gap="md">
      <Switch label="Active" description="Désactivée, elle est gardée mais ne s’applique pas." checked={values.enabled} onChange={(event) => onChange('enabled', event.currentTarget.checked)} />
      <Fieldset legend="Quand">
        <Stack gap="xs">
          <Select
            label="Déclencheur"
            data={TASK_AUTOMATION_EVENTS.map((event) => ({ value: event, label: TASK_AUTOMATION_EVENT_LABELS[event] }))}
            value={trigger.event}
            allowDeselect={false}
            error={errorOf('trigger.event')}
            onChange={(event) => event && setTrigger({ event: event as TaskAutomationEvent })}
          />
          {trigger.event === 'FIELD_CHANGED' && (
            <Group gap="xs" align="flex-start" grow>
              <Select
                label="Champ"
                data={FIELD_OPTIONS}
                value={trigger.field}
                error={errorOf('trigger.field')}
                onChange={(field) => setTrigger({ field: field as TaskAutomationField | null, value: startValue(field as TaskAutomationField | null), change: trigger.change === 'IS' ? 'CHANGED' : trigger.change })}
              />
              <Select
                label="Changement"
                data={TASK_AUTOMATION_CHANGES.filter((change) => change !== 'IS' || precise).map((change) => ({ value: change, label: TASK_AUTOMATION_CHANGE_LABELS[change] }))}
                value={trigger.change}
                error={errorOf('trigger.change')}
                onChange={(change) => setTrigger({ change: change as TaskAutomationChange | null, value: startValue(trigger.field) })}
              />
            </Group>
          )}
          {trigger.event === 'FIELD_CHANGED' && trigger.change === 'IS' && trigger.field && (
            <ValueEditor fields={fields} field={trigger.field} multiple={false} value={trigger.value} error={errorOf('trigger.value')} onChange={(value) => setTrigger({ value: typeof value === 'string' ? value : null })} />
          )}
        </Stack>
      </Fieldset>
      <Fieldset legend="Si">
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            Facultatif : les tâches que la règle change, avec le filtre des tableaux de tâches, sur les valeurs qu’elles suivent (héritées comprises).
          </Text>
          <FieldsFilterBuilder filter={values.condition} fields={{ ...fields, emptyText: 'Aucune condition : toutes les tâches.' }} onChange={(condition) => onChange('condition', condition)} />
          {errorOf('condition') && (
            <Text size="xs" c="red">
              {errorOf('condition')}
            </Text>
          )}
        </Stack>
      </Fieldset>
      <Fieldset legend="Alors">
        <Stack gap="xs">
          {actions.map((action, index) => {
            const onField = TASK_AUTOMATION_FIELD_ACTIONS.includes(action.kind);
            const listOnly = action.kind === 'ADD' || action.kind === 'REMOVE';
            return (
              <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Group gap="xs" align="flex-start" grow>
                    <Select
                      size="xs"
                      aria-label={`Action ${index + 1}`}
                      data={TASK_AUTOMATION_ACTIONS.map((kind) => ({ value: kind, label: TASK_AUTOMATION_ACTION_LABELS[kind] }))}
                      value={action.kind}
                      allowDeselect={false}
                      onChange={(kind) => kind && setAction(index, { kind: kind as TaskAutomationActionKind, value: startValue(action.field ?? null) })}
                    />
                    {onField && (
                      <Select
                        size="xs"
                        aria-label={`Champ de l’action ${index + 1}`}
                        placeholder="Champ"
                        data={listOnly ? FIELD_OPTIONS.filter((option) => TASK_AUTOMATION_FIELD_META[option.value].kind === 'list') : FIELD_OPTIONS}
                        value={action.field}
                        error={errorOf(`actions.${index}.field`)}
                        onChange={(field) => setAction(index, { field: field as TaskAutomationField | null, value: startValue(field as TaskAutomationField | null) })}
                      />
                    )}
                  </Group>
                  {onField && action.kind !== 'CLEAR' && action.field && (
                    <ValueEditor
                      fields={fields}
                      field={action.field}
                      multiple={listOnly || TASK_AUTOMATION_FIELD_META[action.field].kind === 'list'}
                      value={action.value}
                      error={errorOf(`actions.${index}.value`)}
                      onChange={(value) => setAction(index, { value })}
                    />
                  )}
                </Stack>
                <RemoveButton label="Retirer" aria-label={`Retirer l’action ${index + 1}`} disabled={actions.length === 1} onClick={() => onChange('actions', actions.filter((_, other) => other !== index))} />
              </Group>
            );
          })}
          {errorOf('actions') && (
            <Text size="xs" c="red">
              {errorOf('actions')}
            </Text>
          )}
          <AddItemButton disabled={actions.length >= TASK_AUTOMATION_ACTIONS_MAX} onClick={() => onChange('actions', [...actions, { kind: 'SET', field: null, value: null }])}>
            Ajouter une action
          </AddItemButton>
        </Stack>
      </Fieldset>
    </Stack>
  );
}
