import { useLocationItems } from '../hooks/use-location-select';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useStockLocations, useStockMutations } from '../api';

/**
 * Places of the stock, in a tree (in the settings of the inventory).
 * @param {{ usage: Map<string, number> }} props Number of items of each place.
 * @returns {JSX.Element} Manager.
 */
export function StockLocations({ usage }: { usage: Map<string, number> }) {
  const { data: locations } = useStockLocations();
  const { moveLocation, deleteLocation } = useStockMutations();
  const definition = useLocationItems();
  return (
    <SettingsList
      {...definition}
      nested
      title="Emplacements"
      description="Où sont rangés les articles, en arborescence (Cuisine › Frigo) : glissez un emplacement sur un autre pour l’y ranger."
      noun="l’emplacement"
      items={locations ?? []}
      usage={usage}
      usageNoun={{ one: 'de l’article', many: 'articles' }}
      storageKey="ordo.stock.locations"
      remove={(id) => deleteLocation.mutateAsync(id)}
      move={(id, parentId, index) => moveLocation.mutateAsync({ id, parentId, index })}
    />
  );
}
