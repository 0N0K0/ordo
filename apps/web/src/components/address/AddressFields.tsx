import { ActionIcon, Anchor, Fieldset, Group, Select, SimpleGrid, Stack, TextInput, Tooltip } from '@mantine/core';
import { EMPTY_ADDRESS, type Address } from '@ordo/shared';
import { PlusIcon, XIcon } from '@phosphor-icons/react';
import { COUNTRY_OPTIONS } from './countries';

interface AddressFieldsProps {
  legend: string;
  value: Address | null;
  onChange: (value: Address | null) => void;
  /** Field errors, keyed by path inside the address ("city", "country"…). */
  errors?: Record<string, string | undefined>;
}

/**
 * Postal address fields in the order of international conventions: up to four street lines, postal code
 * and city, region, country. Empty: no address.
 * @param {AddressFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function AddressFields({ legend, value, onChange, errors = {} }: AddressFieldsProps) {
  const address = value ?? EMPTY_ADDRESS;
  /**
   * Changes some fields of the address.
   * @param {Partial<Address>} changes Changes.
   * @returns {void}
   */
  const update = (changes: Partial<Address>) => onChange({ ...address, ...changes });
  return (
    <Fieldset legend={legend}>
      <Stack gap="xs">
        {address.lines.map((line, index) => (
          <Group key={index} gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              label={index === 0 ? 'Adresse' : undefined}
              aria-label={`Ligne d’adresse ${index + 1}`}
              placeholder={index === 0 ? 'Numéro et voie' : 'Bâtiment, étage, boîte postale…'}
              value={line}
              onChange={(event) => update({ lines: address.lines.map((item, position) => (position === index ? event.currentTarget.value : item)) })}
              style={{ flex: 1 }}
            />
            {address.lines.length > 1 && (
              <Tooltip label="Retirer la ligne">
                <ActionIcon variant="subtle" color="gray" mb={4} aria-label={`Retirer la ligne ${index + 1}`} onClick={() => update({ lines: address.lines.filter((_, position) => position !== index) })}>
                  <XIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ))}
        {address.lines.length < 4 && (
          <Anchor component="button" type="button" size="xs" onClick={() => update({ lines: [...address.lines, ''] })}>
            <Group gap={4}>
              <PlusIcon aria-hidden /> Ajouter une ligne
            </Group>
          </Anchor>
        )}
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
          <TextInput label="Code postal" value={address.postalCode} onChange={(event) => update({ postalCode: event.currentTarget.value })} error={errors.postalCode} />
          <TextInput label="Ville" value={address.city} onChange={(event) => update({ city: event.currentTarget.value })} error={errors.city} />
          <TextInput label="Région / État" description="Si le pays l’utilise" value={address.region} onChange={(event) => update({ region: event.currentTarget.value })} />
        </SimpleGrid>
        <Select
          label="Pays"
          data={COUNTRY_OPTIONS}
          searchable
          allowDeselect={false}
          value={address.country}
          onChange={(country) => country && update({ country })}
          error={errors.country}
        />
      </Stack>
    </Fieldset>
  );
}
