import { ActionIcon, Button, Group, Menu, Paper, Skeleton, Stack, Tabs, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { shoppingBaseListNameSchema } from '@ordo/shared';
import { ArrowLeftIcon, ArrowRightIcon, DotsThreeVerticalIcon, ListBulletsIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
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
 * Base lists ("listes types": food, school supplies, children's clothes…), one tab each, created, renamed, moved and
 * deleted here; the products of the one chosen below.
 * @returns {JSX.Element} Base lists.
 */
export function BaseLists() {
  const { data, isPending } = useShoppingData();
  const mutations = useShoppingMutations();
  const [params, setParams] = useSearchParams();
  const baseLists = data?.shoppingBaseLists ?? [];
  const current = baseLists.find((baseList) => baseList.id === params.get('base')) ?? baseLists[0];
  const index = current ? baseLists.indexOf(current) : -1;

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

  return (
    <Stack gap="md">
      <Group gap="xs" wrap="nowrap" align="center">
        <Tabs value={current.id} onChange={select} variant="pills" style={{ minWidth: 0 }}>
          <Tabs.List>
            {baseLists.map((baseList) => {
              const missing = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id && product.missing).length;
              return (
                <Tabs.Tab key={baseList.id} value={baseList.id} rightSection={missing ? <Text size="xs">{missing}</Text> : undefined}>
                  {baseList.name}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>
        <Tooltip label="Nouvelle liste type">
          <ActionIcon variant="subtle" color="gray" aria-label="Nouvelle liste type" onClick={() => openForm()}>
            <PlusIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Menu position="bottom-end" shadow="md" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`Actions de la liste type ${current.name}`} ml="auto">
              <DotsThreeVerticalIcon aria-hidden />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openForm(current)}>
              Renommer
            </Menu.Item>
            <Menu.Item
              leftSection={<ArrowLeftIcon aria-hidden />}
              disabled={index <= 0}
              onClick={() => mutations.moveBaseList.mutate({ id: current.id, index: index - 1 }, { onError: (error) => notifyError(error.message) })}
            >
              Déplacer vers la gauche
            </Menu.Item>
            <Menu.Item
              leftSection={<ArrowRightIcon aria-hidden />}
              disabled={index >= baseLists.length - 1}
              onClick={() => mutations.moveBaseList.mutate({ id: current.id, index: index + 1 }, { onError: (error) => notifyError(error.message) })}
            >
              Déplacer vers la droite
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<TrashIcon aria-hidden />} onClick={() => confirmDelete(current)}>
              Supprimer
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <BaseList key={current.id} baseList={current} />
    </Stack>
  );
}
