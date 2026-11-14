import { ActionIcon, Button, Group, Paper, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import type { GeoPoint } from '@ordo/shared';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../../components/dialogs/DestructiveActions';
import { AddressInput, type AddressValue } from './AddressInput';
import { reverseAddress, usePlaceMutations, usePlaces, type Place } from './api';
import { PlaceMap } from './PlaceMap';

const EMPTY: AddressValue = { text: '', point: null };

/**
 * Address of a saved place, to change: saved once a new address is chosen (typed text alone is not).
 * @param {{ place: Place, onSave: (value: { text: string, point: GeoPoint }) => void }} props Place and handler.
 * @returns {JSX.Element} Field.
 */
function PlaceAddress({ place, onSave }: { place: Place; onSave: (value: { text: string; point: GeoPoint }) => void }) {
  const [value, setValue] = useState<AddressValue>({ text: place.address, point: { lat: place.lat, lon: place.lon } });
  return (
    <AddressInput
      size="xs"
      style={{ flex: 1 }}
      aria-label={`Adresse de ${place.name}`}
      withPlaces={false}
      value={value}
      error={!value.point ? 'Choisissez une adresse proposée.' : undefined}
      onChange={(next) => {
        setValue(next);
        if (next.point) onSave({ text: next.text, point: next.point });
      }}
    />
  );
}

/**
 * Saved places ("Maison", "Bureau"…): on a map and in a list. A new one is found by its address, or picked with a
 * click on the map (its address then looked up); a saved one is renamed in place, or moved likewise. They locate
 * events and are the starts and ends of their travel times.
 * @returns {JSX.Element} Section.
 */
export function PlacesManager() {
  const { data: places } = usePlaces();
  const { save, remove } = usePlaceMutations();
  const [name, setName] = useState('');
  const [address, setAddress] = useState<AddressValue>(EMPTY);
  const [deleting, setDeleting] = useState<Place | null>(null);
  const onError = (error: Error) => notifyError(error.message);

  /**
   * Picks the point of the new place on the map, its address looked up.
   * @param {GeoPoint} point Point clicked.
   * @returns {Promise<void>}
   */
  const pick = async (point: GeoPoint) => {
    setAddress({ text: 'Recherche de l’adresse…', point });
    try {
      const found = await reverseAddress(point);
      setAddress({ text: found?.label ?? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`, point });
      if (!name.trim() && found?.name) setName(found.name);
    } catch (error) {
      setAddress({ text: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`, point });
      onError(error as Error);
    }
  };

  const points = [
    ...(places ?? []).map((place) => ({ id: place.id, label: place.name, lat: place.lat, lon: place.lon })),
    ...(address.point ? [{ id: 'new', label: name || 'Nouveau lieu', ...address.point, active: true }] : []),
  ];

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Lieux</Text>
        <Text size="xs" c="dimmed">
          Vos adresses habituelles (maison, bureau…) : proposées pour le lieu des évènements et pour calculer les temps de trajet. Cliquez sur la carte pour placer un nouveau lieu.
        </Text>
        <PlaceMap points={points} onPick={(point) => void pick(point)} />
        {(places ?? []).map((place) =>
          deleting?.id === place.id ? (
            <Paper key={place.id} withBorder p="xs" radius="sm">
              <Stack gap="xs">
                <Text size="sm">Supprimer le lieu « {place.name} » ? Les évènements gardent leur adresse ; il ne sera plus proposé.</Text>
                <DestructiveActions
                  loading={remove.isPending}
                  onCancel={() => setDeleting(null)}
                  onConfirm={() => remove.mutate(place.id, { onSuccess: () => (notifySuccess('Lieu supprimé.'), setDeleting(null)), onError })}
                />
              </Stack>
            </Paper>
          ) : (
            <Group key={place.id} gap="xs" wrap="nowrap" align="flex-start">
              <TextInput
                size="xs"
                w={160}
                aria-label="Nom du lieu"
                defaultValue={place.name}
                onBlur={(event) =>
                  event.currentTarget.value.trim() &&
                  event.currentTarget.value !== place.name &&
                  save.mutate({ id: place.id, input: { name: event.currentTarget.value, address: place.address, lat: place.lat, lon: place.lon } }, { onError })
                }
              />
              <PlaceAddress
                key={`${place.lat},${place.lon},${place.address}`}
                place={place}
                onSave={(value) => save.mutate({ id: place.id, input: { name: place.name, address: value.text, ...value.point } }, { onError })}
              />
              <Tooltip label="Supprimer">
                <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${place.name}`} onClick={() => setDeleting(place)}>
                  <TrashIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          ),
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !address.point) return;
            save.mutate(
              { id: null, input: { name: name.trim(), address: address.text, ...address.point } },
              {
                onSuccess: () => {
                  setName('');
                  setAddress(EMPTY);
                },
                onError,
              },
            );
          }}
        >
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <TextInput size="xs" w={160} aria-label="Nom du nouveau lieu" placeholder="Maison, bureau…" value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <AddressInput size="xs" style={{ flex: 1 }} aria-label="Adresse du nouveau lieu" placeholder="Adresse, ou un clic sur la carte" withPlaces={false} value={address} onChange={setAddress} />
            <Button type="submit" size="xs" variant="default" leftSection={<PlusIcon aria-hidden />} disabled={!name.trim() || !address.point} loading={save.isPending}>
              Ajouter
            </Button>
          </Group>
        </form>
      </Stack>
    </Paper>
  );
}
