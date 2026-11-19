import { LabeledField } from '../../../components/inputs/LabeledField';
import { Text } from '@mantine/core';
import { conditionReferences, SLOT_CONDITION_FIELD_OPERATORS, SLOT_CONDITION_FIELDS, slotConditionSchema, type FilterOperator, type SlotCondition, type SlotConditionField } from '@ordo/shared';
import { FieldsFilterBuilder, type FilterFields } from '../../../components/filters/FilterBuilder';
import { emptySlotCondition } from '../lib/slot-condition-text';
import { useSlotChoices } from '../hooks/use-slot-sources';

const OPERATOR_LABELS: Record<SlotConditionField, Record<string, string>> = {
  schedules: { in: 'sur l’un des créneaux', notIn: 'hors des créneaux' },
  kinds: { in: 'sur l’un des types', notIn: 'hors des types' },
  freeTime: { isEmpty: 'hors de tous les créneaux', notIn: 'hors de tous les créneaux sauf' },
};

/** What the condition does, by item (shown under the label). */
const EFFECTS = {
  routine: 'Les moments ne sont gardés que sur les heures que la condition permet ; un jour sans aucune heure n’est pas une occurrence.',
  task: 'La tâche n’est faisable que sur les heures que la condition permet.',
} as const;

/**
 * When a task or a routine (or one of its cases) is done relative to the calendar schedules: on or out of some
 * schedules (« Créneau ») or of the schedules of some kinds (« Type de créneau », those created later too), of this
 * workspace or of another one of the user (« Sport · Perso »), or on the free time, combined in groups with ET / OU, as
 * the filters of the tables (« ((déjeuner ou dîner) et garde alternée) ou hors sommeil »). Empty: any time.
 * @param {{ value: SlotCondition | null, onChange: (value: SlotCondition | null) => void, item: 'routine' | 'task' }} props Condition, its change, and the item it is for (what the condition does).
 * @returns {JSX.Element} Builder.
 */
export function SlotConditionBuilder({ value, onChange, item }: { value: SlotCondition | null; onChange: (value: SlotCondition | null) => void; item: keyof typeof EFFECTS }) {
  // Archived schedules and kinds are no longer offered, but those of the condition stay.
  const choices = useSlotChoices(conditionReferences(value));
  const fields: FilterFields<SlotConditionField> = {
    kinds: SLOT_CONDITION_FIELDS,
    labels: { schedules: 'Créneau', kinds: 'Type de créneau', freeTime: 'Temps libre' },
    groups: [{ group: 'Agenda', fields: ['schedules', 'kinds', 'freeTime'] }],
    first: 'schedules',
    options: (field) => ({ data: choices[field] }),
    isComplete: (condition) => slotConditionSchema.safeParse({ type: 'group', id: 'root', combinator: 'and', children: [condition] }).success,
    operatorLabel: (field, operator) => OPERATOR_LABELS[field][operator],
    operators: (field) => SLOT_CONDITION_FIELD_OPERATORS[field] as readonly FilterOperator[],
    emptyText: 'Aucune condition : à n’importe quelle heure.',
  };
  return (
    <LabeledField label="Créneaux de l’agenda">
      <Text size="xs" c="dimmed">
        Facultatif : sur ou hors de certains créneaux, ou de tous les créneaux de certains types (même ceux ajoutés ensuite), de cet espace ou de vos autres
        espaces, ou sur le temps libre (hors de tous les créneaux de cet espace, sauf certains), combinés en groupes (ET, OU). {EFFECTS[item]}
      </Text>
      <FieldsFilterBuilder filter={value ?? emptySlotCondition()} fields={fields} onChange={(next) => onChange(next.children.length ? next : null)} />
    </LabeledField>
  );
}
