import { Paper, Stack, Text } from '@mantine/core';
import { placeSchema, type GeoPoint } from '@ordo/shared';
import { useRef, type CSSProperties } from 'react';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import type { SettingsItemValues } from '../../../components/settings/SettingsItemForm';
import { notifyError } from '../../../lib/notify';
import { useFillHeight } from '../../../lib/fill-height';
import { AddressInput } from './AddressInput';
import { reverseAddress, usePlaceMutations, usePlaces, type Place } from '../api';
import { PlaceMap } from './PlaceMap';
import classes from './PlacesManager.module.css';

/** Address of a place in its form: its text and its point (none for a zone, which has the point of its place). */
interface PlaceAddressValues {
  address: string;
  lat: number | null;
  lon: number | null;
}

/**
 * Saved places ("Maison", "Bureau"…), as every settings list: on a map and in a tree. A place has one address (found
 * by its search, or picked with a click on the map, its address then looked up) and possibly several zones without
 * an address of their own (kitchen, bathroom… for the cleaning): they take the point of their place. Each one has a
 * name, a color and an image; places are reordered, zones put under another place or zone, by drag and drop (a place
 * never becomes a zone, nor a zone a place). They locate events and routines and are the starts and ends of their
 * travel times.
 * @returns {JSX.Element} Section.
 */
export function PlacesManager() {
  const { data: places, isPending } = usePlaces();
  const { save, remove, move } = usePlaceMutations();
  // As tall as the window leaves, no more.
  const [fillRef, fillHeight] = useFillHeight(400);
  const adderRef = useRef<((values: Partial<SettingsItemValues<PlaceAddressValues>>) => void) | null>(null);

  /**
   * Opens the form of a new place at the point clicked on the map, its address looked up.
   * @param {GeoPoint} point Point clicked.
   * @returns {Promise<void>}
   */
  const pick = async (point: GeoPoint) => {
    const fallback = `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
    try {
      const found = await reverseAddress(point);
      adderRef.current?.({ name: found?.name ?? '', address: found?.label ?? fallback, lat: point.lat, lon: point.lon, parentId: null });
    } catch (error) {
      notifyError((error as Error).message);
      adderRef.current?.({ address: fallback, lat: point.lat, lon: point.lon, parentId: null });
    }
  };

  /**
   * Input of a place (its address and point) or of a zone (its place) from the form values.
   * @param {SettingsItemValues<PlaceAddressValues>} values Values.
   * @returns {object} Input.
   */
  const input = (values: SettingsItemValues<PlaceAddressValues>) =>
    values.parentId ? { name: values.name, parentId: values.parentId } : { name: values.name, address: values.address, lat: values.lat, lon: values.lon };

  // The zones share the point of their place.
  const points = (places ?? []).filter((place) => !place.parentId).map((place) => ({ id: place.id, label: place.name, lat: place.lat, lon: place.lon }));

  return (
    <div ref={fillRef} className={classes.root} style={{ '--fill-height': fillHeight ? `${fillHeight}px` : undefined } as CSSProperties}>
      <div className={classes.body}>
        <Paper withBorder radius="md" className={classes.map}>
          <PlaceMap points={points} onPick={(point) => void pick(point)} height="100%" />
        </Paper>
        <div className={classes.side}>
          <SettingsList<Place, PlaceAddressValues>
            kind="PLACE"
            nested
            withParent={false}
            colorRequired={false}
            title="Lieux"
            description={
              <Stack gap={4} component="span">
                <span>Vos adresses habituelles (maison, bureau…) : proposées pour le lieu des évènements et des routines, et pour calculer les temps de trajet.</span>
                <Text span size="sm" c="dimmed">
                  Un lieu a une adresse (cherchée, ou d’un clic sur la carte) et peut avoir des zones, sans adresse (cuisine, salle de bain… pour le ménage), qui prennent son point.
                </Text>
              </Stack>
            }
            noun="le lieu"
            items={places ?? []}
            loading={isPending}
            storageKey="places"
            schema={placeSchema}
            adderRef={adderRef}
            extra={{
              initial: (place) => ({ address: place && !place.parentId ? place.address : '', lat: place && !place.parentId ? place.lat : null, lon: place && !place.parentId ? place.lon : null }),
              render: (form) => {
                const values = form.getValues();
                // A zone has no address: the one of its place.
                if (values.parentId) return null;
                return (
                  <AddressInput
                    label="Adresse"
                    required
                    placeholder="Adresse, ou un clic sur la carte"
                    withPlaces={false}
                    error={form.errors.address}
                    value={{ text: values.address, point: values.lat !== null && values.lon !== null ? { lat: values.lat, lon: values.lon } : null }}
                    onChange={(next) => form.setValues({ address: next.text, lat: next.point?.lat ?? null, lon: next.point?.lon ?? null })}
                  />
                );
              },
            }}
            create={async (values) => createdId(await save.mutateAsync({ id: null, input: input(values) }))}
            update={(id, values) => save.mutateAsync({ id, input: input(values) })}
            remove={(id) => remove.mutateAsync(id)}
            move={(id, parentId, index) => move.mutateAsync({ id, parentId, index })}
            // A place keeps its address, a zone has none: a place stays at the top, a zone under a place.
            canMove={(place, parentId) => (place.parentId === null) === (parentId === null)}
            renderBadges={(place) =>
              !place.parentId && (
                <Text size="xs" c="dimmed" truncate>
                  {place.address}
                </Text>
              )
            }
            deleteMessage={(place, path) => (
              <>
                {place.parentId ? 'La zone' : 'Le lieu'} « {path} » sera supprimé{place.parentId ? 'e' : ''} définitivement avec ses zones ; les évènements et routines gardent leur lieu en texte ; il
                ne sera plus proposé. Cette action est irréversible.
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
}
