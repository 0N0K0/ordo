import { stockLocationSchema } from '@ordo/shared';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useStockLocations, useStockMutations } from '../api';

/**
 * Places of the stock, in a tree (in the settings of the inventory).
 * @param {{ usage: Map<string, number> }} props Number of items of each place.
 * @returns {JSX.Element} Manager.
 */
export function StockLocations({ usage }: { usage: Map<string, number> }) {
  const { data: locations } = useStockLocations();
  const { createLocation, updateLocation, moveLocation, deleteLocation } = useStockMutations();
  /**
   * Input of a place from the form values.
   * @param {{ name: string, color: string, parentId: string | null }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null }) => ({ name: values.name, color: values.color || null, parentId: values.parentId });
  return (
    <SettingsList
      kind="STOCK_LOCATION"
      nested
      title="Emplacements"
      description="Où sont rangés les articles, en arborescence (Cuisine › Frigo) : glissez un emplacement sur un autre pour l’y ranger."
      noun="l’emplacement"
      items={locations ?? []}
      usage={usage}
      usageNoun="articles"
      storageKey="ordo.stock.locations"
      schema={stockLocationSchema}
      create={async (values) => createdId(await createLocation.mutateAsync(input(values)))}
      update={(id, values) => updateLocation.mutateAsync({ id, input: input(values) })}
      remove={(id) => deleteLocation.mutateAsync(id)}
      move={(id, parentId, index) => moveLocation.mutateAsync({ id, parentId, index })}
    />
  );
}
