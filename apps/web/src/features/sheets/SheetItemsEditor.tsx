import { ActionIcon, Autocomplete, Button, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { ChatCircleIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { openFormPanel } from '../../components/panels/panels';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { Comments } from '../comments/Comments';
import { useShoppingData } from '../shopping/api';
import { shoppingCategoryOptions } from '../shopping/shopping-format';
import { blankSheetItem, type SheetItemValues } from './sheet-format';

interface SheetItemsEditorProps {
  items: SheetItemValues[];
  onChange: (items: SheetItemValues[]) => void;
  /** Errors of the fields, by path (« items.0.label »…). Optional. */
  errors?: Record<string, unknown>;
}

/**
 * Items of a sheet: each a product of the references (its category and unit proposed) or a label of its own, with its
 * category of the shopping products, quantity, unit, description and, once saved, its comments.
 * @param {SheetItemsEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function SheetItemsEditor({ items, onChange, errors = {} }: SheetItemsEditorProps) {
  const { data } = useShoppingData();
  const products = data?.shoppingProducts ?? [];
  const baseNames = new Map((data?.shoppingBaseLists ?? []).map((baseList) => [baseList.id, baseList.name]));
  // Names of the products, with their reference when two have the same.
  const counts = new Map<string, number>();
  for (const product of products) counts.set(product.name, (counts.get(product.name) ?? 0) + 1);
  const productLabel = (product: (typeof products)[number]) => ((counts.get(product.name) ?? 0) > 1 ? `${product.name} (${baseNames.get(product.baseListId) ?? ''})` : product.name);
  const byLabel = new Map(products.map((product) => [productLabel(product), product]));
  const units = (data?.shoppingUnits ?? []).map((unit) => unit.name);

  /**
   * Changes one item.
   * @param {number} index Item.
   * @param {Partial<SheetItemValues>} change Changes.
   * @returns {void}
   */
  const change = (index: number, change: Partial<SheetItemValues>) => onChange(items.map((item, position) => (position === index ? { ...item, ...change } : item)));
  const error = (index: number, field: string) => errors[`items.${index}.${field}`] as string | undefined;

  return (
    <Stack gap="xs">
      {items.length === 0 && (
        <Text size="xs" c="dimmed">
          Aucun élément : ajoutez des produits des références ou d’autres éléments.
        </Text>
      )}
      {items.map((item, index) => {
        const product = item.productId ? products.find((other) => other.id === item.productId) : undefined;
        return (
          <Paper key={item.id ?? `new-${index}`} withBorder radius="sm" p="xs">
            <Stack gap={6}>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Autocomplete
                  size="xs"
                  style={{ flex: 1 }}
                  aria-label={`Libellé de l’élément ${index + 1}`}
                  placeholder="Produit des références, ou autre élément"
                  data={[...byLabel.keys()]}
                  value={product && product.name === item.label ? productLabel(product) : item.label}
                  onChange={(value) => {
                    const chosen = byLabel.get(value);
                    // A product of the references: its category and unit, unless chosen already.
                    if (chosen) change(index, { productId: chosen.id, label: chosen.name, categoryId: item.categoryId ?? chosen.categoryId ?? null, unit: item.unit ?? chosen.unit ?? null });
                    else change(index, { productId: null, label: value });
                  }}
                  error={error(index, 'label')}
                  comboboxProps={{ withinPortal: true }}
                />
                {item.id && (
                  <Tooltip label="Commentaires">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Commentaires de ${item.label || 'l’élément'}`}
                      onClick={() => openFormPanel(`Commentaires · ${item.label}`, () => <Comments target="SHEET_ITEM" id={item.id!} />)}
                    >
                      <ChatCircleIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label="Retirer l’élément">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Retirer ${item.label || 'l’élément'}`} onClick={() => onChange(items.filter((_, position) => position !== index))}>
                    <XIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
                <Select
                  size="xs"
                  aria-label={`Catégorie de l’élément ${index + 1}`}
                  placeholder="Catégorie"
                  clearable
                  searchable
                  {...treeSelectProps(shoppingCategoryOptions(data?.shoppingCategories ?? []))}
                  value={item.categoryId}
                  onChange={(categoryId) => change(index, { categoryId })}
                  comboboxProps={{ withinPortal: true }}
                />
                <NumberInput
                  size="xs"
                  aria-label={`Quantité de l’élément ${index + 1}`}
                  placeholder="Quantité"
                  min={0}
                  decimalScale={3}
                  decimalSeparator=","
                  allowNegative={false}
                  value={item.quantity ?? ''}
                  onChange={(value) => change(index, { quantity: typeof value === 'number' ? value : null })}
                  error={error(index, 'quantity')}
                />
                <Autocomplete
                  size="xs"
                  aria-label={`Unité de l’élément ${index + 1}`}
                  placeholder="Unité"
                  data={units}
                  value={item.unit ?? ''}
                  onChange={(unit) => change(index, { unit: unit || null })}
                  comboboxProps={{ withinPortal: true }}
                />
              </SimpleGrid>
              <Textarea
                size="xs"
                aria-label={`Description de l’élément ${index + 1}`}
                placeholder="Description"
                autosize
                minRows={1}
                maxRows={6}
                value={item.note ?? ''}
                onChange={(event) => change(index, { note: event.currentTarget.value || null })}
              />
            </Stack>
          </Paper>
        );
      })}
      <div>
        <Button size="xs" variant="default" leftSection={<PlusIcon aria-hidden />} onClick={() => onChange([...items, blankSheetItem()])}>
          Ajouter un élément
        </Button>
      </div>
    </Stack>
  );
}
