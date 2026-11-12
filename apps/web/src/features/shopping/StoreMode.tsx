import { Alert, Badge, Checkbox, CloseButton, ColorSwatch, Group, Modal, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { CaretDownIcon, CaretRightIcon, ShoppingCartIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { notifyError } from '../../lib/notify';
import { useShoppingData, useShoppingMutations, type ShoppingItem, type ShoppingList } from './api';
import { NO_GROUP, quantityText, shoppingRows, visibleRows } from './shopping-format';
import classes from './Shopping.module.css';

interface HeadingProps {
  name: string;
  color: string | null;
  /** Items left to buy in it. */
  count: number;
  /** 0 for a store, 1 and more for its categories. */
  depth: number;
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Heading of a store or of a category, folding its items; its badge tells how many are left to buy.
 * @param {HeadingProps} props Component props.
 * @returns {JSX.Element} Heading.
 */
function Heading({ name, color, count, depth, collapsed, onToggle }: HeadingProps) {
  return (
    <UnstyledButton
      className={classes.storeHeading}
      data-depth={depth}
      onClick={onToggle}
      aria-expanded={!collapsed}
      style={{ paddingLeft: `calc(${Math.max(0, depth - 1)} * var(--mantine-spacing-md))` }}
    >
      <Group gap="xs" wrap="nowrap">
        {collapsed ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
        {color && <ColorSwatch color={color} size={depth === 0 ? 14 : 12} />}
        <Text fw={depth <= 1 ? 700 : 600} size={depth === 0 ? 'lg' : 'sm'} tt={depth === 0 ? undefined : 'uppercase'} c={depth === 0 ? undefined : 'dimmed'} style={{ flex: 1 }}>
          {name}
        </Text>
        <Badge size={depth === 0 ? 'lg' : 'md'} variant={count ? 'filled' : 'light'} color={count ? undefined : 'green'} aria-label={`${count} à acheter`}>
          {count}
        </Badge>
      </Group>
    </UnstyledButton>
  );
}

/**
 * Store mode: the items to buy as big rows ticked with a thumb, by store then by category (as their tree), each store
 * and category folded or not with the number of items left to buy; the bought ones at the bottom.
 * @param {{ list: ShoppingList, onClose: () => void }} props Component props.
 * @param {ShoppingList} props.list List.
 * @param {() => void} props.onClose Leaves the store mode.
 * @returns {JSX.Element} Full screen view.
 */
export function StoreMode({ list, onClose }: { list: ShoppingList; onClose: () => void }) {
  const { data } = useShoppingData();
  const { setPurchased } = useShoppingMutations();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const stores = [...(data?.shoppingStores ?? [])].sort((a, b) => a.position - b.position);
  const known = new Set(stores.map((store) => store.id));
  const items = [...list.items].sort((a, b) => a.position - b.position);
  const toBuy = items.filter((item) => !item.purchasedAt);
  const bought = items.filter((item) => item.purchasedAt);
  const sections = [
    ...stores.map((store) => ({ key: store.id, name: store.name, color: store.color as string | null, items: toBuy.filter((item) => item.storeId === store.id) })),
    { key: NO_GROUP, name: 'Sans magasin', color: null, items: toBuy.filter((item) => !item.storeId || !known.has(item.storeId)) },
  ].filter((section) => section.items.length > 0);

  /**
   * Folds or unfolds a store or a category.
   * @param {string} key Key of the store, or "store:category".
   * @returns {void}
   */
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  /**
   * One item, ticked or unticked by a tap anywhere on its row.
   * @param {ShoppingItem} item Item.
   * @param {number} [depth=0] Indent. Optional.
   * @returns {JSX.Element} Row.
   */
  const row = (item: ShoppingItem, depth = 0) => (
    <Checkbox.Card
      key={item.id}
      className={classes.storeRow}
      data-purchased={item.purchasedAt ? true : undefined}
      checked={Boolean(item.purchasedAt)}
      onClick={() => setPurchased.mutate({ id: item.id, purchased: !item.purchasedAt }, { onError: (error) => notifyError(error.message) })}
      style={{ marginLeft: `calc(${depth} * var(--mantine-spacing-md))` }}
    >
      <Checkbox.Indicator size="lg" />
      <Text className={classes.storeName}>{item.name}</Text>
      {quantityText(item) && (
        <Text size="md" fw={600} className={classes.nowrap}>
          {quantityText(item)}
        </Text>
      )}
    </Checkbox.Card>
  );

  /**
   * Categories (as their tree) and items of a store.
   * @param {string} storeKey Store key.
   * @param {ShoppingItem[]} storeItems Items to buy there.
   * @returns {ReactNode[]} Headings and rows.
   */
  const categories = (storeKey: string, storeItems: ShoppingItem[]): ReactNode[] => {
    const prefix = `${storeKey}:`;
    const folded = new Set([...collapsed].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)));
    const rows = shoppingRows(storeItems, 'category', { categories: data?.shoppingCategories ?? [], stores: [] });
    return visibleRows(rows, folded).map((entry) =>
      entry.kind === 'group' ? (
        <Heading
          key={`${prefix}${entry.id ?? NO_GROUP}`}
          name={entry.name}
          color={entry.color}
          count={entry.items.length}
          depth={entry.depth + 1}
          collapsed={folded.has(entry.id ?? NO_GROUP)}
          onToggle={() => toggle(`${prefix}${entry.id ?? NO_GROUP}`)}
        />
      ) : (
        row(entry.item, entry.depth - 1)
      ),
    );
  };

  return (
    <Modal opened onClose={onClose} fullScreen withCloseButton={false} transitionProps={{ transition: 'fade', duration: 150 }}>
      <Stack gap="md" className={classes.storeList}>
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={0}>
            <Title order={2} size="h3">
              {list.name}
            </Title>
            <Text size="sm" c="dimmed">
              {toBuy.length} à acheter · {bought.length} sur {list.items.length} acheté(s)
            </Text>
          </Stack>
          <CloseButton size="lg" aria-label="Quitter le mode magasin" onClick={onClose} />
        </Group>
        {toBuy.length === 0 && (
          <Alert color="green" icon={<ShoppingCartIcon aria-hidden />}>
            Tout est acheté.
          </Alert>
        )}
        {sections.map((section) => (
          <Stack key={section.key} gap="xs">
            <Heading name={section.name} color={section.color} count={section.items.length} depth={0} collapsed={collapsed.has(section.key)} onToggle={() => toggle(section.key)} />
            {!collapsed.has(section.key) && categories(section.key, section.items)}
          </Stack>
        ))}
        {bought.length > 0 && (
          <Stack gap="xs">
            <UnstyledButton className={classes.storeHeading} data-depth={0} onClick={() => toggle('bought')} aria-expanded={!collapsed.has('bought')}>
              <Group gap="xs" wrap="nowrap">
                {collapsed.has('bought') ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
                <Text fw={700} size="lg" c="dimmed" style={{ flex: 1 }}>
                  Acheté
                </Text>
                <Badge size="lg" variant="light" color="gray">
                  {bought.length}
                </Badge>
              </Group>
            </UnstyledButton>
            {!collapsed.has('bought') && bought.map((item) => row(item))}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
