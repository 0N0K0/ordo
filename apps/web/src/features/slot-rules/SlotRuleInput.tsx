import { Group, Select } from '@mantine/core';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import type { SlotMode, SlotRule } from '@ordo/shared';
import { useSlotRules } from './use-slot-rules';

const DEFAULT = 'DEFAULT';

interface SlotRuleInputProps {
  /** Rule; null: the default of the workspace. */
  value: SlotRule | null;
  onChange: (value: SlotRule | null) => void;
  /** Error of the kinds (none chosen). Optional. */
  error?: string;
  /** Read only. Optional. */
  disabled?: boolean;
}

/**
 * Where a task or a routine is done: by default of the workspace, anywhere, on the slots of some kinds or out of them
 * (whatever the day). Kinds of this workspace and those shown from other workspaces.
 * @param {SlotRuleInputProps} props Component props.
 * @returns {JSX.Element} Input.
 */
export function SlotRuleInput({ value, onChange, error, disabled }: SlotRuleInputProps) {
  const { kinds, defaultRule, describe } = useSlotRules();
  const fallback = describe(defaultRule) ?? 'partout';
  const groups = [...new Set(kinds.map((kind) => kind.group))].map((group) => ({
    group,
    items: kinds.filter((kind) => kind.group === group).map(({ value: kind, label }) => ({ value: kind, label })),
  }));

  /**
   * Applies a mode, keeping the kinds already chosen (else the working hours).
   * @param {string | null} mode Mode, or DEFAULT.
   * @returns {void}
   */
  const changeMode = (mode: string | null) => {
    if (!mode || mode === DEFAULT) return onChange(null);
    if (mode === 'ANY') return onChange({ mode: 'ANY', kinds: [] });
    onChange({ mode: mode as SlotMode, kinds: value?.kinds.length ? value.kinds : defaultRule.kinds.length ? defaultRule.kinds : [kinds[0]?.value].filter(Boolean) });
  };

  return (
    <Group gap="sm" align="flex-start" grow>
      <Select
        label="Plages"
        description="Quel que soit le jour."
        data={[
          { value: DEFAULT, label: `Par défaut de l’espace (${fallback.toLowerCase()})` },
          { value: 'ANY', label: 'Partout' },
          { value: 'INSIDE', label: 'Sur les plages…' },
          { value: 'OUTSIDE', label: 'Hors des plages…' },
        ]}
        value={value?.mode ?? DEFAULT}
        onChange={changeMode}
        allowDeselect={false}
        disabled={disabled}
      />
      {value && value.mode !== 'ANY' && (
        <BatchMultiSelect
          label="Types de plages"
          data={groups}
          value={value.kinds}
          onChange={(selected) => onChange({ mode: value.mode, kinds: selected })}
          error={error}
          placeholder={value.kinds.length ? undefined : 'Choisir'}
          disabled={disabled}
          searchable
        />
      )}
    </Group>
  );
}
