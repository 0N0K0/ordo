import { Button, Group, Menu, Skeleton, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { formatMoney, shoppingListNameSchema } from '@ordo/shared';
import { ArchiveIcon, ArrowCounterClockwiseIcon, BankIcon, CopyIcon, FilePdfIcon, PencilSimpleIcon, TextAlignLeftIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { TaskSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useTreasuryEntrySearch } from '../treasury/api';
import { useShoppingData, useShoppingMutations, type ShoppingList } from './api';
import { downloadShoppingPdf, shoppingText } from './export';
import { confirmDestructive, openModal } from './list-modals';
import { shoppingRows, taskChoices, usePeople, type ShoppingGrouping } from './shopping-format';
import classes from './Shopping.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

const listSchema = z.object({ name: shoppingListNameSchema, taskId: z.string().nullable() });

/**
 * Name and task of a list.
 * @param {{ list: ShoppingList, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ListForm({ list, onDone }: { list: ShoppingList; onDone: () => void }) {
  const { context } = useTaskContext();
  const { updateList } = useShoppingMutations();
  const form = useAppForm<z.input<typeof listSchema>>({ initialValues: { name: list.name, taskId: list.taskId ?? null }, schema: listSchema });
  const { tasks, labelOf } = taskChoices(context);
  // The task of the list stays offered, even closed.
  const current = list.taskId ? context?.taskById.get(list.taskId) : undefined;
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) =>
        updateList.mutate(
          { id: list.id, name: values.name, taskId: values.taskId ?? null },
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
        <TaskSelect label="Tâche" placeholder="Aucune" tasks={current && !tasks.includes(current) ? [current, ...tasks] : tasks} labelOf={labelOf} {...form.getInputProps('taskId')} />
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
        {isFetching && <Skeleton height={36} />}
        {!isFetching && debounced.trim().length >= 2 && !entries?.length && (
          <Text size="sm" c="dimmed">
            Aucun mouvement trouvé.
          </Text>
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

interface ListActionsMenuProps {
  list: ShoppingList;
  /** Grouping of the exports (as the list is shown). */
  grouping: ShoppingGrouping;
  /** Button opening the menu. */
  target: ReactNode;
  /** After the list is deleted (leaves its page). Optional. */
  onDeleted?: () => void;
}

/**
 * Actions of a shopping list, from its page or from the table of the lists: rename and change its task, attach to or
 * detach from a treasury entry, duplicate, copy as text, export as PDF, archive or reopen, delete.
 * @param {ListActionsMenuProps} props Component props.
 * @returns {JSX.Element} Menu.
 */
export function ListActionsMenu({ list, grouping, target, onDeleted }: ListActionsMenuProps) {
  const navigate = useNavigate();
  const { data } = useShoppingData();
  const { context } = useTaskContext();
  const people = usePeople();
  const mutations = useShoppingMutations();
  const task = list.taskId ? context?.taskById.get(list.taskId) : undefined;
  const closed = list.closed || Boolean(task?.closed);
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

  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>{target}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openModal('Modifier la liste', (close) => <ListForm list={list} onDone={close} />)}>
          Renommer, changer de tâche
        </Menu.Item>
        {list.entryId ? (
          <Menu.Item
            leftSection={<BankIcon aria-hidden />}
            onClick={() => mutations.attachEntry.mutate({ id: list.id, entryId: null }, { onSuccess: () => notifySuccess('Liste détachée du mouvement (sa répartition reste).'), onError })}
          >
            Détacher du mouvement
          </Menu.Item>
        ) : (
          <Menu.Item leftSection={<BankIcon aria-hidden />} onClick={() => openModal('Rattacher à un mouvement de trésorerie', (close) => <EntryPicker list={list} onDone={close} />)}>
            Rattacher à un mouvement
          </Menu.Item>
        )}
        <Menu.Item
          leftSection={<CopyIcon aria-hidden />}
          onClick={() =>
            mutations.duplicateList.mutate(
              { id: list.id },
              {
                onSuccess: (copyId) => {
                  notifySuccess('Liste dupliquée.');
                  navigate(`/shopping/${copyId}`);
                },
                onError,
              },
            )
          }
        >
          Dupliquer
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<TextAlignLeftIcon aria-hidden />}
          onClick={() =>
            void navigator.clipboard.writeText(shoppingText(list, rows(), people)).then(
              () => notifySuccess('Liste copiée : collez-la dans un message.'),
              () => notifyError('La liste n’a pas pu être copiée.'),
            )
          }
        >
          Copier en texte
        </Menu.Item>
        <Menu.Item leftSection={<FilePdfIcon aria-hidden />} onClick={() => void downloadShoppingPdf(list, rows(), people).catch(onError)}>
          Exporter en PDF
        </Menu.Item>
        <Menu.Divider />
        {closed ? (
          <Menu.Item
            leftSection={<ArrowCounterClockwiseIcon aria-hidden />}
            disabled={Boolean(task?.closed)}
            title={task?.closed ? 'La tâche de la liste est fermée : rouvrez-la pour rouvrir la liste.' : undefined}
            onClick={() => mutations.setClosed.mutate({ id: list.id, closed: false }, { onSuccess: () => notifySuccess('Liste rouverte.'), onError })}
          >
            Rouvrir
          </Menu.Item>
        ) : (
          <Menu.Item
            leftSection={<ArchiveIcon aria-hidden />}
            onClick={() => mutations.setClosed.mutate({ id: list.id, closed: true }, { onSuccess: () => notifySuccess('Liste archivée.'), onError })}
          >
            Archiver
          </Menu.Item>
        )}
        <Menu.Item
          color="red"
          leftSection={<TrashIcon aria-hidden />}
          onClick={() =>
            confirmDestructive(
              'Supprimer la liste',
              `« ${list.name} » et ses ${list.items.length} élément(s) seront supprimés définitivement. Les listes types et la répartition d’un mouvement rattaché ne changent pas. Cette action est irréversible.`,
              () =>
                mutations.deleteList.mutate(
                  { id: list.id },
                  {
                    onSuccess: () => {
                      notifySuccess('Liste supprimée.');
                      onDeleted?.();
                    },
                    onError,
                  },
                ),
            )
          }
        >
          Supprimer
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
