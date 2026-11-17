import { SortableTabs } from '../../components/sortable-tabs/SortableTabs';
import { useTabParam } from '../../components/sortable-tabs/use-tab-param';
import { ActionsRow } from '../../components/actions/ActionsRow';
import { createdId } from '../../components/settings/settings-api';
import { SettingsItemForm } from '../../components/settings/SettingsItemForm';
import { EntityAvatar } from '../workspace/EntityAvatar';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { BlockSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../components/panels/panels';

import { Badge, Group, Menu, Stack, Text } from '@mantine/core';
import { shoppingBaseListNameSchema } from '@ordo/shared';
import { ListBulletsIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';

import { z } from 'zod';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList } from './api';
import { BaseList } from './BaseList';

const schema = z.object({ name: shoppingBaseListNameSchema });

/**
 * Base lists ("références": food, school supplies, children's clothes…), one tab each, created, renamed, moved and
 * deleted from the menu of its tab, reordered by drag and drop; the products of the one chosen below.
 * @returns {JSX.Element} Base lists.
 */
export function BaseLists() {
  const { data, isPending } = useShoppingData();
  const mutations = useShoppingMutations();
  const baseLists = data?.shoppingBaseLists ?? [];
  const [current, select] = useTabParam('base', baseLists);

  /**
   * Moves a base list among the others.
   * @param {string} id Base list id.
   * @param {number} target Target index.
   * @returns {void}
   */
  const move = (id: string, target: number) => mutations.moveBaseList.mutate({ id, index: target }, { onError: onMutationError });

  /**
   * Opens the form of a new or renamed base list.
   * @param {ShoppingBaseList} [baseList] Base list renamed. Optional.
   * @returns {void}
   */
  const openForm = (baseList?: ShoppingBaseList) => {
    // Id of the list created, selected once the form closes.
    let created: string | null = null;
    openFormPanel(
      baseList ? 'Modifier la référence' : 'Nouvelle référence',
      (close) => (
        <SettingsItemForm<ShoppingBaseList>
          kind="SHOPPING_BASE_LIST"
          item={baseList}
          colorRequired={false}
          schema={schema}
          create={async ({ name }) => {
            created = createdId(await mutations.createBaseList.mutateAsync({ name }));
            return created;
          }}
          update={(id, { name }) => mutations.renameBaseList.mutateAsync({ id, name })}
          onDone={() => {
            close();
            if (created) select(created);
          }}
        />
      ),
      { panelId: 'shopping-base-list' },
    );
  };

  /**
   * Asks for confirmation before deleting a base list with its products.
   * @param {ShoppingBaseList} baseList Base list.
   * @returns {void}
   */
  const confirmDelete = (baseList: ShoppingBaseList) => {
    const count = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id).length;
    confirmDestructive({
      title: 'Supprimer la référence',
      risks: (
        <>
          <Text size="sm">
            « {baseList.name} » sera supprimée définitivement{count ? `, avec ses ${count} produit(s) et leur historique d’achat` : ''}. Les listes déjà faites gardent leurs éléments. Cette action est
            irréversible.
          </Text>
        </>
      ),
      onConfirm: () => {
        mutations.deleteBaseList.mutate(
          { id: baseList.id },
          {
            onSuccess: () => {
              notifySuccess('Référence supprimée.');
              select(null);
            },
            onError: onMutationError,
          },
        );
      },
    });
  };

  if (isPending) return <BlockSkeleton height={2} />;
  if (!current) {
    return (
      <Stack gap="md">
        <ActionsRow>
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Nouvelle référence
          </ActionButton>
        </ActionsRow>
        <EmptyState
          icon={<ListBulletsIcon aria-hidden />}
          message="Aucune référence : créez-en une par sorte d’achats (alimentation, fournitures scolaires, vêtements des enfants…), puis cochez ce qui manque pour générer une liste."
        />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <SortableTabs
        items={baseLists}
        value={current.id}
        onChange={select}
        onMove={move}
        name={(baseList) => `la référence ${baseList.name}`}
        leftSection={(baseList) => <EntityAvatar name={baseList.name} iconUrl={baseList.iconUrl ?? null} color={baseList.color ?? 'gray'} size={18} radius="sm" />}
        label={(baseList) => {
          const missing = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id && product.missing).length;
          return (
            <Group gap={6} wrap="nowrap">
              {baseList.name}
              {missing > 0 && (
                <Badge size="xs" variant="light" color="orange" aria-label={`${missing} manquant(s)`}>
                  {missing}
                </Badge>
              )}
            </Group>
          );
        }}
        actions={(baseList) => (
          <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openForm(baseList)}>
            Modifier
          </Menu.Item>
        )}
        onDelete={confirmDelete}
        add={{ label: 'Nouvelle référence', onClick: () => openForm() }}
      />
      <BaseList key={current.id} baseList={current} />
    </Stack>
  );
}
