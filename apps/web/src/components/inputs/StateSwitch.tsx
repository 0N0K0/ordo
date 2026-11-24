import { Switch, type MantineColor, type MantineSize } from '@mantine/core';
import type { ReactNode } from 'react';
import { ActionTooltip } from '../actions/ActionTooltip';

interface StateSwitchProps {
  /** What it tells when on (« Alarme active », « Abonné ») or the mode it turns on (« Modifier les créneaux »): its name. */
  label: string;
  /** The name shown beside the switch, not only read by screen readers. Optional. Default = false (hidden). */
  showLabel?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Tooltip: what it is, what a click does, why it is disabled. Optional. Default = none. */
  hint?: ReactNode;
  /** Color when on. Optional. Default = the primary color. */
  color?: MantineColor;
  /** Icon in its thumb when on (a check). Optional. */
  icon?: ReactNode;
  /** Optional. Default = « sm ». */
  size?: MantineSize;
  /** Optional. Default = false. */
  disabled?: boolean;
}

/**
 * Switch of a setting or a mode (a state of the data, even in a page header or a toolbar, is a `StateButton`: done,
 * treated, favourite…): an item turned on / off (an alarm, a subscription), an edit mode; its name hidden unless told
 * (`showLabel`), its tooltip shown on a disabled switch too.
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
