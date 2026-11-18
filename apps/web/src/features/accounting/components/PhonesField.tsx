import { LabeledField } from '../../../components/inputs/LabeledField';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { Group, TextInput } from '@mantine/core';
import type { Phone } from '@ordo/shared';
import { PhoneIcon } from '@phosphor-icons/react';
import { RemoveButton } from '../../../components/actions/RemoveButton';

/**
 * Phone numbers with a label each ("Standard", "Mobile"…).
 * @param {{ value: Phone[], onChange: (value: Phone[]) => void }} props Component props.
 * @returns {JSX.Element} Field.
 */
export function PhonesField({ value, onChange }: { value: Phone[]; onChange: (value: Phone[]) => void }) {
  return (
    <LabeledField label="Téléphones">
      {value.map((phone, index) => (
        <Group key={index} gap="xs" wrap="nowrap">
          <TextInput
            aria-label={`Libellé du téléphone ${index + 1}`}
            placeholder="Mobile, standard…"
            w={160}
            value={phone.label}
            onChange={(event) => onChange(value.map((item, position) => (position === index ? { ...item, label: event.currentTarget.value } : item)))}
          />
          <TextInput
            aria-label={`Numéro ${index + 1}`}
            placeholder="+33 6 12 34 56 78"
            leftSection={<PhoneIcon aria-hidden />}
            style={{ flex: 1 }}
            value={phone.number}
            onChange={(event) => onChange(value.map((item, position) => (position === index ? { ...item, number: event.currentTarget.value } : item)))}
          />
          <RemoveButton label="Retirer" aria-label={`Retirer le numéro ${index + 1}`} onClick={() => onChange(value.filter((_, position) => position !== index))} />
        </Group>
      ))}
      <AddItemButton onClick={() => onChange([...value, { label: '', number: '' }])}>Ajouter un numéro</AddItemButton>
    </LabeledField>
  );
}
