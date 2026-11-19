import { formCallbacks } from '../../../lib/form';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { plural } from '../../../lib/text';
import { byPosition } from '@ordo/shared';
import { Anchor, Badge, Button, Checkbox, CloseButton, Group, Modal, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { ArrowSquareOutIcon, PackageIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { onMutationError } from '../../../lib/notify';
import { useStockMutations } from '../../stock/api';
import { useStockProposal } from '../../stock/hooks/use-stock-proposal';
import { deliveryWindow } from '../lib/delivery-format';
import { useShoppingData, useShoppingMutations, type ShoppingItem, type ShoppingList } from '../api';
import { NO_GROUP, shoppingRows, visibleRows } from '../lib/shopping-format';
import * as fmt from '../../../lib/format';
import classes from './Shopping.module.css';
import { FoldChevron } from '../../../components/actions/FoldChevron';
import { Caption } from '../../../components/page/Caption';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';

interface HeadingProps {
  name: string;
  color: string | null;
  /** Image of the store or of the category. Optional. */
  iconUrl?: string | null;
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
function Heading({ name, color, iconUrl, count, depth, collapsed, onToggle }: HeadingProps) {
  return (
    <UnstyledButton
      className={classes.storeHeading}
      data-depth={depth}
      onClick={onToggle}
      aria-expanded={!collapsed}
      style={{ paddingLeft: `calc(${Math.max(0, depth - 1)} * var(--mantine-spacing-md))` }}
    >
      <Group gap="xs" wrap="nowrap">
        <FoldChevron expanded={!collapsed} />
        {(color || iconUrl) && <ItemAvatar name={name} iconUrl={iconUrl} color={color} size={depth === 0 ? 20 : 16} />}
        {depth === 0 ? (
          <Text fw={700} size="lg" style={{ flex: 1 }}>
            {name}
          </Text>
        ) : (
          <Caption fw={depth <= 1 ? 700 : 600} size="sm" style={{ flex: 1 }}>
            {name}
          </Caption>
        )}
        <Badge size={depth === 0 ? 'lg' : 'md'} variant={count ? 'filled' : 'light'} color={count ? undefined : 'green'} aria-label={`${count} à acheter`}>
          {count}
        </Badge>
      </Group>
    </UnstyledButton>
  );
}

/**
 * Collect mode: the items to get as big rows ticked with a thumb: those of the deliveries of a remote order (each
 * received in a tap), then by store and by category (as their tree), each folded or not with the number of items left;
 * the bought ones at the bottom.
 * @param {{ list: ShoppingList, onClose: () => void }} props Component props.
 * @param {ShoppingList} props.list List.
 * @param {() => void} props.onClose Leaves the collect mode.
 * @returns {JSX.Element} Full screen view.
 */
export function StoreMode({ list, onClose }: { list: ShoppingList; onClose: () => void }) {
  const { data } = useShoppingData();
  const { setPurchased } = useShoppingMutations();
  const { setDeliveryReceived } = useStockMutations();
  const propose = useStockProposal();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // Stores come in their order (by position).
  const stores = data?.shoppingStores ?? [];
  const known = new Set(stores.map((store) => store.id));
  const items = [...list.items].sort(byPosition);
  const toBuy = items.filter((item) => !item.purchasedAt);
  const bought = items.filter((item) => item.purchasedAt);
  // A remote order: its deliveries first (to receive), then what is bought in stores.
  const deliveries = list.remote ? list.deliveries : [];
  const delivered = new Set(deliveries.map((delivery) => delivery.id));
  const inStores = toBuy.filter((item) => !item.deliveryId || !delivered.has(item.deliveryId));
  const deliverySections = deliveries.map((delivery) => ({ delivery, items: toBuy.filter((item) => item.deliveryId === delivery.id) })).filter((section) => section.items.length > 0);
  const sections = [
    ...stores.map((store) => ({ key: store.id, label: store.label, color: store.color as string | null, iconUrl: store.iconUrl, items: inStores.filter((item) => item.storeId === store.id) })),
    { key: NO_GROUP, label: 'Sans magasin', color: null, items: inStores.filter((item) => !item.storeId || !known.has(item.storeId)) },
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
      onClick={() => {
        const purchased = !item.purchasedAt;
        setPurchased.mutate({ id: item.id, purchased }, { onSuccess: () => purchased && propose([item]), onError: onMutationError });
      }}
      style={{ marginLeft: `calc(${depth} * var(--mantine-spacing-md))` }}
    >
      <Checkbox.Indicator size="lg" />
      <Text className={classes.storeName}>{item.label}</Text>
      {fmt.quantity(item) && (
        <Text size="md" fw={600} className={classes.nowrap}>
          {fmt.quantity(item)}
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
          name={entry.label}
          color={entry.color}
          iconUrl={data?.shoppingCategories.find((category) => category.id === entry.id)?.iconUrl}
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
              {list.label}
            </Title>
            <Text size="sm" c="dimmed">
              {toBuy.length} à acheter · {bought.length} sur {list.items.length} {plural(bought.length, 'acheté')}
            </Text>
          </Stack>
          <CloseButton size="lg" aria-label="Quitter le mode collecte" onClick={onClose} />
        </Group>
        {toBuy.length === 0 && <NoticeAlert kind="success">Tout est acheté.</NoticeAlert>}
        {deliverySections.map(({ delivery, items: deliveryItems }) => (
          <Stack key={`delivery:${delivery.id}`} gap="xs">
            <Heading
              name={delivery.label || (delivery.pickup ? 'Retrait' : 'Livraison')}
              color={null}
              count={deliveryItems.length}
              depth={0}
              collapsed={collapsed.has(`delivery:${delivery.id}`)}
              onToggle={() => toggle(`delivery:${delivery.id}`)}
            />
            <Group gap="sm" justify="space-between" wrap="wrap">
              <Text size="sm" c="dimmed">
                {[delivery.pickup ? 'À retirer' : 'À livrer', deliveryWindow(delivery), delivery.address || list.deliveryAddress].filter(Boolean).join(' · ')}
                {delivery.trackingUrl && /^https?:\/\//i.test(delivery.trackingUrl) && (
                  <>
                    {' · '}
                    <Anchor href={delivery.trackingUrl} {...EXTERNAL_LINK} size="sm">
                      Suivi <ArrowSquareOutIcon aria-hidden style={{ verticalAlign: 'middle' }} />
                    </Anchor>
                  </>
                )}
              </Text>
              <Button
                size="sm"
                variant="light"
                leftSection={<PackageIcon aria-hidden />}
                onClick={() =>
                  setDeliveryReceived.mutate(
                    { id: delivery.id, received: true },
                    formCallbacks(null, 'Livraison réceptionnée.', (ids) => propose(list.items.filter((item) => ids.includes(item.id)))),
                  )
                }
              >
                Réceptionnée
              </Button>
            </Group>
            {!collapsed.has(`delivery:${delivery.id}`) && deliveryItems.map((item) => row(item))}
          </Stack>
        ))}
        {sections.map((section) => (
          <Stack key={section.key} gap="xs">
            <Heading
              name={section.label}
              color={section.color}
              iconUrl={'iconUrl' in section ? section.iconUrl : null}
              count={section.items.length}
              depth={0}
              collapsed={collapsed.has(section.key)}
              onToggle={() => toggle(section.key)}
            />
            {!collapsed.has(section.key) && categories(section.key, section.items)}
          </Stack>
        ))}
        {bought.length > 0 && (
          <Stack gap="xs">
            <UnstyledButton className={classes.storeHeading} data-depth={0} onClick={() => toggle('bought')} aria-expanded={!collapsed.has('bought')}>
              <Group gap="xs" wrap="nowrap">
                <FoldChevron expanded={!collapsed.has('bought')} />
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
