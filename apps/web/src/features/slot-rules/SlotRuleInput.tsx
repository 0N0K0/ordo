import { Select, SimpleGrid, Stack } from '@mantine/core';
import type { SlotRule } from '@ordo/shared';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { useSlotRules } from './use-slot-rules';

const DEFAULT = 'DEFAULT';
const CUSTOM = 'CUSTOM';

interface SlotRuleInputProps {
  /** Rule; null: the default of the workspace. */
  value: SlotRule | null;
  onChange: (value: SlotRule | null) => void;
  /** Error of the kinds. Optional. */
  error?: string;
  /** Read only. Optional. */
  disabled?: boolean;
}

/**
 * Slots a task or a routine is done on (whatever the day): by default of the workspace, or during some kinds of slots
 * and out of others (both empty: anywhere). Kinds of this workspace and those shown from other workspaces.
 * @param {SlotRuleInputProps} props Component props.
 * @returns {JSX.Element} Input.
 */
export function SlotRuleInput({ value, onChange, error, disabled }: SlotRuleInputProps) {
  const { kinds, defaultRule, describe } = useSlotRules();
  const fallback = describe(defaultRule) ?? 'partout';

  /**
   * Options of the kinds, grouped by workspace, without those chosen in the other list.
   * @param {readonly string[]} taken Kinds of the other list.
   * @returns {object[]} Options.
   */
  const groups = (taken: readonly string[]) =>
    [...new Set(kinds.map((kind) => kind.group))].map((group) => ({
      group,
      items: kinds.filter((kind) => kind.group === group && !taken.includes(kind.value)).map(({ value: kind, label }) => ({ value: kind, label })),
    }));

  return (
    <Stack gap="xs">
      <Select
        label="Plages"
        description="Quel que soit le jour."
        data={[
          { value: DEFAULT, label: `Par défaut de l’espace (${fallback.toLowerCase()})` },
          { value: CUSTOM, label: 'Choisies' },
        ]}
        value={value ? CUSTOM : DEFAULT}
        // Chosen: the default of the workspace to start from.
        onChange={(mode) => onChange(mode === CUSTOM ? (value ?? defaultRule) : null)}
        allowDeselect={false}
        disabled={disabled}
      />
      {value && (
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
          <BatchMultiSelect
            label="Pendant"
            description="L’une de ces plages."
            placeholder={value.inside.length ? undefined : 'N’importe quand'}
            data={groups(value.outside)}
            value={value.inside}
            onChange={(inside) => onChange({ ...value, inside })}
            disabled={disabled}
            searchable
            clearable
          />
          <BatchMultiSelect
            label="Hors de"
            description="Aucune de ces plages."
            placeholder={value.outside.length ? undefined : 'Aucune'}
            data={groups(value.inside)}
            value={value.outside}
            onChange={(outside) => onChange({ ...value, outside })}
            error={error}
            disabled={disabled}
            searchable
            clearable
          />
        </SimpleGrid>
      )}
    </Stack>
  );
}
