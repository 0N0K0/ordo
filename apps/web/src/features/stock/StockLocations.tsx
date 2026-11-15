import { Button, ColorInput, Group, Select, Stack, TextInput } from '@mantine/core';
import { stockLocationSchema } from '@ordo/shared';
import { CategoryTreeManager } from '../../components/category-tree/CategoryTreeManager';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useStockLocations, useStockMutations, type StockLocation } from './api';
import { locationOptions } from './stock-format';

/**
 * Place of the stock: its name, color and parent.
 * @param {{ locations: StockLocation[], location?: StockLocation, parentId?: string | null, onDone: () => void }} props Places, the one edited (none: a new one), its parent, and what follows.
 * @returns {JSX.Element} Form.
 */
function LocationForm({ locations, location, parentId = null, onDone }: { locations: StockLocation[]; location?: StockLocation; parentId?: string | null; onDone: () => void }) {
  const { createLocation, updateLocation } = useStockMutations();
  const swatches = useColorSwatches();
  const form = useAppForm<{ name: string; color: string; parentId: string | null }>({
    initialValues: { name: location?.name ?? '', color: location?.color ?? '', parentId: location ? (location.parentId ?? null) : parentId },
    schema: stockLocationSchema,
  });
  const handleSubmit = form.onSubmit((values) => {
    const input = { ...values, color: values.color || null };
    const callbacks = { onSuccess: () => (notifySuccess(location ? 'Emplacement modifié.' : 'Emplacement créé.'), onDone()), onError: (error: Error) => showFormError(form, error) };
    if (location) updateLocation.mutate({ id: location.id, input }, callbacks);
    else createLocation.mutate(input, callbacks);
  });
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus placeholder="Frigo, Congélateur, Cellier, Garage…" {...form.getInputProps('name')} />
        <ColorInput label="Couleur" format="hex" swatches={swatches} swatchesPerRow={9} placeholder="Celle de l’emplacement parent" {...form.getInputProps('color')} />
        <Select
          label="Emplacement parent"
          placeholder="Aucun (emplacement principal)"
          clearable
          searchable
          {...treeSelectProps(locationOptions(locations, location?.id))}
          {...form.getInputProps('parentId')}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createLocation.isPending || updateLocation.isPending}>
            {location ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Places of the stock, in a tree (in the settings of the inventory).
 * @param {{ usage: Map<string, number> }} props Number of items of each place.
 * @returns {JSX.Element} Manager.
 */
export function StockLocations({ usage }: { usage: Map<string, number> }) {
  const { data: locations } = useStockLocations();
  const { moveLocation, deleteLocation } = useStockMutations();
  return (
    <CategoryTreeManager
      title="Emplacements"
      description="Où sont rangés les articles, en arborescence (Cuisine › Frigo) : glissez un emplacement sur un autre pour l’y ranger."
      categories={locations ?? []}
      usage={usage}
      usageNoun="article(s)"
      storageKey="ordo.stock.locations"
      renderForm={(props) => <LocationForm locations={locations ?? []} {...props} />}
      onMove={(id, parentId, index) => moveLocation.mutate({ id, parentId, index }, { onError: (error) => notifyError(error.message) })}
      onDelete={(id) => deleteLocation.mutate(id, { onSuccess: () => notifySuccess('Emplacement supprimé.'), onError: (error) => notifyError(error.message) })}
    />
  );
}
