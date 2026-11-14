import { EmptyState } from '../../components/feedback/EmptyState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { Button, Group, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { formatMoney, shoppingListNameSchema } from '@ordo/shared';
import { ArchiveIcon, ArrowCounterClockwiseIcon, BankIcon, CopyIcon, FilePdfIcon, PencilSimpleIcon, TextAlignLeftIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { ActionsMenu, type RowMenuEntry } from '../../components/data-table/RowActions';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { useTreasuryEntrySearch } from '../treasury/api';
import { useShoppingData, useShoppingMutations, type ShoppingList } from './api';
import { downloadShoppingPdf, shoppingText } from './export';
import { openFormPanel } from '../../components/panels/panels';
import { listClosed, shoppingRows, taskOptions, usePeople, type ShoppingGrouping } from './shopping-format';
import classes from './Shopping.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

const listSchema = z.object({ name: shoppingListNameSchema, taskIds: z.array(z.string()) });

/**
 * Name and tasks of a list.
 * @param {{ list: ShoppingList, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ListForm({ list, onDone }: { list: ShoppingList; onDone: () => void }) {
  const { context } = useTaskContext();
  const { updateList } = useShoppingMutations();
  const form = useAppForm<z.input<typeof listSchema>>({ initialValues: { name: list.name, taskIds: list.taskIds }, schema: listSchema });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) =>
        updateList.mutate(
          { id: list.id, name: values.name, taskIds: values.taskIds },
          {
            onSuccess: () => {
              notifySuccess('Liste modifiée.');
              onDone();
            },
            onError: (error) => showFormError(form, error),
          },
        ),
      )}
    >
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        {/* The tasks of the list stay offered, even closed. */}
        <BatchMultiSelect
          label="Tâches"
          placeholder={form.values.taskIds.length ? undefined : 'Aucune'}
          data={taskOptions(context, list.taskIds)}
          searchable
          clearable
          nothingFoundMessage="Aucune tâche"
          disabled={!context}
          {...form.getInputProps('taskIds')}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={updateList.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Treasury entry paying a list: searched by its label; attaching adds its split by person.
 * @param {{ list: ShoppingList, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Picker.
 */
function EntryPicker({ list, onDone }: { list: ShoppingList; onDone: () => void }) {
  const [text, setText] = useState('');
  const [debounced] = useDebouncedValue(text, 250);
  const { data: entries, isFetching } = useTreasuryEntrySearch(debounced);
  const { attachEntry } = useShoppingMutations();
  return (
    <Stack gap="md">
      <Text size="sm">
        Chaque personne concernée par des éléments de la liste reçoit une ligne de répartition sur le mouvement : la somme de ses éléments (partagés à parts égales entre leurs personnes). Ce qui ne
        concerne personne reste non réparti.
      </Text>
      <TextInput label="Mouvement ou prévision" placeholder="Rechercher par libellé (2 caractères au moins)" data-autofocus value={text} onChange={(event) => setText(event.currentTarget.value)} />
      <Stack gap={4}>
        {isFetching && <ListSkeleton items={2} lines={2} />}
        {!isFetching && debounced.trim().length >= 2 && !entries?.length && (
          <EmptyState compact message="Aucun mouvement trouvé." />
        )}
        {entries?.map((entry) => (
          <UnstyledButton
            key={entry.id}
            className={classes.storeRow}
            onClick={() =>
              attachEntry.mutate(
                { id: list.id, entryId: entry.id },
                {
                  onSuccess: () => {
                    notifySuccess('Liste rattachée : la répartition a été ajoutée au mouvement.');
                    onDone();
                  },
                  onError: (error) => notifyError(error.message),
                },
              )
            }
          >
            <Stack gap={0} style={{ flex: 1 }}>
              <Text size="sm">{entry.label}</Text>
              <Text size="xs" c="dimmed">
                {dayFormat.format(new Date(`${entry.date}T00:00:00Z`))} · {entry.accountName}
                {entry.status === 'FORECAST' ? ' · prévision' : ''}
              </Text>
            </Stack>
            <Text size="sm" ff="monospace" c={entry.amount < 0 ? 'red' : 'green'}>
              {formatMoney(entry.amount)}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Actions of a shopping list, from its page or from the table of the lists: rename and change its task, attach to or
 * detach from a treasury entry, duplicate, copy as text, export as PDF, archive or reopen, delete.
 * @param {ShoppingList} list List.
 * @param {ShoppingGrouping} grouping Grouping of the exports (as the list is shown).
 * @param {() => void} [onDeleted] After the list is deleted (leaves its page). Optional.
 * @returns {RowMenuEntry[]} Actions.
 */
function useListActions(list: ShoppingList, grouping: ShoppingGrouping, onDeleted?: () => void): RowMenuEntry[] {
  const navigate = useNavigate();
  const { data } = useShoppingData();
  const { context } = useTaskContext();
  const people = usePeople();
  const mutations = useShoppingMutations();
  const closed = listClosed(list, context);
  // Closed along with its tasks (not by hand): reopened with one of them.
  const byTasks = closed && !list.closedAt;
  const onError = (error: Error) => notifyError(error.message);
  /**
   * Rows of the list as shown, for the exports.
   * @returns {ReturnType<typeof shoppingRows>} Rows.
   */
  const rows = () =>
    shoppingRows(
      [...list.items].sort((a, b) => a.position - b.position),
      grouping,
      { categories: data?.shoppingCategories ?? [], stores: data?.shoppingStores ?? [] },
    );

  return [
    { label: 'Renommer, changer de tâche', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openFormPanel('Modifier la liste', (close) => <ListForm list={list} onDone={close} />) },
    list.entryId
      ? {
          label: 'Détacher du mouvement',
          icon: <BankIcon aria-hidden />,
          onClick: () => mutations.attachEntry.mutate({ id: list.id, entryId: null }, { onSuccess: () => notifySuccess('Liste détachée du mouvement (sa répartition reste).'), onError }),
        }
      : { label: 'Rattacher à un mouvement', icon: <BankIcon aria-hidden />, onClick: () => openFormPanel('Rattacher à un mouvement de trésorerie', (close) => <EntryPicker list={list} onDone={close} />) },
    {
      label: 'Dupliquer',
      icon: <CopyIcon aria-hidden />,
      onClick: () =>
        mutations.duplicateList.mutate(
          { id: list.id },
          {
            onSuccess: (copyId) => {
              notifySuccess('Liste dupliquée.');
              navigate(`/shopping/${copyId}`);
            },
            onError,
          },
        ),
    },
    'divider',
    {
      label: 'Copier en texte',
      icon: <TextAlignLeftIcon aria-hidden />,
      onClick: () =>
        void navigator.clipboard.writeText(shoppingText(list, rows(), people)).then(
          () => notifySuccess('Liste copiée : collez-la dans un message.'),
          () => notifyError('La liste n’a pas pu être copiée.'),
        ),
    },
    { label: 'Exporter en PDF', icon: <FilePdfIcon aria-hidden />, onClick: () => void downloadShoppingPdf(list, rows(), people).catch(onError) },
    'divider',
    closed
      ? {
          label: 'Rouvrir',
          icon: <ArrowCounterClockwiseIcon aria-hidden />,
          disabled: byTasks,
          hint: byTasks ? 'Les tâches de la liste sont fermées : rouvrez-en une pour rouvrir la liste.' : undefined,
          onClick: () => mutations.setClosed.mutate({ id: list.id, closed: false }, { onSuccess: () => notifySuccess('Liste rouverte.'), onError }),
        }
      : { label: 'Archiver', icon: <ArchiveIcon aria-hidden />, onClick: () => mutations.setClosed.mutate({ id: list.id, closed: true }, { onSuccess: () => notifySuccess('Liste archivée.'), onError }) },
    {
      label: 'Supprimer',
      icon: <TrashIcon aria-hidden />,
      danger: true,
      onClick: () =>
        confirmDestructive({ title: 'Supprimer la liste', risks: `« ${list.name} » et ses ${list.items.length} élément(s) seront supprimés définitivement. Les listes types et la répartition d’un mouvement rattaché ne changent pas. Cette action est irréversible.`, onConfirm: () =>
            mutations.deleteList.mutate(
              { id: list.id },
              {
                onSuccess: () => {
                  notifySuccess('Liste supprimée.');
                  onDeleted?.();
                },
                onError,
              },
            ) }),
    },
  ];
}

interface ListActionsMenuProps {
  list: ShoppingList;
  /** Grouping of the exports (as the list is shown). */
  grouping: ShoppingGrouping;
  /** Button opening the menu. Optional. Default = a « ⋯ » icon. */
  target?: ReactNode;
  /** After the list is deleted (leaves its page). Optional. */
  onDeleted?: () => void;
}

/**
 * Menu of the actions of a shopping list (the menu of every row).
 * @param {ListActionsMenuProps} props Component props.
 * @returns {JSX.Element | null} Menu.
 */
export function ListActionsMenu({ list, grouping, target, onDeleted }: ListActionsMenuProps) {
  return <ActionsMenu name={`la liste ${list.name}`} items={useListActions(list, grouping, onDeleted)} target={target} />;
}
