import { Group, NumberInput, Select } from '@mantine/core';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

interface OpensOnInputProps {
  frequency: 'MONTHLY' | 'YEARLY';
  /** "DD" (monthly), "MM-DD" (yearly) or null: on the due date only. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * « À partir du »: day of the period an occurrence can be done from (a day of the month for a monthly routine, of the
 * year for a yearly one); empty: on its due date only.
 * @param {OpensOnInputProps} props Component props.
 * @returns {JSX.Element} Input.
 */
export function OpensOnInput({ frequency, value, onChange, error }: OpensOnInputProps) {
  const description = 'Facultatif : la routine est à faire dès ce jour de la période, jusqu’à son échéance.';
  if (frequency === 'MONTHLY') {
    const day = value && /^\d{2}$/.test(value) ? Number(value) : '';
    return (
      <NumberInput
        label="À partir du"
        description={description}
        placeholder="Jour du mois"
        min={1}
        max={31}
        allowDecimal={false}
        value={day}
        onChange={(next) => onChange(next === '' ? null : pad(Number(next)))}
        error={error}
      />
    );
  }
  const [month, day] = value && /^\d{2}-\d{2}$/.test(value) ? value.split('-').map(Number) : [null, null];
  return (
    <Group gap="sm" align="flex-start" grow>
      <NumberInput
        label="À partir du"
        description={description}
        placeholder="Jour"
        min={1}
        max={31}
        allowDecimal={false}
        value={day ?? ''}
        onChange={(next) => onChange(next === '' ? null : `${pad(month ?? 1)}-${pad(Number(next))}`)}
        error={error}
      />
      <Select
        label="Mois"
        description=" "
        placeholder="Mois"
        data={MONTHS.map((label, index) => ({ value: pad(index + 1), label }))}
        value={month ? pad(month) : null}
        onChange={(next) => onChange(next ? `${next}-${pad(day ?? 1)}` : null)}
        clearable
      />
    </Group>
  );
}
