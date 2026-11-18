import { mapById, normalize } from '@ordo/shared';
import { ActionIcon, Checkbox, Combobox, Group, InputBase, Loader, Menu, ScrollArea, Stack, Text, Tooltip, useCombobox, type InputBaseProps } from '@mantine/core';
import { ItemAvatar } from '../../../components/settings/ItemAvatar';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import type { GeoPoint } from '@ordo/shared';
import { CheckIcon, HouseIcon, MapPinIcon, MapPinLineIcon } from '@phosphor-icons/react';
import { placesInTree, rootPlace, useAddressSearch, usePlaces, zonesOfText, zonesText } from '../api';

/** Height of the lists of places and addresses at most (they scroll beyond). */
const LIST_HEIGHT = 320;

/**
 * Text of a location on a place: its name and its address.
 * @param {{ name: string, address: string }} place Place.
 * @returns {string} Text.
 */
const placeText = (place: { name: string; address: string }) => (place.address ? `${place.name}, ${place.address}` : place.name);

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
 * to choose, which give it its point on the map; the saved places are also listed by a button of the field. Several
 * zones of a same place can be ticked (« Maison › Cuisine, Salle de bain »), with the point of the place. Typing again
 * forgets the point.
 * @param {AddressInputProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function AddressInput({ value, onChange, placeholder, withPlaces = true, withinPortal = true, ...props }: AddressInputProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const { data: places } = usePlaces();
  const first = (places ?? []).find((place) => !place.archived);
  const near = withPlaces && first ? { lat: first.lat, lon: first.lon } : null;
  const search = useAddressSearch(value.point ? '' : value.text, near);
  const needle = normalize(value.text.trim());
  // Typed text filters the places; a chosen address shows them all, to change it.
  // As their tree: each place followed by its zones (a room of the house…).
  const tree = placesInTree(places ?? []);
  const suggestions = value.point ? [] : (search.data ?? []);
  // Zones of a place the location is on (several can be ticked).
  const chosen = value.point && places ? zonesOfText(value.text, places) : null;
  // Place chosen (or the place of the zones chosen), its zones ticked under the field.
  const chosenPlace = chosen?.root ?? (value.point ? (places ?? []).find((place) => !place.parentId && value.text === placeText(place)) : undefined);
  const byId = mapById(places ?? []);
  // Archived places (and the zones of an archived place) are no longer offered, but those chosen stay.
  const kept = new Set([chosenPlace?.id, ...(chosen?.zoneIds ?? [])]);
  const usable = (place: (typeof tree)[number]) => kept.has(place.id) || (!place.archived && !rootPlace(place, byId).archived);
  const placeOptions = withPlaces ? tree.filter((place) => usable(place) && (value.point || !needle || normalize(`${place.path} ${place.address}`).includes(needle))) : [];
  const placeZones = chosenPlace ? tree.filter((place) => place.parentId && rootPlace(place, byId).id === chosenPlace.id && usable(place)) : [];

  /**
   * Ticks the zones of the place chosen: their text, with the point of the place (none: the place itself).
   * @param {string[]} ids Zones ticked.
   * @returns {void}
   */
  const setZones = (ids: string[]) => {
    if (!chosenPlace) return;
    const zones = tree.filter((item) => ids.includes(item.id));
    const point = { lat: chosenPlace.lat, lon: chosenPlace.lon };
    onChange(zones.length ? { text: zonesText(chosenPlace, zones), point } : { text: placeText(chosenPlace), point });
  };

  /**
   * Chooses a saved place (its name and address, and its point), or ticks or unticks one of its zones: the zones
   * ticked of a same place, with its point.
   * @param {string} id Place or zone.
   * @returns {void}
   */
  const choosePlace = (id: string) => {
    const place = places?.find((item) => item.id === id);
    if (!place || !places) return;
    const point = { lat: place.lat, lon: place.lon };
    if (!place.parentId) {
      onChange({ text: placeText(place), point });
      return;
    }
    const root = rootPlace(place, mapById(places));
    const before = chosen && chosen.root.id === root.id ? chosen.zoneIds : [];
    const ids = before.includes(id) ? before.filter((other) => other !== id) : [...before, id];
    // In the order of the tree; none left: the place itself.
    const zones = tree.filter((item) => ids.includes(item.id));
    onChange(zones.length ? { text: zonesText(root, zones), point } : { text: placeText(root), point });
  };

  /**
   * Whether a zone is ticked.
   * @param {string} id Zone.
   * @returns {boolean} Ticked.
   */
  const ticked = (id: string) => chosen?.zoneIds.includes(id) ?? false;

  /**
   * Chooses a place or an address: its text and point.
   * @param {string} key "place:<id>" or "address:<index>".
   * @returns {void}
   */
  const choose = (key: string) => {
    const [kind, id] = key.split(':');
    if (kind === 'place') {
      choosePlace(id);
      // A zone ticked: the list stays open to tick others.
      if (places?.find((item) => item.id === id)?.parentId) return;
    } else {
      const suggestion = suggestions[Number(id)];
      if (suggestion) onChange({ text: suggestion.label, point: { lat: suggestion.lat, lon: suggestion.lon } });
    }
    combobox.closeDropdown();
  };

  const empty = placeOptions.length === 0 && suggestions.length === 0;
  return (
    <Stack gap={6}>
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
                    {/* A long list scrolls in the menu. */}
                    <ScrollArea.Autosize mah={LIST_HEIGHT} type="auto" offsetScrollbars>
                      {tree.map((place) => (
                        <Menu.Item
                          key={place.id}
                          leftSection={<ItemAvatar name={place.name} iconUrl={place.iconUrl} color={place.color} />}
                          rightSection={place.parentId && ticked(place.id) ? <CheckIcon aria-label="Zone choisie" /> : undefined}
                          // A zone ticked: the menu stays open to tick others.
                          closeMenuOnClick={!place.parentId}
                          aria-checked={place.parentId ? ticked(place.id) : undefined}
                          onClick={() => choosePlace(place.id)}
                          style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${place.depth} * var(--mantine-spacing-md))` }}
                        >
                          <Text size="sm">{place.name}</Text>
                          {place.address && !place.parentId && (
                            <Text size="xs" c="dimmed">
                              {place.address}
                            </Text>
                          )}
                        </Menu.Item>
                      ))}
                    </ScrollArea.Autosize>
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
            {/* A long list scrolls in the dropdown. */}
            <ScrollArea.Autosize mah={LIST_HEIGHT} type="auto" offsetScrollbars>
              {placeOptions.length > 0 && (
                <Combobox.Group label="Lieux enregistrés">
                  {placeOptions.map((place) => (
                    <Combobox.Option
                      key={place.id}
                      value={`place:${place.id}`}
                      active={ticked(place.id)}
                      aria-selected={place.parentId ? ticked(place.id) : undefined}
                      style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${needle && !value.point ? 0 : place.depth} * var(--mantine-spacing-md))` }}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <ItemAvatar name={place.name} iconUrl={place.iconUrl} color={place.color} />
                        <div>
                          {/* Searched: the full name of a zone; listed: its name under its place. */}
                          <Text size="sm">{needle && !value.point ? place.path : place.name}</Text>
                          {place.address && !place.parentId && (
                            <Text size="xs" c="dimmed">
                              {place.address}
                            </Text>
                          )}
                        </div>
                        {place.parentId && ticked(place.id) && <CheckIcon aria-label="Zone choisie" style={{ marginInlineStart: 'auto', flexShrink: 0 }} />}
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
            </ScrollArea.Autosize>
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
      {/* A place with zones: its zones ticked here, several at once (« Maison › Cuisine, Salle de bain »). */}
      {withPlaces && placeZones.length > 0 && chosenPlace && (
        <Checkbox.Group label={`Zones de ${chosenPlace.name}`} description="Facultatif : une ou plusieurs ; aucune, le lieu entier." value={chosen?.zoneIds ?? []} onChange={setZones}>
          {/* One under the other, 5 at most (else 4 and « X de plus »), each by its full path. */}
          <Stack mt={4} gap={0}>
            <StackedValues gap={4}>
              {placeZones.map((zone) => (
                <Checkbox
                  key={zone.id}
                  size="xs"
                  value={zone.id}
                  label={
                    <Group gap={6} wrap="nowrap" component="span">
                      <ItemAvatar name={zone.name} iconUrl={zone.iconUrl} color={zone.color} size={14} />
                      {zone.path}
                    </Group>
                  }
                />
              ))}
            </StackedValues>
          </Stack>
        </Checkbox.Group>
      )}
    </Stack>
  );
}
