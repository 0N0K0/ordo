import { AddItemButton } from '../actions/AddItemButton';
import { Group, NumberInput, Paper, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DATE_PERIOD_LABELS, MAX_FILTER_DEPTH, VALUELESS_OPERATORS, type FilterConditionOf, type FilterFieldKind, type FilterGroupOf, type FilterOperator } from '@ordo/shared';
import type { ComponentProps } from 'react';
import { FolderSimplePlusIcon, TrashIcon } from '@phosphor-icons/react';
import classes from './FilterBuilder.module.css';
import { localToday } from '../../lib/dates';
import { defaultValueFor, newConditionFor, nodeId, OPERATOR_LABELS, operatorsFor } from './filter-meta';
import { BatchMultiSelect } from '../inputs/BatchMultiSelect';
import { RemoveButton } from '../actions/RemoveButton';
import { ActionButton } from '../actions/ActionButton';
import { optionalNumber } from '../inputs/number-format';

// Dropdowns render inside the filter popover: in a portal, picking an option would count as a click
// outside the popover and close it.
const INLINE = { withinPortal: false } as const;

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
        onChange={(next) => onChange(next === 'today' ? 'today' : next === 'past' ? `today-${days}` : next === 'future' ? `today+${days}` : localToday())}
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
      {mode === 'date' && <DatePickerInput popoverProps={INLINE} size="xs" aria-label="Date" value={value} onChange={(next) => next && onChange(next)} w={150} />}
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
          ...Object.entries(DATE_PERIOD_LABELS).map(([key, label]) => ({ value: key, label })),
          { value: 'past', label: 'Les N derniers jours' },
          { value: 'next', label: 'Les N prochains jours' },
        ]}
        value={mode}
        allowDeselect={false}
        onChange={(next) => next && onChange(next === 'past' || next === 'next' ? `${next}:${days}` : next)}
        w={180}
      />
      {rolling && <NumberInput size="xs" aria-label="Nombre de jours" min={1} max={3650} value={days} onChange={(next) => onChange(`${rolling[1]}:${Math.max(1, Number(next) || 1)}`)} w={80} />}
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
  /** Select props of the values of a field of kind reference, multiReference, sprint or category, given its current values (offered even when archived). */
  options: (field: F, values: readonly string[]) => Pick<ComponentProps<typeof BatchMultiSelect>, 'data' | 'renderOption' | 'filter'>;
  /** Whether a condition is complete (valid), so it applies. */
  isComplete: (condition: FilterConditionOf<F>) => boolean;
  /** Label of an operator of a field, instead of the one of its kind. Optional. */
  operatorLabel?: (field: F, operator: FilterOperator) => string | undefined;
  /** Operators of a field, instead of all those of its kind. Optional. */
  operators?: (field: F) => readonly FilterOperator[];
  /** Fields whose value is never empty: « est vide » / « n’est pas vide » are not offered on them. Optional. */
  required?: ReadonlySet<F>;
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
      editor = <TextInput size="xs" aria-label="Valeur" value={typeof condition.value === 'string' ? condition.value : ''} onChange={(event) => set(event.currentTarget.value)} w={200} />;
    } else if (kind === 'number') {
      editor = (
        <NumberInput size="xs" aria-label="Valeur" decimalSeparator="," value={typeof condition.value === 'number' ? condition.value : ''} onChange={(next) => set(optionalNumber(next))} w={110} />
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
          {...fields.options(condition.field, Array.isArray(condition.value) ? condition.value : [])}
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
        onChange={(field) => {
          if (!field) return;
          // The first operator the field offers (its own ones when it has some).
          onChange({ ...newConditionFor(fields, field as F), id: condition.id });
        }}
        w={170}
      />
      <Select
        comboboxProps={INLINE}
        size="xs"
        aria-label="Opérateur"
        data={operatorsFor(fields, condition.field, operator).map((item) => ({
          value: item,
          label: fields.operatorLabel?.(condition.field, item) ?? OPERATOR_LABELS[kind][item] ?? item,
        }))}
        value={operator}
        allowDeselect={false}
        onChange={(next) => {
          if (!next) return;
          const nextOperator = next as FilterOperator;
          // Keep the value when it still fits (e.g. "est" → "n'est pas").
          const keep = !VALUELESS_OPERATORS.includes(nextOperator) && needsValue && (kind !== 'date' || (nextOperator === 'within') === (operator === 'within'));
          onChange({
            ...condition,
            operator: nextOperator,
            value: keep ? condition.value : defaultValueFor(kind, nextOperator),
          });
        }}
        w={190}
      />
      {editor}
      <RemoveButton label="Retirer" aria-label="Retirer la condition" size="input-xs" onClick={onRemove} />
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
   * @param {FilterGroupOf<F>['children'][number] | null} child New child, or null to remove it.
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
              <ConditionEditor condition={child} fields={fields} onChange={(next) => setChild(index, next)} onRemove={() => setChild(index, null)} />
            ) : (
              <GroupEditor group={child} depth={depth + 1} fields={fields} onChange={(next) => setChild(index, next)} onRemove={() => setChild(index, null)} />
            )}
          </div>
        ))}
        <Group gap="xs">
          <AddItemButton onClick={() => onChange({ ...group, children: [...group.children, newConditionFor(fields, fields.first)] })}>Ajouter une condition</AddItemButton>
          {depth < MAX_FILTER_DEPTH && (
            <AddItemButton
              icon={<FolderSimplePlusIcon aria-hidden />}
              onClick={() =>
                onChange({
                  ...group,
                  children: [...group.children, { type: 'group', id: nodeId(), combinator: group.combinator === 'and' ? 'or' : 'and', children: [newConditionFor(fields, fields.first)] }],
                })
              }
            >
              Ajouter un groupe
            </AddItemButton>
          )}
          {onRemove && (
            <ActionButton priority="secondary" danger size="compact-sm" icon={<TrashIcon aria-hidden />} onClick={onRemove}>
              Retirer le groupe
            </ActionButton>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

/** Options read from other data than the task context: the beneficiaries, the kinds of slots. */
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
