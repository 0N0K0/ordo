import { Switch } from '@mantine/core';

interface ShowArchivedSwitchProps {
  /** Archived elements shown. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Number of archived elements; none (0): the switch is not shown. Optional. Default = shown. */
  count?: number;
  /** Label, instead of « Afficher les archivés » (« Afficher les archivées »). Optional. */
  label?: string;
}

/**
 * « Afficher les archivés » switch of a list, a table, a board: the archived elements are hidden until it is on. Not
 * shown when there is no archived element (with `count`).
 * @param {ShowArchivedSwitchProps} props Component props.
 * @returns {JSX.Element | null} Switch.
 */
export function ShowArchivedSwitch({ checked, onChange, count, label = 'Afficher les archivés' }: ShowArchivedSwitchProps) {
  if (count === 0) return null;
  return <Switch size="sm" label={label} checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />;
}
