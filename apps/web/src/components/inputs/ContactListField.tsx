import { LabeledField } from './LabeledField';
import { AddItemButton } from '../actions/AddItemButton';
import { Group, TextInput } from '@mantine/core';
import type { LabelledEmail, Phone } from '@ordo/shared';
import { EnvelopeSimpleIcon, PhoneIcon, type Icon } from '@phosphor-icons/react';
import { RemoveButton } from '../actions/RemoveButton';

/** Lists of ways to reach a person or an organization, by kind: what an entry holds. */
interface ContactEntries {
  phones: Phone;
  emails: LabelledEmail;
}
/** Kind of list: phone numbers or email addresses. */
type ContactListKind = keyof ContactEntries;

/** Words, placeholders and icon of each kind of list. */
const KINDS: { [K in ContactListKind]: { label: string; key: Exclude<keyof ContactEntries[K], 'label'>; labelOf: string; labelPlaceholder: string; valueName: string; valuePlaceholder: string; type?: string; icon: Icon; add: string; removeName: string } } = {
  phones: {
    label: 'Téléphones',
    key: 'number',
    labelOf: 'Libellé du téléphone',
    labelPlaceholder: 'Mobile, standard…',
    valueName: 'Numéro',
    valuePlaceholder: '+33 6 12 34 56 78',
    icon: PhoneIcon,
    add: 'Ajouter un numéro',
    removeName: 'Retirer le numéro',
  },
  emails: {
    label: 'Adresses mail',
    key: 'address',
    labelOf: 'Libellé de l’adresse mail',
    labelPlaceholder: 'Personnelle, travail…',
    valueName: 'Adresse mail',
    valuePlaceholder: 'paul@exemple.fr',
    type: 'email',
    icon: EnvelopeSimpleIcon,
    add: 'Ajouter une adresse',
    removeName: 'Retirer l’adresse',
  },
};

interface ContactListFieldProps<K extends ContactListKind> {
  /** Phone numbers (`{ label, number }`) or email addresses (`{ label, address }`). */
  kind: K;
  value: ContactEntries[K][];
  onChange: (value: ContactEntries[K][]) => void;
  /** Field errors, keyed by path inside the list ("0.number", "0.address"…). Optional. */
  errors?: Record<string, string | undefined>;
  /** Called on leaving a field, and once an entry is removed: the list is saved then (a panel saved field by field). Optional. */
  onBlur?: () => void;
}

/**
 * A labelled list of ways to reach a person or an organization, the same for every kind: phone numbers
 * (« Téléphones ») or email addresses (« Adresses mail »), a label each (« Mobile », « Travail »…), added and removed
 * one by one, the error of each under it.
 * @template {ContactListKind} K
 * @param {ContactListFieldProps<K>} props Component props.
 * @returns {JSX.Element} Field.
 */
export function ContactListField<K extends ContactListKind>({ kind, value, onChange, errors = {}, onBlur }: ContactListFieldProps<K>) {
  const words = KINDS[kind];
  const key = words.key as string;
  const ValueIcon = words.icon;
  /**
   * Changes a part of an entry.
   * @param {number} index Entry.
   * @param {string} part `label`, or the key of the value.
   * @param {string} text New text.
   * @returns {void}
   */
  const change = (index: number, part: string, text: string) => onChange(value.map((item, position) => (position === index ? { ...item, [part]: text } : item)));
  return (
    <LabeledField label={words.label}>
      {value.map((entry, index) => (
        <Group key={index} gap="xs" wrap="nowrap" align="flex-start">
          <TextInput
            aria-label={`${words.labelOf} ${index + 1}`}
            placeholder={words.labelPlaceholder}
            w={160}
            value={entry.label}
            onChange={(event) => change(index, 'label', event.currentTarget.value)}
            onBlur={onBlur}
            error={errors[`${index}.label`]}
          />
          <TextInput
            aria-label={`${words.valueName} ${index + 1}`}
            placeholder={words.valuePlaceholder}
            type={words.type}
            leftSection={<ValueIcon aria-hidden />}
            style={{ flex: 1 }}
            value={(entry as unknown as Record<string, string>)[key]}
            onChange={(event) => change(index, key, event.currentTarget.value)}
            onBlur={onBlur}
            error={errors[`${index}.${key}`]}
          />
          <RemoveButton
            label="Retirer"
            aria-label={`${words.removeName} ${index + 1}`}
            onClick={() => {
              onChange(value.filter((_, position) => position !== index));
              onBlur?.();
            }}
          />
        </Group>
      ))}
      <AddItemButton onClick={() => onChange([...value, { label: '', [key]: '' } as unknown as ContactEntries[K]])}>{words.add}</AddItemButton>
    </LabeledField>
  );
}
