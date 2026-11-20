import { Group, NumberInput, Select } from '@mantine/core';
import { BIRTH_YEAR_MIN, birthDateText, monthOptions, readBirthDate } from '@ordo/shared';
import { useState } from 'react';
import { LabeledField } from '../inputs/LabeledField';

interface BirthDateFieldProps {
  /** Birth date: `YYYY-MM-DD`, `--MM-DD` without year, or none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Called on leaving a part of the field: the birth date is saved then (a panel saved field by field, decision D22). Optional. */
  onBlur?: () => void;
  error?: string;
}

/** Parts of a birth date being typed (each may be missing). */
interface Parts {
  day: number | '';
  month: string | null;
  year: number | '';
}

/**
 * Parts of a stored birth date.
 * @param {string | null} value Birth date.
 * @returns {Parts} Parts.
 */
function partsOf(value: string | null): Parts {
  const birth = readBirthDate(value);
  return birth ? { day: birth.day, month: String(birth.month), year: birth.year ?? '' } : { day: '', month: null, year: '' };
}

/**
 * Birth date from its parts: none until the day and the month are given; the year optional (`--MM-DD`). A day the month
 * does not have stays as typed (checked by the schema, error below).
 * @param {Parts} parts Parts.
 * @returns {string | null} Birth date.
 */
function valueOf(parts: Parts): string | null {
  if (parts.day === '' || !parts.month) return null;
  const birth = { day: parts.day, month: Number(parts.month), year: parts.year === '' ? null : parts.year };
  return birthDateText(birth);
}

/**
 * « Date de naissance » of a person (lot 16): day, month, and the year when known (the age is shown then). Emptied
 * day or month: none.
 * @param {BirthDateFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function BirthDateField({ value, onChange, onBlur, error }: BirthDateFieldProps) {
  const [parts, setParts] = useState<Parts>(() => partsOf(value));
  // A value changed elsewhere (another tab, an undo) is shown; the parts being typed (their value) are kept otherwise.
  if (valueOf(parts) !== value) setParts(partsOf(value));
  /**
   * Changes a part and the value.
   * @param {Partial<Parts>} change Parts changed.
   * @returns {void}
   */
  const change = (change: Partial<Parts>) => {
    const next = { ...parts, ...change };
    setParts(next);
    onChange(valueOf(next));
  };
  return (
    <LabeledField label="Date de naissance" description="L’année est facultative : connue, l’âge s’affiche." error={error}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <NumberInput aria-label="Jour de naissance" placeholder="Jour" min={1} max={31} w={80} allowDecimal={false} value={parts.day} onChange={(day) => change({ day: day === '' ? '' : Number(day) })} onBlur={onBlur} />
        <Select aria-label="Mois de naissance" placeholder="Mois" data={monthOptions} clearable style={{ flex: 1 }} value={parts.month} onChange={(month) => change({ month })} onBlur={onBlur} />
        <NumberInput aria-label="Année de naissance" placeholder="Année" min={BIRTH_YEAR_MIN} w={100} allowDecimal={false} thousandSeparator="" value={parts.year} onChange={(year) => change({ year: year === '' ? '' : Number(year) })} onBlur={onBlur} />
      </Group>
    </LabeledField>
  );
}
