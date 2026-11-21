import { AddItemButton } from '../../../components/actions/AddItemButton';
import { Fieldset, Group, Select, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { EMPTY_ADDRESS, type Address } from '@ordo/shared';

import { COUNTRY_OPTIONS } from '../lib/countries';
import { RemoveButton } from '../../../components/actions/RemoveButton';

interface AddressFieldsProps {
  legend: string;
  value: Address | null;
  onChange: (value: Address | null) => void;
  /** Field errors, keyed by path inside the address ("city", "country"…). */
  errors?: Record<string, string | undefined>;
  /** Called on leaving a field, and once a line is removed or a country chosen: the address is saved then (a panel saved field by field). Optional. */
  onBlur?: () => void;
}

/**
 * Postal address fields in the order of international conventions: up to four street lines, postal code
 * and city, region, country. Empty: no address. `onBlur` tells when the address is complete enough to be saved.
 * @param {AddressFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function AddressFields({ legend, value, onChange, errors = {}, onBlur }: AddressFieldsProps) {
  const address = value ?? EMPTY_ADDRESS;
  /**
   * Changes some fields of the address.
   * @param {Partial<Address>} changes Changes.
   * @returns {void}
   */
  const update = (changes: Partial<Address>) => onChange({ ...address, ...changes });
  /**
   * Changes some fields of the address, then tells it is done (a line removed, a country chosen).
   * @param {Partial<Address>} changes Changes.
   * @returns {void}
   */
  const updateNow = (changes: Partial<Address>) => {
    update(changes);
    onBlur?.();
  };
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
              onBlur={onBlur}
              style={{ flex: 1 }}
            />
            {address.lines.length > 1 && (
              <RemoveButton label="Retirer" mb={4} aria-label={`Retirer la ligne ${index + 1}`} onClick={() => updateNow({ lines: address.lines.filter((_, position) => position !== index) })} />
            )}
          </Group>
        ))}
        {address.lines.length < 4 && <AddItemButton onClick={() => update({ lines: [...address.lines, ''] })}>Ajouter une ligne</AddItemButton>}
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
          <TextInput label="Code postal" value={address.postalCode} onChange={(event) => update({ postalCode: event.currentTarget.value })} onBlur={onBlur} error={errors.postalCode} />
          <TextInput label="Ville" value={address.city} onChange={(event) => update({ city: event.currentTarget.value })} onBlur={onBlur} error={errors.city} />
          <TextInput label="Région / État" description="Si le pays l’utilise" value={address.region} onChange={(event) => update({ region: event.currentTarget.value })} onBlur={onBlur} />
        </SimpleGrid>
        <Select label="Pays" data={COUNTRY_OPTIONS} searchable allowDeselect={false} value={address.country} onChange={(country) => country && updateNow({ country })} error={errors.country} />
      </Stack>
    </Fieldset>
  );
}
