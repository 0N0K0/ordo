import { LabeledField } from './LabeledField';
import { AddItemButton } from '../actions/AddItemButton';
import { Group, TextInput } from '@mantine/core';
import type { Phone } from '@ordo/shared';
import { PhoneIcon } from '@phosphor-icons/react';
import { RemoveButton } from '../actions/RemoveButton';

interface PhonesFieldProps {
  value: Phone[];
  onChange: (value: Phone[]) => void;
  /** Field errors, keyed by path inside the list ("0.number"…). Optional. */
  errors?: Record<string, string | undefined>;
  /** Called on leaving a field, and once a number is removed: the phones are saved then (a panel saved field by field, decision D22). Optional. */
  onBlur?: () => void;
}

/**
 * Phone numbers with a label each ("Standard", "Mobile"…), the error of each under it.
 * @param {PhonesFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function PhonesField({ value, onChange, errors = {}, onBlur }: PhonesFieldProps) {
  return (
    <LabeledField label="Téléphones">
      {value.map((phone, index) => (
        <Group key={index} gap="xs" wrap="nowrap" align="flex-start">
          <TextInput
            aria-label={`Libellé du téléphone ${index + 1}`}
            placeholder="Mobile, standard…"
            w={160}
            value={phone.label}
            onChange={(event) => onChange(value.map((item, position) => (position === index ? { ...item, label: event.currentTarget.value } : item)))}
            onBlur={onBlur}
            error={errors[`${index}.label`]}
          />
          <TextInput
            aria-label={`Numéro ${index + 1}`}
            placeholder="+33 6 12 34 56 78"
            leftSection={<PhoneIcon aria-hidden />}
            style={{ flex: 1 }}
            value={phone.number}
            onChange={(event) => onChange(value.map((item, position) => (position === index ? { ...item, number: event.currentTarget.value } : item)))}
            onBlur={onBlur}
            error={errors[`${index}.number`]}
          />
          <RemoveButton
            label="Retirer"
            aria-label={`Retirer le numéro ${index + 1}`}
            onClick={() => {
              onChange(value.filter((_, position) => position !== index));
              onBlur?.();
            }}
          />
        </Group>
      ))}
      <AddItemButton onClick={() => onChange([...value, { label: '', number: '' }])}>Ajouter un numéro</AddItemButton>
    </LabeledField>
  );
}
