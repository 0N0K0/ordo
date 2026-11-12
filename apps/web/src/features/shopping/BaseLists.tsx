import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Badge, Button, Group, Menu, Paper, Skeleton, Stack, Tabs, Text, TextInput, ThemeIcon, Tooltip, type TabsTabProps } from '@mantine/core';
import { modals } from '@mantine/modals';
import { shoppingBaseListNameSchema } from '@ordo/shared';
import { ArrowLeftIcon, ArrowRightIcon, CaretDownIcon, ListBulletsIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList } from './api';
import { BaseList } from './BaseList';

const schema = z.object({ name: shoppingBaseListNameSchema });

/**
 * Name of a new or renamed base list.
 * @param {{ baseList?: ShoppingBaseList, onDone: (id?: string) => void }} props Component props.
 * @param {ShoppingBaseList} [props.baseList] Base list renamed. Optional.
 * @param {(id?: string) => void} props.onDone Closes the form (with the id of the new list).
 * @returns {JSX.Element} Form.
 */
function BaseListForm({ baseList, onDone }: { baseList?: ShoppingBaseList; onDone: (id?: string) => void }) {
  const { createBaseList, renameBaseList } = useShoppingMutations();
  const form = useAppForm<z.input<typeof schema>>({ initialValues: { name: baseList?.name ?? '' }, schema });
  const handleSubmit = form.onSubmit(({ name }) => {
    const onError = (error: Error) => showFormError(form, error);
    if (baseList)
      renameBaseList.mutate(
        { id: baseList.id, name },
        {
          onSuccess: () => {
            notifySuccess('Liste type renommée.');
            onDone();
          },
          onError,
        },
      );
    else
      createBaseList.mutate(
        { name },
        {
          onSuccess: (id) => {
            notifySuccess('Liste type créée.');
            onDone(id);
          },
          onError,
        },
      );
  });
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" placeholder="Alimentation, fournitures scolaires, vêtements des enfants…" required data-autofocus {...form.getInputProps('name')} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => onDone()}>
            Annuler
          </Button>
          <Button type="submit" loading={createBaseList.isPending || renameBaseList.isPending}>
            {baseList ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

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
 * Base lists ("listes types": food, school supplies, children's clothes…), one tab each, created, renamed, moved and
 * deleted from the menu of its tab, reordered by drag and drop; the products of the one chosen below.
 * @returns {JSX.Element} Base lists.
 */
export function BaseLists() {
  const { data, isPending } = useShoppingData();
  const mutations = useShoppingMutations();
  const [params, setParams] = useSearchParams();
  const baseLists = data?.shoppingBaseLists ?? [];
  const current = baseLists.find((baseList) => baseList.id === params.get('base')) ?? baseLists[0];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /**
   * Moves a base list among the others.
   * @param {string} id Base list id.
   * @param {number} target Target index.
   * @returns {void}
   */
  const move = (id: string, target: number) => mutations.moveBaseList.mutate({ id, index: target }, { onError: (error) => notifyError(error.message) });

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
    modals.open({
      modalId,
      title: baseList ? 'Renommer la liste type' : 'Nouvelle liste type',
      children: (
        <BaseListForm
          baseList={baseList}
          onDone={(id) => {
            modals.close(modalId);
            if (id) select(id);
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
    const modalId = `delete-shopping-base-list-${baseList.id}`;
    const count = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id).length;
    modals.open({
      modalId,
      title: 'Supprimer la liste type',
      children: (
        <Stack gap="md">
          <Text size="sm">
            « {baseList.name} » sera supprimée définitivement{count ? `, avec ses ${count} produit(s) et leur historique d’achat` : ''}. Les listes déjà faites gardent leurs éléments. Cette action est
            irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              mutations.deleteBaseList.mutate(
                { id: baseList.id },
                {
                  onSuccess: () => {
                    notifySuccess('Liste type supprimée.');
                    select(null);
                  },
                  onError: (error) => notifyError(error.message),
                },
              );
            }}
          />
        </Stack>
      ),
    });
  };

  if (isPending) return <Skeleton height={36} />;
  if (!current) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
            <ListBulletsIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed" ta="center">
            Aucune liste type : créez-en une par sorte d’achats (alimentation, fournitures scolaires, vêtements des enfants…), puis cochez ce qui manque pour générer une liste.
          </Text>
          <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Créer une liste type
          </Button>
        </Stack>
      </Paper>
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
                      rightSection={
                        baseList.id === current.id ? (
                          <Menu position="bottom-end" withinPortal shadow="md">
                            <Menu.Target>
                              <ActionIcon
                                component="span"
                                variant="subtle"
                                color="gray"
                                size="xs"
                                aria-label={`Actions sur la liste type ${baseList.name}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <CaretDownIcon aria-hidden />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openForm(baseList)}>
                                Renommer
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
        <Tooltip label="Nouvelle liste type">
          <ActionIcon variant="subtle" color="gray" ml="xs" aria-label="Nouvelle liste type" onClick={() => openForm()}>
            <PlusIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
      <BaseList key={current.id} baseList={current} />
    </Stack>
  );
}
