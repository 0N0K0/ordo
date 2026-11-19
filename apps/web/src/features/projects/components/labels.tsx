import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { listSelectProps } from '../../../components/items/item-look';
import { byPosition } from '@ordo/shared';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { itemCreator } from '../../../components/settings/create-settings-item';
import type { ProjectCategory, ProjectStatus } from '../api';
import { useProjectCategoryItems, useProjectStatusItems } from '../hooks/use-label-items';

interface CategoriesInputProps {
  categories: ProjectCategory[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

/**
 * Project categories multi-select, with on-the-fly creation (the settings form, in the side panel).
 * @param {CategoriesInputProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function CategoriesInput({ categories, value, onChange, error }: CategoriesInputProps) {
  const categoryItems = useProjectCategoryItems();
  return (
    <BatchMultiSelect
      label="Catégories"
      placeholder={value.length ? undefined : 'Aucune'}
      {...listSelectProps(categories, undefined, value)}
      value={value}
      onChange={onChange}
      onCreate={itemCreator('Nouvelle catégorie', categoryItems)}
      error={error}
      searchable
      clearable
    />
  );
}

interface StatusInputProps {
  statuses: ProjectStatus[];
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

/**
 * Project status select, with on-the-fly creation (the settings form, in the side panel).
 * @param {StatusInputProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function StatusInput({ statuses, value, onChange, error }: StatusInputProps) {
  const statusItems = useProjectStatusItems();
  const current = statuses.find((status) => status.id === value);
  return (
    <CreatableSelect
      label="Statut"
      placeholder="Aucun"
      {...listSelectProps([...statuses].sort(byPosition), undefined, value)}
      leftSection={current ? <ItemAvatar name={current.label} iconUrl={current.iconUrl} color={current.color} /> : undefined}
      value={value}
      onChange={onChange}
      onCreate={itemCreator('Nouveau statut', statusItems)}
      error={error}
      clearable
    />
  );
}
