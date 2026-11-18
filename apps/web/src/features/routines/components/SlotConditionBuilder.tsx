import { LabeledField } from '../../../components/inputs/LabeledField';
import { scheduleChoices } from '../../calendar/lib/schedule-choices';
import { Text } from '@mantine/core';
import { conditionScheduleIds, SLOT_CONDITION_FIELD_OPERATORS, SLOT_CONDITION_FIELDS, slotConditionSchema, type FilterOperator, type SlotCondition, type SlotConditionField } from '@ordo/shared';
import { useWorkSchedules } from '../../calendar/api';
import { FieldsFilterBuilder, type FilterFields } from '../../../components/filters/FilterBuilder';
import { emptySlotCondition } from '../lib/slot-condition-text';

const OPERATOR_LABELS: Record<SlotConditionField, Record<string, string>> = {
  schedules: { in: 'sur l’une des plages', notIn: 'hors des plages' },
  freeTime: { isEmpty: 'hors de toutes les plages', notIn: 'hors de toutes les plages sauf' },
};

/**
 * When a routine (or one of its cases) is done relative to the calendar schedules: on or out of some of them,
 * combined in groups with ET / OU, as the filters of the tables (« ((déjeuner ou dîner) et garde alternée) ou hors
 * sommeil »). Empty: any time.
 * @param {{ value: SlotCondition | null, onChange: (value: SlotCondition | null) => void }} props Condition and its change.
 * @returns {JSX.Element} Builder.
 */
export function SlotConditionBuilder({ value, onChange }: { value: SlotCondition | null; onChange: (value: SlotCondition | null) => void }) {
  const { data: schedules } = useWorkSchedules();
  const fields: FilterFields<SlotConditionField> = {
    kinds: SLOT_CONDITION_FIELDS,
    labels: { schedules: 'Plages', freeTime: 'Temps libre' },
    groups: [{ group: 'Agenda', fields: ['schedules', 'freeTime'] }],
    first: 'schedules',
    // Archived schedules are no longer offered, but those of the condition stay.
    options: () => ({ data: scheduleChoices(schedules, conditionScheduleIds(value)).options }),
    isComplete: (condition) => slotConditionSchema.safeParse({ type: 'group', id: 'root', combinator: 'and', children: [condition] }).success,
    operatorLabel: (field, operator) => OPERATOR_LABELS[field][operator],
    operators: (field) => SLOT_CONDITION_FIELD_OPERATORS[field] as readonly FilterOperator[],
    emptyText: 'Aucune condition : à n’importe quelle heure.',
  };
  return (
    <LabeledField label="Plages de l’agenda">
      <Text size="xs" c="dimmed">
        Facultatif : sur ou hors de certaines plages, ou sur le temps libre (hors de toutes les plages, sauf certaines), combinées en groupes (ET, OU). Les moments ne sont gardés que sur les heures
        que la condition permet ; un jour sans aucune heure n’est pas une occurrence.
      </Text>
      <FieldsFilterBuilder filter={value ?? emptySlotCondition()} fields={fields} onChange={(next) => onChange(next.children.length ? next : null)} />
    </LabeledField>
  );
}
