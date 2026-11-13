import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  MAX_FILTER_DEPTH,
  ME,
  TASK_FILTER_FIELDS,
  TASK_STATUS_CATEGORIES,
  VALUELESS_OPERATORS,
  type FilterConditionOf,
  type FilterFieldKind,
  type FilterGroup,
  type FilterGroupOf,
  type FilterOperator,
  type TaskFilterField,
} from '@ordo/shared';
import type { ComponentProps } from 'react';
import { FolderSimplePlusIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { TaskContext } from '../use-task-context';
import classes from './FilterBuilder.module.css';
import { defaultValueFor, FIELD_GROUPS, FIELD_LABELS, isComplete, newConditionFor, nodeId, OPERATOR_LABELS, operatorsFor, PERIOD_LABELS } from './filter-meta';
import { BatchMultiSelect } from '../../../components/BatchMultiSelect';
import { treeSelectProps } from '../../../components/tree-select/tree-select';

// Dropdowns render inside the filter popover: in a portal, picking an option would count as a click
// outside the popover and close it.
const INLINE = { withinPortal: false } as const;

const CATEGORY_LABELS = { TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Terminé', CANCELLED: 'Annulé' };

/**
 * Options of a reference field (project, status, priority, type, parent task, assignees).
 * @param {TaskFilterField} field Field.
 * @param {TaskContext} context Task context.
 * @returns {{ value: string, label: string }[]} Options.
 */
function referenceOptions(field: TaskFilterField, context: TaskContext): { value: string; label: string }[] {
  const labels = (items: { id: string; name: string }[]) => items.map((item) => ({ value: item.id, label: item.name }));
  switch (field) {
    case 'project':
      return context.projectOptions(context.projects);
    case 'status':
      return labels(context.statuses);
    case 'priority':
      return labels(context.priorities);
    case 'type':
      return labels(context.types);
    case 'parent':
      return context.tasks.map((task) => ({ value: task.id, label: context.taskLabel(task) }));
    case 'assignees':
      // "Moi" follows the logged-in user, whatever their contributor profile.
      return [
        { value: ME, label: 'Moi' },
        ...context.contributors.filter((contributor) => !contributor.isMe).map((contributor) => ({ value: contributor.id, label: contributor.name })),
      ];
    case 'milestone':
      return context.milestones.map((milestone) => ({
        value: milestone.id,
        label: `${milestone.title} — ${context.projectById.get(milestone.projectId)?.title ?? ''}`,
      }));
    case 'tags':
      return context.tags.map((tag) => ({ value: tag.id, label: tag.name }));
    case 'sprint':
      return context.sprints.map((sprint) => ({
        value: sprint.id,
        label: `${sprint.name} — ${context.projectById.get(sprint.projectId)?.title ?? ''}`,
      }));
    case 'statusCategory':
      return TASK_STATUS_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] }));
    default:
      return [];
  }
}

interface DayValueProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Day picker: a specific date, today, N days ago or in N days.
 * @param {DayValueProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
function DayValue({ value, onChange }: DayValueProps) {
  const relative = /^today([+-])?(\d+)?$/.exec(value);
  const mode = !relative ? 'date' : !relative[1] ? 'today' : relative[1] === '-' ? 'past' : 'future';
  const days = relative?.[2] ? Number(relative[2]) : 1;
  return (
    <Group gap="xs" wrap="nowrap">
      <Select
        comboboxProps={INLINE}
        size="xs"
        aria-label="Type de date"
        data={[
          { value: 'today', label: 'Aujourd’hui' },
          { value: 'past', label: 'Il y a N jours' },
          { value: 'future', label: 'Dans N jours' },
          { value: 'date', label: 'Date précise' },
        ]}
        value={mode}
        allowDeselect={false}
        onChange={(next) =>
          onChange(
            next === 'today'
              ? 'today'
              : next === 'past'
                ? `today-${days}`
                : next === 'future'
                  ? `today+${days}`
                  : new Date().toISOString().slice(0, 10),
          )
        }
        w={140}
      />
      {(mode === 'past' || mode === 'future') && (
        <NumberInput
          size="xs"
          aria-label="Nombre de jours"
          min={1}
          max={3650}
          value={days}
          onChange={(next) => onChange(`today${mode === 'past' ? '-' : '+'}${Math.max(1, Number(next) || 1)}`)}
          w={80}
        />
      )}
      {mode === 'date' && (
        <DatePickerInput popoverProps={INLINE} size="xs" aria-label="Date" value={value} onChange={(next) => next && onChange(next)} w={150} />
      )}
    </Group>
  );
}

/**
 * Period picker for the "pendant" operator.
 * @param {DayValueProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
function PeriodValue({ value, onChange }: DayValueProps) {
  const rolling = /^(past|next):(\d+)$/.exec(value);
  const mode = rolling ? rolling[1] : value;
  const days = rolling ? Number(rolling[2]) : 7;
  return (
    <Group gap="xs" wrap="nowrap">
      <Select
        comboboxProps={INLINE}
        size="xs"
        aria-label="Période"
        data={[
          ...Object.entries(PERIOD_LABELS).map(([key, label]) => ({ value: key, label })),
          { value: 'past', label: 'Les N derniers jours' },
          { value: 'next', label: 'Les N prochains jours' },
        ]}
        value={mode}
        allowDeselect={false}
        onChange={(next) => next && onChange(next === 'past' || next === 'next' ? `${next}:${days}` : next)}
        w={180}
      />
      {rolling && (
        <NumberInput
          size="xs"
          aria-label="Nombre de jours"
          min={1}
          max={3650}
          value={days}
          onChange={(next) => onChange(`${rolling[1]}:${Math.max(1, Number(next) || 1)}`)}
          w={80}
        />
      )}
    </Group>
  );
}

/** Fields a filter builder offers, and how to edit their values. */
export interface FilterFields<F extends string> {
  /** Kind of each field. */
  kinds: Record<F, FilterFieldKind>;
  labels: Record<F, string>;
  /** Fields of the field select, by group. */
  groups: { group: string; fields: F[] }[];
  /** Field of a new condition. */
  first: F;
  /** Select props of the values of a field of kind reference, multiReference, sprint or category. */
  options: (field: F) => Pick<ComponentProps<typeof BatchMultiSelect>, 'data' | 'renderOption' | 'filter'>;
  /** Whether a condition is complete (valid), so it applies. */
  isComplete: (condition: FilterConditionOf<F>) => boolean;
  /** Label of an operator of a field, instead of the one of its kind. Optional. */
  operatorLabel?: (field: F, operator: FilterOperator) => string | undefined;
  /** What an empty filter shows. */
  emptyText: string;
}

interface ConditionEditorProps<F extends string> {
  condition: FilterConditionOf<F>;
  fields: FilterFields<F>;
  onChange: (condition: FilterConditionOf<F>) => void;
  onRemove: () => void;
}

/**
 * One condition: field, operator and value editor adapted to the field.
 * @param {ConditionEditorProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function ConditionEditor<F extends string>({ condition, fields, onChange, onRemove }: ConditionEditorProps<F>) {
  const kind = fields.kinds[condition.field];
  const operator = condition.operator as FilterOperator;
  const needsValue = !VALUELESS_OPERATORS.includes(operator);
  const set = (value: FilterConditionOf<F>['value']) => onChange({ ...condition, value });

  let editor = null;
  if (needsValue) {
    if (kind === 'text') {
      editor = (
        <TextInput
          size="xs"
          aria-label="Valeur"
          value={typeof condition.value === 'string' ? condition.value : ''}
          onChange={(event) => set(event.currentTarget.value)}
          w={200}
        />
      );
    } else if (kind === 'number') {
      editor = (
        <NumberInput
          size="xs"
          aria-label="Valeur"
          decimalSeparator=","
          value={typeof condition.value === 'number' ? condition.value : ''}
          onChange={(next) => set(typeof next === 'number' ? next : null)}
          w={110}
        />
      );
    } else if (kind === 'date') {
      const value = typeof condition.value === 'string' ? condition.value : '';
      editor = operator === 'within' ? <PeriodValue value={value} onChange={set} /> : <DayValue value={value} onChange={set} />;
    } else if (kind === 'reference' || kind === 'multiReference' || kind === 'sprint' || kind === 'category') {
      editor = (
        <BatchMultiSelect
          comboboxProps={INLINE}
          size="xs"
          aria-label="Valeurs"
          placeholder="Choisir…"
          {...fields.options(condition.field)}
          value={Array.isArray(condition.value) ? condition.value : []}
          onChange={set}
          searchable
          clearable
          maxDropdownHeight={260}
          miw={220}
          style={{ flex: 1 }}
        />
      );
    }
  }

  return (
    <Group gap="xs" wrap="wrap" className={classes.condition} data-incomplete={!fields.isComplete(condition) || undefined}>
      <Select
        comboboxProps={INLINE}
        size="xs"
        aria-label="Champ"
        data={fields.groups.map(({ group, fields: items }) => ({
          group,
          items: items.map((field) => ({ value: field, label: fields.labels[field] })),
        }))}
        value={condition.field}
        allowDeselect={false}
        searchable
        onChange={(field) => field && onChange({ ...newConditionFor(fields.kinds, field as F), id: condition.id })}
        w={170}
      />
      <Select
        comboboxProps={INLINE}
        size="xs"
        aria-label="Opérateur"
        data={operatorsFor(fields.kinds, condition.field).map((item) => ({ value: item, label: fields.operatorLabel?.(condition.field, item) ?? OPERATOR_LABELS[kind][item] ?? item }))}
        value={operator}
        allowDeselect={false}
        onChange={(next) => {
          if (!next) return;
          const nextOperator = next as FilterOperator;
          // Keep the value when it still fits (e.g. "est" → "n'est pas").
          const keep =
            !VALUELESS_OPERATORS.includes(nextOperator) &&
            needsValue &&
            (kind !== 'date' || (nextOperator === 'within') === (operator === 'within'));
          onChange({
            ...condition,
            operator: nextOperator,
            value: keep ? condition.value : defaultValueFor(kind, nextOperator),
          });
        }}
        w={190}
      />
      {editor}
      <Tooltip label="Retirer la condition">
        <ActionIcon variant="subtle" color="gray" size="input-xs" aria-label="Retirer la condition" onClick={onRemove}>
          <TrashIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

interface GroupEditorProps<F extends string> {
  group: FilterGroupOf<F>;
  depth: number;
  fields: FilterFields<F>;
  onChange: (group: FilterGroupOf<F>) => void;
  onRemove?: () => void;
}

/**
 * Group of conditions combined with ET (all) or OU (at least one), possibly containing sub-groups.
 * @param {GroupEditorProps} props Component props.
 * @returns {JSX.Element} Group.
 */
function GroupEditor<F extends string>({ group, depth, fields, onChange, onRemove }: GroupEditorProps<F>) {
  /**
   * Replaces a child.
   * @param {number} index Child index.
   * @param {FilterGroup['children'][number] | null} child New child, or null to remove it.
   * @returns {void}
   */
  const setChild = (index: number, child: FilterGroupOf<F>['children'][number] | null) =>
    onChange({
      ...group,
      children: child === null ? group.children.filter((_, i) => i !== index) : group.children.map((c, i) => (i === index ? child : c)),
    });

  const combinator = (
    <SegmentedControl
      size="xs"
      value={group.combinator}
      onChange={(value) => onChange({ ...group, combinator: value as 'and' | 'or' })}
      data={[
        { value: 'and', label: 'ET' },
        { value: 'or', label: 'OU' },
      ]}
      aria-label="Combinaison des conditions"
    />
  );

  return (
    <Paper withBorder={depth > 1} p={depth > 1 ? 'sm' : 0} radius="md" className={classes.group} data-depth={depth}>
      <Stack gap="xs">
        {group.children.length > 1 && (
          <Group gap="xs">
            {combinator}
            <Text size="xs" c="dimmed">
              {group.combinator === 'and' ? 'Toutes les conditions' : 'Au moins une condition'}
            </Text>
          </Group>
        )}
        {group.children.length === 0 && (
          <Text size="sm" c="dimmed">
            {depth === 1 ? fields.emptyText : 'Groupe vide.'}
          </Text>
        )}
        {group.children.map((child, index) => (
          <div key={child.id} className={classes.child}>
            {index > 0 && (
              <Text size="xs" fw={700} c="dimmed" className={classes.joiner}>
                {group.combinator === 'and' ? 'ET' : 'OU'}
              </Text>
            )}
            {child.type === 'condition' ? (
              <ConditionEditor
                condition={child}
                fields={fields}
                onChange={(next) => setChild(index, next)}
                onRemove={() => setChild(index, null)}
              />
            ) : (
              <GroupEditor
                group={child}
                depth={depth + 1}
                fields={fields}
                onChange={(next) => setChild(index, next)}
                onRemove={() => setChild(index, null)}
              />
            )}
          </div>
        ))}
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="subtle"
            leftSection={<PlusIcon aria-hidden />}
            onClick={() => onChange({ ...group, children: [...group.children, newConditionFor(fields.kinds, fields.first)] })}
          >
            Condition
          </Button>
          {depth < MAX_FILTER_DEPTH && (
            <Button
              size="compact-sm"
              variant="subtle"
              leftSection={<FolderSimplePlusIcon aria-hidden />}
              onClick={() =>
                onChange({
                  ...group,
                  children: [
                    ...group.children,
                    { type: 'group', id: nodeId(), combinator: group.combinator === 'and' ? 'or' : 'and', children: [newConditionFor(fields.kinds, fields.first)] },
                  ],
                })
              }
            >
              Groupe
            </Button>
          )}
          {onRemove && (
            <Button size="compact-sm" variant="subtle" color="red" leftSection={<TrashIcon aria-hidden />} onClick={onRemove}>
              Retirer le groupe
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

/**
 * Fields of the task filters, their values from the task context.
 * @param {TaskContext} context Task context.
 * @returns {FilterFields<TaskFilterField>} Fields.
 */
function taskFilterFields(context: TaskContext): FilterFields<TaskFilterField> {
  return {
    kinds: TASK_FILTER_FIELDS,
    labels: FIELD_LABELS,
    groups: FIELD_GROUPS,
    first: 'title',
    options: (field) =>
      field === 'project' ? treeSelectProps(context.projectOptions(context.projects)) : field === 'parent' ? treeSelectProps(context.taskOptions(context.tasks)) : { data: referenceOptions(field, context) },
    isComplete,
    emptyText: 'Aucun filtre : toutes les tâches sont affichées.',
  };
}

interface FieldsFilterBuilderProps<F extends string> {
  filter: FilterGroupOf<F>;
  fields: FilterFields<F>;
  onChange: (filter: FilterGroupOf<F>) => void;
}

/**
 * Editor of a filter tree on some fields (tasks, routines…): conditions and nested groups combined with ET / OU.
 * @param {FieldsFilterBuilderProps<F>} props Component props.
 * @returns {JSX.Element} Builder.
 */
export function FieldsFilterBuilder<F extends string>({ filter, fields, onChange }: FieldsFilterBuilderProps<F>) {
  return <GroupEditor group={filter} depth={1} fields={fields} onChange={onChange} />;
}

interface FilterBuilderProps {
  filter: FilterGroup;
  context: TaskContext;
  onChange: (filter: FilterGroup) => void;
}

/**
 * Editor of a task filter tree.
 * @param {FilterBuilderProps} props Component props.
 * @returns {JSX.Element} Builder.
 */
export function FilterBuilder({ filter, context, onChange }: FilterBuilderProps) {
  return <FieldsFilterBuilder filter={filter} fields={taskFilterFields(context)} onChange={onChange} />;
}
