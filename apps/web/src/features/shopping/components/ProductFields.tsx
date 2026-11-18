import type { SelectProps } from '@mantine/core';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { categoryOptions } from '../../../components/tree/category-tree';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { unarchived, unarchivedOffered } from '../../../lib/archive';
import { useDefaultColor } from '../../workspace/hooks/use-default-color';
import { useShoppingData, useShoppingMutations } from '../api';
import { categoriesForBaseList, unitOptions } from '../lib/shopping-format';

interface UnitFieldProps extends Omit<SelectProps, 'data' | 'value' | 'onChange'> {
  /** Unit chosen (its name); none: null or ''. */
  value: string | null;
  onChange: (unit: string | null) => void;
  /** Unit saved, offered even when archived or no longer in the settings. Optional. */
  current?: string | null;
}

/**
 * Unit of a product (shopping, stock): one of the units of the shopping settings, the archived ones left out but the
 * current one; a unit typed that is not among them is added to the settings.
 * @param {UnitFieldProps} props Component props (and Select props).
 * @returns {JSX.Element} Field.
 */
export function UnitField({ value, onChange, current, ...props }: UnitFieldProps) {
  const { data } = useShoppingData();
  const { createUnit } = useShoppingMutations();
  const color = useDefaultColor();
  return (
    <CreatableSelect
      label="Unité"
      description="Tapez une unité absente pour l’ajouter aux paramètres des achats."
      placeholder="Aucune"
      // A unit is kept by its name.
      onCreate={async (name) => {
        await createUnit.mutateAsync({ name, color });
        return name;
      }}
      data={unitOptions(unarchived(data?.shoppingUnits ?? []), current)}
      searchable
      clearable
      {...props}
      value={value || null}
      onChange={(unit) => onChange(unit || null)}
    />
  );
}

interface ShoppingCategoryFieldProps extends Omit<SelectProps, 'data' | 'value' | 'onChange'> {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  /** Category saved, offered even when archived. Optional. */
  current?: string | null;
  /** Base list of a product: only its categories are offered. Optional. */
  baseListId?: string | null;
}

/**
 * Shopping category of a product (shopping, stock), in its tree: the archived ones left out but the current one; a
 * category typed that is not among them is added to the settings (at the top level).
 * @param {ShoppingCategoryFieldProps} props Component props (and Select props).
 * @returns {JSX.Element} Field.
 */
export function ShoppingCategoryField({ value, onChange, current, baseListId, ...props }: ShoppingCategoryFieldProps) {
  const { data } = useShoppingData();
  const { createCategory } = useShoppingMutations();
  const color = useDefaultColor();
  const categories = data?.shoppingCategories ?? [];
  return (
    <CreatableSelect
      label="Catégorie"
      placeholder="Aucune"
      clearable
      searchable
      onCreate={(name) => createCategory.mutateAsync({ name, color, parentId: null })}
      {...treeSelectProps(categoryOptions(baseListId ? categoriesForBaseList(categories, baseListId) : categories, undefined, unarchivedOffered(categories, current)))}
      {...props}
      value={value}
      onChange={(categoryId) => onChange(categoryId)}
    />
  );
}
