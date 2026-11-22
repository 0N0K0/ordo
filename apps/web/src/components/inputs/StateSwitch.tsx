import { Switch, type MantineColor, type MantineSize } from '@mantine/core';
import type { ReactNode } from 'react';
import { ActionTooltip } from '../actions/ActionTooltip';

interface StateSwitchProps {
  /** What it tells when on (« Lait manque », « Favori », « Traité ») or the mode it turns on (« Modifier les créneaux »): its name. */
  label: string;
  /** The name shown beside the switch, not only read by screen readers. Optional. Default = false (hidden). */
  showLabel?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Tooltip: what it is, what a click does, why it is disabled. Optional. Default = none. */
  hint?: ReactNode;
  /** Color when on. Optional. Default = the primary color. */
  color?: MantineColor;
  /** Icon in its thumb when on (a check, a star). Optional. */
  icon?: ReactNode;
  /** Optional. Default = « sm ». */
  size?: MantineSize;
  /** Optional. Default = false. */
  disabled?: boolean;
}

/**
 * Switch of a setting or a mode, outside table cells and list rows (a yes / no there is a `StateButton`): an item turned
 * on / off (an alarm), a favourite in a page header, a mail treated in its toolbar, an edit mode; its name hidden unless
 * told (`showLabel`), its tooltip shown on a disabled switch too.
 * @param {StateSwitchProps} props Component props.
 * @returns {JSX.Element} Switch.
 */
export function StateSwitch({ label, showLabel = false, checked, onChange, hint, color, icon, size = 'sm', disabled = false }: StateSwitchProps) {
  const control = (
    <Switch
      size={size}
      color={color}
      label={showLabel ? label : undefined}
      aria-label={showLabel ? undefined : label}
      checked={checked}
      disabled={disabled}
      thumbIcon={checked ? icon : undefined}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
  if (!hint) return control;
  // A wrapper: the tooltip shows on a disabled switch too.
  return (
    <ActionTooltip label={hint} wrapped>
      {control}
    </ActionTooltip>
  );
}
