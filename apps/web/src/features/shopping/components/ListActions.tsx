import { countWith } from '../../../lib/text';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { byPosition, shoppingListFormSchema } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, BankIcon, CheckCircleIcon, CopyIcon, FilePdfIcon, PencilSimpleIcon, TextAlignLeftIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { ActionsMenu, type RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { notifyError, notifySuccess, onMutationError, toastCallbacks } from '../../../lib/notify';
import { archiveEntry, useSetArchived } from '../../../lib/archive';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useTreasuryEntrySearch } from '../../treasury/api';
import { shoppingKey, useShoppingData, useShoppingMutations, type ShoppingList } from '../api';
import { downloadShoppingPdf, shoppingText } from '../lib/export';
import { openFormPanel } from '../../../components/panels/panels';
import { listClosed, shoppingRows, taskOptions, usePeople, type ShoppingGrouping } from '../lib/shopping-format';
import classes from './Shopping.module.css';
import * as fmt from '../../../lib/format';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SignedAmount } from '../../../components/money/SignedAmount';

const listSchema = shoppingListFormSchema;

/**
 * Name and tasks of a list.
 * @param {{ list: ShoppingList, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ListForm({ list, onDone }: { list: ShoppingList; onDone: () => void }) {
  const { context } = useTaskContext();
  const { updateList } = useShoppingMutations();
  const form = useAppForm<z.input<typeof listSchema>>({ initialValues: { label: list.label, taskIds: list.taskIds }, schema: listSchema });
  return (
    <form noValidate onSubmit={form.onSubmit((values) => updateList.mutate({ id: list.id, label: values.label, taskIds: values.taskIds }, formCallbacks(form, 'Liste modifiée.', onDone)))}>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('label')} />
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
        <FormActions onCancel={onDone} loading={updateList.isPending} />
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
        {!isFetching && debounced.trim().length >= 2 && !entries?.length && <EmptyState compact message="Aucun mouvement trouvé." />}
        {entries?.map((entry) => (
          <UnstyledButton
            key={entry.id}
            className={classes.storeRow}
            onClick={() => attachEntry.mutate({ id: list.id, entryId: entry.id }, formCallbacks(null, 'Liste rattachée : la répartition a été ajoutée au mouvement.', onDone))}
          >
            <Stack gap={0} style={{ flex: 1 }}>
              <Text size="sm">{entry.label}</Text>
              <Text size="xs" c="dimmed">
                {fmt.day(entry.date)} · {entry.accountLabel}
                {entry.status === 'FORECAST' ? ' · prévision' : ''}
              </Text>
            </Stack>
            <SignedAmount value={entry.amount} />
          </UnstyledButton>
        ))}
      </Stack>
      <FormActions onCancel={onDone} submitLabel={null} />
    </Stack>
  );
}

/**
 * Actions of a shopping list, from its page or from the table of the lists: rename and change its task, attach to or
 * detach from a treasury entry, duplicate, copy as text, export as PDF, close or reopen, archive or restore, delete. An
 * archived list is read only: only its exports, « Restaurer » and « Supprimer ».
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
  const setArchived = useSetArchived('SHOPPING_LIST', [shoppingKey]);
  const closed = listClosed(list, context);
  // Closed along with its tasks (not by hand): reopened with one of them.
  const byTasks = closed && !list.closedAt;
  /**
   * Rows of the list as shown, for the exports.
   * @returns {ReturnType<typeof shoppingRows>} Rows.
   */
  const rows = () =>
    shoppingRows([...list.items].sort(byPosition), grouping, {
      categories: data?.shoppingCategories ?? [],
      stores: data?.shoppingStores ?? [],
      storages: data?.shoppingStorages ?? [],
      people: people.byKey,
    });

  const archive: RowMenuEntry = archiveEntry({ archived: list.archived, type: 'Liste', name: list.label, feminine: true }, setArchived, list.id);
  const exports: RowMenuEntry[] = [
    {
      label: 'Copier en texte',
      icon: <TextAlignLeftIcon aria-hidden />,
      onClick: () =>
        void navigator.clipboard.writeText(shoppingText(list, rows(), people)).then(
          () => notifySuccess('Liste copiée : collez-la dans un message.'),
          () => notifyError('La liste n’a pas pu être copiée.'),
        ),
    },
    { label: 'Exporter en PDF', icon: <FilePdfIcon aria-hidden />, onClick: () => void downloadShoppingPdf(list, rows(), people).catch(onMutationError) },
  ];
  const remove: RowMenuEntry = {
    label: 'Supprimer',
    icon: <TrashIcon aria-hidden />,
    danger: true,
    onClick: () =>
      confirmDestructive({
        title: 'Supprimer la liste',
        risks: `« ${list.label} » et ${countWith(list.items.length, 'élément', ['son', 'ses'])} seront supprimés définitivement. Les références et la répartition d’un mouvement rattaché ne changent pas.`,
        onConfirm: () =>
          mutations.deleteList.mutate(
            { id: list.id },
            formCallbacks(null, 'Liste supprimée.', () => onDeleted?.()),
          ),
      }),
  };
  // Archived: read only.
  if (list.archived) return [...exports, 'divider', archive, remove];

  return [
    { label: 'Renommer, changer de tâche', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openFormPanel('Modifier la liste', (close) => <ListForm list={list} onDone={close} />) },
    list.entryId
      ? {
          label: 'Détacher du mouvement',
          icon: <BankIcon aria-hidden />,
          onClick: () => mutations.attachEntry.mutate({ id: list.id, entryId: null }, toastCallbacks('Liste détachée du mouvement (sa répartition reste).')),
        }
      : {
          label: 'Rattacher à un mouvement',
          icon: <BankIcon aria-hidden />,
          onClick: () => openFormPanel('Rattacher à un mouvement de trésorerie', (close) => <EntryPicker list={list} onDone={close} />),
        },
    {
      label: 'Dupliquer',
      icon: <CopyIcon aria-hidden />,
      onClick: () =>
        mutations.duplicateList.mutate(
          { id: list.id },
          formCallbacks(null, 'Liste dupliquée.', (copyId: string) => navigate(`/shopping/${copyId}`)),
        ),
    },
    'divider',
    ...exports,
    'divider',
    closed
      ? {
          label: 'Rouvrir',
          icon: <ArrowCounterClockwiseIcon aria-hidden />,
          disabled: byTasks,
          hint: byTasks ? 'Les tâches de la liste sont fermées : rouvrez-en une pour rouvrir la liste.' : undefined,
          onClick: () => mutations.setClosed.mutate({ id: list.id, closed: false }, toastCallbacks('Liste rouverte.')),
        }
      : { label: 'Clôturer', icon: <CheckCircleIcon aria-hidden />, onClick: () => mutations.setClosed.mutate({ id: list.id, closed: true }, toastCallbacks('Liste clôturée.')) },
    archive,
    remove,
  ];
}

interface ListActionsMenuProps {
  list: ShoppingList;
  /** Grouping of the exports (as the list is shown). */
  grouping: ShoppingGrouping;
  /** In the header of the list's page, next to its buttons (a bordered button). Optional. Default = false. */
  header?: boolean;
  /** After the list is deleted (leaves its page). Optional. */
  onDeleted?: () => void;
}

/**
 * Menu of the actions of a shopping list (the menu of every row).
 * @param {ListActionsMenuProps} props Component props.
 * @returns {JSX.Element | null} Menu.
 */
export function ListActionsMenu({ list, grouping, header = false, onDeleted }: ListActionsMenuProps) {
  return <ActionsMenu name={`la liste ${list.label}`} items={useListActions(list, grouping, onDeleted)} {...(header ? { variant: 'default' as const, size: 'input-sm' } : {})} />;
}
