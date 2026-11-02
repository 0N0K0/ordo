import { ActionIcon, Anchor, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import type { Phone } from '@ordo/shared';
import { PhoneIcon, PlusIcon, XIcon } from '@phosphor-icons/react';

/**
 * Phone numbers with a label each ("Standard", "Mobile"…).
 * @param {{ value: Phone[], onChange: (value: Phone[]) => void }} props Component props.
 * @returns {JSX.Element} Field.
 */
export function PhonesField({ value, onChange }: { value: Phone[]; onChange: (value: Phone[]) => void }) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Téléphones
      </Text>
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
          <Tooltip label="Retirer le numéro">
            <ActionIcon variant="subtle" color="gray" aria-label={`Retirer le numéro ${index + 1}`} onClick={() => onChange(value.filter((_, position) => position !== index))}>
              <XIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
      ))}
      <Anchor component="button" type="button" size="xs" onClick={() => onChange([...value, { label: '', number: '' }])}>
        <Group gap={4}>
          <PlusIcon aria-hidden /> Ajouter un numéro
        </Group>
      </Anchor>
    </Stack>
  );
}
