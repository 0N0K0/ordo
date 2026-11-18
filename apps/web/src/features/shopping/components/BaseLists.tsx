import { countOf } from '../../../lib/text';
import { moveToIndex } from '../../../lib/mutation';
import { SortableTabs } from '../../../components/tabs/SortableTabs';
import { useTabParam } from '../../../components/tabs/use-tab-param';
import { ActionsRow } from '../../../components/actions/ActionsRow';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsItemForm } from '../../../components/settings/SettingsItemForm';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { BlockSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';

import { Badge, Group, Stack, Text } from '@mantine/core';
import { shoppingBaseListNameSchema } from '@ordo/shared';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ListBulletsIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { z } from 'zod';
import { archiveWithUndo, useSetArchived, visibleItems } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { shoppingKey, useShoppingData, useShoppingMutations, type ShoppingBaseList } from '../api';
import { BaseList } from './BaseList';

const schema = z.object({ name: shoppingBaseListNameSchema });

/**
 * Base lists ("références": food, school supplies, children's clothes…), one tab each, created, renamed, moved and
 * deleted from the menu of its tab, reordered by drag and drop; the products of the one chosen below. An archived one
 * is hidden until « Afficher les archivées », read only.
 * @returns {JSX.Element} Base lists.
 */
export function BaseLists() {
  const { data, isPending } = useShoppingData();
  const mutations = useShoppingMutations();
  const setArchived = useSetArchived('SHOPPING_BASE_LIST', [shoppingKey]);
  const [showArchived, setShowArchived] = useState(false);
  const baseLists = data?.shoppingBaseLists ?? [];
  const tabs = [...visibleItems(baseLists, showArchived)];
  const [current, select] = useTabParam('base', tabs);

  /**
   * Moves a base list among the others.
   * @param {string} id Base list id.
   * @param {number} target Target index among the tabs shown.
   * @returns {void}
   */
  const move = (id: string, target: number) => {
    // The index among every base list, the archived ones hidden included.
    const index = baseLists.findIndex((baseList) => baseList.id === tabs[target]?.id);
    const order = moveToIndex(baseLists, id, index);
    if (order) mutations.moveBaseList.mutate({ id, index, ids: order.map((baseList) => baseList.id) }, { onError: onMutationError });
  };

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
            « {baseList.name} » sera supprimée définitivement{count ? `, avec ses ${countOf(count, 'produit')} et leur historique d’achat` : ''}. Les listes déjà faites gardent leurs éléments. Cette
            action est irréversible.
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
          <ShowArchivedSwitch checked={showArchived} onChange={setShowArchived} count={baseLists.filter((baseList) => baseList.archived).length} label="Afficher les archivées" />
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
      <ShowArchivedSwitch checked={showArchived} onChange={setShowArchived} count={baseLists.filter((baseList) => baseList.archived).length} label="Afficher les archivées" />
      <SortableTabs
        items={tabs}
        value={current.id}
        onChange={select}
        onMove={move}
        name={(baseList) => `la référence ${baseList.name}`}
        leftSection={(baseList) => <ItemAvatar name={baseList.name} iconUrl={baseList.iconUrl} color={baseList.color} />}
        label={(baseList) => {
          const missing = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id && product.missing).length;
          return (
            <Group gap={6} wrap="nowrap">
              {baseList.name}
              {baseList.archived && <ArchivedBadge feminine size="xs" />}
              {missing > 0 && (
                <Badge size="xs" variant="light" color="orange" aria-label={`${countOf(missing, 'manquant')}`}>
                  {missing}
                </Badge>
              )}
            </Group>
          );
        }}
        actions={(baseList) => [
          // Archived: read only.
          ...(baseList.archived ? [] : [{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(baseList) }]),
          {
            label: baseList.archived ? 'Restaurer' : 'Archiver',
            icon: baseList.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
            onClick: () => void archiveWithUndo(setArchived, { ids: [baseList.id], archived: !baseList.archived, label: `Référence « ${baseList.name} »`, feminine: true }),
          },
        ]}
        onDelete={confirmDelete}
        add={{ label: 'Nouvelle référence', onClick: () => openForm() }}
      />
      <BaseList key={current.id} baseList={current} />
    </Stack>
  );
}
