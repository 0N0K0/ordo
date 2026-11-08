import { ActionIcon, Combobox, Group, InputBase, Loader, Menu, Text, Tooltip, useCombobox, type InputBaseProps } from '@mantine/core';
import type { GeoPoint } from '@ordo/shared';
import { HouseIcon, MapPinIcon, MapPinLineIcon } from '@phosphor-icons/react';
import { useAddressSearch, usePlaces } from './api';

/** Address typed or chosen: its text, and its point when chosen from a place or a search. */
export interface AddressValue {
  text: string;
  point: GeoPoint | null;
}

interface AddressInputProps extends Omit<InputBaseProps, 'value' | 'onChange'> {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  placeholder?: string;
  /** Saved places offered first (off for the places themselves). */
  withPlaces?: boolean;
  /** Proposals in a portal (off inside a popover, which a click outside closes). */
  withinPortal?: boolean;
}

/**
 * Address field: free text (a room, a video call…) or, as it is typed, saved places then addresses of OpenStreetMap
 * to choose, which give it its point on the map; the saved places are also listed by a button of the field. Typing
 * again forgets the point.
 * @param {AddressInputProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function AddressInput({ value, onChange, placeholder, withPlaces = true, withinPortal = true, ...props }: AddressInputProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const { data: places } = usePlaces();
  const near = withPlaces && places?.length ? { lat: places[0].lat, lon: places[0].lon } : null;
  const search = useAddressSearch(value.point ? '' : value.text, near);
  const needle = value.text.trim().toLocaleLowerCase('fr');
  // Typed text filters the places; a chosen address shows them all, to change it.
  const placeOptions = withPlaces ? (places ?? []).filter((place) => value.point || !needle || `${place.name} ${place.address}`.toLocaleLowerCase('fr').includes(needle)).slice(0, 8) : [];
  const suggestions = value.point ? [] : (search.data ?? []);

  /**
   * Chooses a saved place: its name and address, and its point.
   * @param {string} id Place.
   * @returns {void}
   */
  const choosePlace = (id: string) => {
    const place = places?.find((item) => item.id === id);
    if (place) onChange({ text: place.address ? `${place.name}, ${place.address}` : place.name, point: { lat: place.lat, lon: place.lon } });
  };

  /**
   * Chooses a place or an address: its text and point.
   * @param {string} key "place:<id>" or "address:<index>".
   * @returns {void}
   */
  const choose = (key: string) => {
    const [kind, id] = key.split(':');
    if (kind === 'place') choosePlace(id);
    else {
      const suggestion = suggestions[Number(id)];
      if (suggestion) onChange({ text: suggestion.label, point: { lat: suggestion.lat, lon: suggestion.lon } });
    }
    combobox.closeDropdown();
  };

  const empty = placeOptions.length === 0 && suggestions.length === 0;
  return (
    <Combobox store={combobox} onOptionSubmit={choose} withinPortal={withinPortal}>
      <Combobox.Target>
        <InputBase
          {...props}
          placeholder={placeholder}
          value={value.text}
          leftSection={value.point ? <MapPinIcon weight="fill" aria-label="Adresse située sur la carte" /> : <MapPinLineIcon aria-hidden />}
          rightSection={
            search.isFetching ? (
              <Loader size={14} />
            ) : withPlaces && places?.length ? (
              <Menu position="bottom-end" withinPortal={withinPortal}>
                <Menu.Target>
                  <Tooltip label="Lieux enregistrés">
                    <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Choisir un lieu enregistré">
                      <HouseIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Lieux enregistrés</Menu.Label>
                  {places.map((place) => (
                    <Menu.Item key={place.id} leftSection={<HouseIcon aria-hidden />} onClick={() => choosePlace(place.id)}>
                      <Text size="sm">{place.name}</Text>
                      {place.address && (
                        <Text size="xs" c="dimmed">
                          {place.address}
                        </Text>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            ) : undefined
          }
          rightSectionPointerEvents="all"
          onChange={(event) => {
            onChange({ text: event.currentTarget.value, point: null });
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>
      <Combobox.Dropdown hidden={empty}>
        <Combobox.Options>
          {placeOptions.length > 0 && (
            <Combobox.Group label="Lieux enregistrés">
              {placeOptions.map((place) => (
                <Combobox.Option key={place.id} value={`place:${place.id}`}>
                  <Group gap="xs" wrap="nowrap">
                    <HouseIcon aria-hidden />
                    <div>
                      <Text size="sm">{place.name}</Text>
                      {place.address && (
                        <Text size="xs" c="dimmed">
                          {place.address}
                        </Text>
                      )}
                    </div>
                  </Group>
                </Combobox.Option>
              ))}
            </Combobox.Group>
          )}
          {suggestions.length > 0 && (
            <Combobox.Group label="Adresses (OpenStreetMap)">
              {suggestions.map((suggestion, index) => (
                <Combobox.Option key={suggestion.label} value={`address:${index}`}>
                  <Group gap="xs" wrap="nowrap">
                    <MapPinIcon aria-hidden />
                    <Text size="sm">{suggestion.label}</Text>
                  </Group>
                </Combobox.Option>
              ))}
            </Combobox.Group>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
