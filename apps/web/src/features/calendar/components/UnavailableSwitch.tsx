import { Switch } from '@mantine/core';

/** What « Indisponible » does, told under the switch. */
export const UNAVAILABLE_DESCRIPTION =
  'Rien n’est programmé pendant ses horaires dans cet espace : pas de moment de routine (rappels reportés à la fin), pas de tâche faisable ; un évènement posé dessus est signalé.';

interface UnavailableSwitchProps {
  checked: boolean;
  onChange: (unavailable: boolean) => void;
  /** Disabled (read only). Optional. Default = false. */
  disabled?: boolean;
  /** Size. Optional. Default = Mantine's. */
  size?: 'xs' | 'sm';
  /** Description. Optional. Default = what it does (`UNAVAILABLE_DESCRIPTION`). */
  description?: string;
}

/**
 * « Indisponible » switch of a kind of schedules, of a schedule without kind, or of a subscription to a kind of
 * another workspace (each workspace decides for itself), with what it does.
 * @param {UnavailableSwitchProps} props Component props.
 * @returns {JSX.Element} Switch.
 */
export function UnavailableSwitch({ checked, onChange, disabled = false, size, description = UNAVAILABLE_DESCRIPTION }: UnavailableSwitchProps) {
  return (
    <Switch
      size={size}
      label="Indisponible"
      description={description}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}
