import { ActionsRow } from '../../components/actions/ActionsRow';
import { createdId } from '../../components/settings/settings-api';
import { SettingsItemForm } from '../../components/settings/SettingsItemForm';
import { EntityAvatar } from '../workspace/EntityAvatar';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { BlockSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { closePanel, openPanel } from '../../components/panels/panels';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Badge, Group, Menu, Stack, Tabs, Text, Tooltip, type TabsTabProps } from '@mantine/core';
import { shoppingBaseListNameSchema } from '@ordo/shared';
import { ArrowLeftIcon, ArrowRightIcon, CaretDownIcon, ListBulletsIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList } from './api';
import { BaseList } from './BaseList';
import { useDragSensors } from '../../lib/drag';
const schema = z.object({ name: shoppingBaseListNameSchema });

/**
 * Tab of a base list dragged along the tab list (a click still selects it: the drag starts after a few pixels), as the
 * tabs of the task views.
 * @param {TabsTabProps & { value: string }} props Tab props.
 * @returns {JSX.Element} Tab.
 */
function SortableTab(props: TabsTabProps & { value: string }) {
  // Pointer only: the tab keeps its role and keyboard navigation (its menu moves the base list with the keyboard).
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: props.value });
  return (
    <Tabs.Tab
      ref={setNodeRef}
      {...props}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform && { ...transform, y: 0 }), transition, zIndex: isDragging ? 1 : undefined, cursor: isDragging ? 'grabbing' : undefined }}
    />
  );
}

/**
 * Base lists ("références": food, school supplies, children's clothes…), one tab each, created, renamed, moved and
 * deleted from the menu of its tab, reordered by drag and drop; the products of the one chosen below.
 * @returns {JSX.Element} Base lists.
 */
export function BaseLists() {
  const { data, isPending } = useShoppingData();
  const mutations = useShoppingMutations();
  const [params, setParams] = useSearchParams();
  const baseLists = data?.shoppingBaseLists ?? [];
  const current = baseLists.find((baseList) => baseList.id === params.get('base')) ?? baseLists[0];
  const sensors = useDragSensors();

  /**
   * Moves a base list among the others.
   * @param {string} id Base list id.
   * @param {number} target Target index.
   * @returns {void}
   */
  const move = (id: string, target: number) => mutations.moveBaseList.mutate({ id, index: target }, { onError: onMutationError });

  /**
   * Shows a base list.
   * @param {string | null} id Base list id.
   * @returns {void}
   */
  const select = (id: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set('base', id);
        else next.delete('base');
        return next;
      },
      { replace: true },
    );

  /**
   * Opens the form of a new or renamed base list.
   * @param {ShoppingBaseList} [baseList] Base list renamed. Optional.
   * @returns {void}
   */
  const openForm = (baseList?: ShoppingBaseList) => {
    const modalId = 'shopping-base-list';
    // Id of the list created, selected once the form closes.
    let created: string | null = null;
    openPanel({
      panelId: modalId,
      title: baseList ? 'Modifier la référence' : 'Nouvelle référence',
      children: (
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
            closePanel(modalId);
            if (created) select(created);
          }}
        />
      ),
    });
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

  /**
   * Moves the dropped base list to its new place.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const target = baseLists.findIndex((baseList) => baseList.id === over.id);
    if (target >= 0) move(String(active.id), target);
  };

  return (
    <Stack gap="md">
      <Group gap={0} wrap="nowrap">
        <Tabs value={current.id} onChange={select} style={{ minWidth: 0 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={baseLists.map((baseList) => baseList.id)} strategy={horizontalListSortingStrategy}>
              <Tabs.List>
                {baseLists.map((baseList, position) => {
                  const missing = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id && product.missing).length;
                  return (
                    <SortableTab
                      key={baseList.id}
                      value={baseList.id}
                      leftSection={<EntityAvatar name={baseList.name} iconUrl={baseList.iconUrl ?? null} color={baseList.color ?? 'gray'} size={18} radius="sm" />}
                      rightSection={
                        baseList.id === current.id ? (
                          <Menu position="bottom-end" withinPortal shadow="md">
                            <Menu.Target>
                              <ActionIcon
                                component="span"
                                variant="subtle"
                                color="gray"
                                size="xs"
                                aria-label={`Actions sur la référence ${baseList.name}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <CaretDownIcon aria-hidden />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openForm(baseList)}>
                                Modifier
                              </Menu.Item>
                              <Menu.Item leftSection={<ArrowLeftIcon aria-hidden />} disabled={position === 0} onClick={() => move(baseList.id, position - 1)}>
                                Déplacer à gauche
                              </Menu.Item>
                              <Menu.Item leftSection={<ArrowRightIcon aria-hidden />} disabled={position === baseLists.length - 1} onClick={() => move(baseList.id, position + 1)}>
                                Déplacer à droite
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item color="red" leftSection={<TrashIcon aria-hidden />} onClick={() => confirmDelete(baseList)}>
                                Supprimer
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        ) : undefined
                      }
                    >
                      <Group gap={6} wrap="nowrap">
                        {baseList.name}
                        {missing > 0 && (
                          <Badge size="xs" variant="light" color="orange" aria-label={`${missing} manquant(s)`}>
                            {missing}
                          </Badge>
                        )}
                      </Group>
                    </SortableTab>
                  );
                })}
              </Tabs.List>
            </SortableContext>
          </DndContext>
        </Tabs>
        <Tooltip label="Nouvelle référence">
          <ActionIcon variant="subtle" color="gray" ml="xs" aria-label="Nouvelle référence" onClick={() => openForm()}>
            <PlusIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
      <BaseList key={current.id} baseList={current} />
    </Stack>
  );
}
