import { InlineActions, type RowMenuEntry } from '../actions/ActionsMenu';
import { Group, Text, ThemeIcon } from '@mantine/core';
import { ArchiveIcon, ArrowCounterClockwiseIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import { capitalize, agreed } from '@ordo/shared';
import { archivedMessage, archiveWithUndo, useSetArchived, useArchivedToggle, unarchived } from '../../lib/archive';
import { ON_ERROR, onMutationError } from '../../lib/notify';
import { CategoryTree } from '../tree/CategoryTree';
import { categoryTree } from '../tree/category-tree';
import { confirmDestructive } from '../dialogs/confirm-destructive';
import { EmptyState } from '../feedback/EmptyState';
import { ListSkeleton } from '../feedback/Skeletons';
import { ShowArchivedSwitch } from '../filters/ShowArchivedSwitch';
import { openFormPanel } from '../panels/panels';
import { ArchivedBadge } from '../feedback/ArchivedBadge';
import { useReorderSettingsItems } from './settings-api';
import { useLiveSource } from '../../lib/live-value';
import { SettingsItemForm, type SettingsItem, type SettingsItemKind, type SettingsItemValues } from './SettingsItemForm';
import { SettingsSection } from './SettingsSection';
import { ActionButton } from '../actions/ActionButton';

interface SettingsListProps<C extends SettingsItem, E extends object> extends SettingsItemKind<C, E> {
  title: string;
  description: ReactNode;
  /** « le statut », « la catégorie », « l’étiquette »: in the messages. */
  noun: string;
  /** The noun is feminine: the messages agree with it (« archivée », « supprimée »). Optional. Default = false. */
  feminine?: boolean;
  items: readonly C[];
  /** A tree: items under others, moved under another by drag and drop. Optional. Default = false. */
  nested?: boolean;
  /** Number of rows of each item. Optional. */
  usage?: ReadonlyMap<string, number>;
  /** What the rows are, in the deletion message: one after « de » (« de la tâche », « de l’article »), several (« tâches »). Optional. */
  usageNoun?: { one: string; many: string };
  /** Deletes an item. */
  remove: (id: string) => Promise<unknown>;
  /** Puts an item under a parent (null: top level) at an index among its siblings; none: the order of the list is saved as is. Optional. */
  move?: (id: string, parentId: string | null, index: number) => Promise<unknown>;
  /** Badges after the name. Optional. */
  renderBadges?: (item: C) => ReactNode;
  /** Deletion message, instead of the default one. Optional. */
  deleteMessage?: (item: C, path: string) => ReactNode;
  /** Deletion that loses nothing (the opposite action undoes it): « Cette action est irréversible. » left out, and its toast instead of « « X » supprimé. ». Optional. Default = irreversible. */
  reversibleDelete?: (item: C, path: string) => string;
  /** Key remembering the folded items of a tree in this browser. Optional. */
  storageKey?: string;
  /** Buttons of a row of the list of its own (export…), before the common ones. Optional. */
  renderActions?: (item: C) => ReactNode;
  /** Entries of the « … » menu of a row of its own (a conversion…), before « Supprimer ». Optional. */
  menuItems?: (item: C) => readonly RowMenuEntry[];
  /** Buttons of the header of the list of its own, before « Ajouter ». Optional. */
  headerActions?: ReactNode;
  /** Why an item cannot be deleted (the last calendar…); nothing: it can. Optional. */
  undeletable?: (item: C) => string | null;
  /** Rows while the list loads. Optional. */
  loading?: boolean;
  /** The parent is chosen in the form (else only by drag and drop). Optional. Default = true. */
  withParent?: boolean;
  /** Whether an item may go under a parent (null: the top level); refused drops are not shown. Optional. */
  canMove?: (item: C, parentId: string | null) => boolean;
  /** Given a function opening the form of a new item with starting values (a map click…). Optional. */
  adderRef?: { current: ((values: Partial<SettingsItemValues<E>>) => void) | null };
}

/**
 * Settings list, flat or tree (every one of the app): each item with its avatar (its image, or its initials on its
 * color), its name and number of uses; added, edited (name, color, image, parent, fields of the list) in the side
 * panel (the item followed as the list refreshes), archived or restored (with an undo), deleted once confirmed, reordered — and in a tree put under another — by
 * drag and drop. An archive that loses something for good (`archiveRisk`, read on the items reloaded just before, the
 * « Archiver » entry loading meanwhile) is confirmed first. Archived items are hidden behind « Afficher les archivés » (shown when there are some), with their
 * badge, read only (neither edited nor moved, nor given sub-items).
 * @param {SettingsListProps<C, E>} props Component props.
 * @returns {JSX.Element} List.
 */
export function SettingsList<C extends SettingsItem, E extends object = Record<string, never>>({
  kind,
  title,
  description,
  noun,
  feminine = false,
  items,
  nested = false,
  withColor = true,
  colorRequired,
  labelPlaceholder,
  labelField,
  usage,
  usageNoun,
  schema,
  extra,
  create,
  update,
  remove,
  move,
  renderBadges,
  deleteMessage,
  reversibleDelete,
  storageKey,
  renderActions,
  menuItems,
  headerActions,
  undeletable,
  loading = false,
  withParent = true,
  canMove,
  adderRef,
  confirmLoss,
  archiveRisk,
}: SettingsListProps<C, E>) {
  const reorder = useReorderSettingsItems();
  const setArchived = useSetArchived(kind, undefined, confirmLoss);
  const { shown, showArchived, toggle: archivedToggle } = useArchivedToggle(items);
  // The form of an item follows the list (a panel renders once): values changed elsewhere are taken.
  const liveItems = useLiveSource(items);

  /**
   * Opens the form of an item in the side panel.
   * @param {{ item?: C, parentId?: string | null, initial?: object }} [options] Item edited, or parent and starting values of a new one. Optional.
   * @returns {void}
   */
  const openForm = ({ item, parentId, initial }: { item?: C; parentId?: string | null; initial?: Partial<SettingsItemValues<E>> } = {}) => {
    openFormPanel(item ? `Modifier ${noun}` : `Ajouter ${noun}`, (close) => (
      <SettingsItemForm<C, E>
        kind={kind}
        item={item}
        parentId={parentId}
        tree={nested ? items : undefined}
        liveItems={liveItems}
        withParent={withParent}
        initial={initial}
        withColor={withColor}
        colorRequired={colorRequired}
        labelPlaceholder={labelPlaceholder}
        labelField={labelField}
        schema={schema}
        extra={extra}
        create={create}
        update={update}
        onDone={close}
      />
    ));
  };

  // The opening of a new item with starting values, for the page (a click on its map…).
  useEffect(() => {
    if (!adderRef) return;
    adderRef.current = (initial) => openForm({ initial });
    return () => {
      adderRef.current = null;
    };
  });

  /**
   * Moves an item: with the move of its list, else by saving the new order of the flat list.
   * @param {string} id Item.
   * @param {string | null} parentId New parent.
   * @param {number} index Index among its new siblings.
   * @returns {void}
   */
  const handleMove = (id: string, parentId: string | null, index: number) => {
    // The index is among the siblings shown: the archived ones hidden keep their place among all of them.
    const order = categoryTree(items)
      .map(({ category }) => category)
      .filter((other) => other.id !== id);
    const siblings = order.filter((other) => (other.parentId ?? null) === parentId);
    const shownSiblings = showArchived ? siblings : unarchived(siblings);
    const before = shownSiblings[index];
    const last = shownSiblings[shownSiblings.length - 1];
    const fullIndex = before ? siblings.indexOf(before) : last ? siblings.indexOf(last) + 1 : 0;
    if (move) {
      move(id, parentId, fullIndex).catch(onMutationError);
      return;
    }
    const ids = order.map((other) => other.id);
    ids.splice(before ? ids.indexOf(before.id) : last ? ids.indexOf(last.id) + 1 : 0, 0, id);
    reorder.mutate({ kind, ids }, ON_ERROR);
  };

  // Item whose archive risk is being reloaded: its « Archiver » entry loads.
  const [checking, setChecking] = useState<string | null>(null);

  /**
   * Archives or restores an item, told with an undo; an archive that loses something for good (`archiveRisk`) is read
   * on the items reloaded from the server just before (a subscription made meanwhile is not missed; a failed reload
   * archives nothing), confirmed first, then told without undo.
   * @param {C} item Item.
   * @param {string} path Its full name.
   * @returns {Promise<void>} Once archived, restored, or asked.
   */
  const toggleArchived = async (item: C, path: string) => {
    /**
     * Archives or restores the item.
     * @returns {void}
     */
    const toggle = () => void archiveWithUndo(setArchived, { ids: [item.id], archived: !item.archived, label: `« ${path} »`, feminine });
    if (item.archived || !archiveRisk) return toggle();
    setChecking(item.id);
    let reloaded: readonly C[] | undefined;
    try {
      reloaded = await archiveRisk.reload();
    } catch (error) {
      onMutationError(error as Error);
      return;
    } finally {
      // Another row may be checking meanwhile: only its own loading ends.
      setChecking((current) => (current === item.id ? null : current));
    }
    // Gone from the server meanwhile: nothing left to lose, the archive tells why it fails.
    const fresh = reloaded?.find((other) => other.id === item.id);
    const risk = fresh ? archiveRisk.risk(fresh) : null;
    if (!risk) return toggle();
    // No undo: restoring it does not bring back what is lost.
    confirmDestructive({
      title: `Archiver ${noun}`,
      risks: risk,
      confirmLabel: 'Archiver',
      confirmIcon: <ArchiveIcon aria-hidden />,
      run: () => setArchived.mutateAsync({ ids: [item.id], archived: true }),
      done: archivedMessage(`« ${path} »`, true, { feminine }),
    });
  };

  /**
   * Asks for confirmation before deleting an item.
   * @param {C} item Item.
   * @param {string} path Its full name.
   * @returns {void}
   */
  const confirmDelete = (item: C, path: string) => {
    const used = usage?.get(item.id) ?? 0;
    confirmDestructive({
      title: `Supprimer ${noun}`,
      risks: (
        <>
          {deleteMessage?.(item, path) ?? (
            <>
              « {path} » sera {agreed('supprimé', feminine)} définitivement
              {used && usageNoun ? ` et ${agreed('retiré', feminine)} ${used === 1 ? `${usageNoun.one} qui l’utilise` : `des ${used} ${usageNoun.many} qui l’utilisent`}` : ''}.
              {nested ? ' Ses sous-éléments remonteront d’un niveau.' : ''}
            </>
          )}
        </>
      ),
      run: () => remove(item.id),
      reversible: Boolean(reversibleDelete),
      done: reversibleDelete?.(item, path) ?? `« ${path} » ${agreed('supprimé', feminine)}.`,
    });
  };

  return (
    <SettingsSection
      title={title}
      description={description}
      actions={
        <>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            <ShowArchivedSwitch {...archivedToggle} />
            {headerActions}
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
              Ajouter
            </ActionButton>
          </Group>
        </>
      }
    >
      {loading ? (
        <ListSkeleton items={3} />
      ) : shown.length === 0 ? (
        <Group gap="sm">
          <ThemeIcon variant="light" color="gray" radius="xl">
            <TagIcon aria-hidden />
          </ThemeIcon>
          <EmptyState compact message={items.length === 0 ? 'Aucun élément pour le moment.' : 'Tous les éléments sont archivés.'} />
        </Group>
      ) : (
        <CategoryTree
          noun={capitalize(noun.replace(/^(le |la |l’)/, ''))}
          feminine={feminine}
          categories={shown}
          nested={nested}
          storageKey={storageKey}
          renderMeta={
            usage
              ? ({ category }) => (
                  <Text size="xs" c="dimmed">
                    {usage.get(category.id) || ''}
                  </Text>
                )
              : undefined
          }
          renderBadges={(item) => (
            <>
              {item.archived && <ArchivedBadge feminine={feminine} size="xs" />}
              {renderBadges?.(item)}
            </>
          )}
          locked={(item) => item.archived}
          renderActions={({ category, path }) => (
            <>
              {renderActions?.(category)}
              <InlineActions
                name={path}
                items={[
                  nested && !category.archived && { label: 'Ajouter un sous-élément', icon: <PlusIcon aria-hidden />, onClick: () => openForm({ parentId: category.id }) },
                  !category.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm({ item: category }) },
                  {
                    // eslint-disable-next-line no-restricted-syntax -- told with the noun of the list (archiveEntry tells its type).
                    label: category.archived ? 'Restaurer' : 'Archiver',
                    icon: category.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
                    onClick: () => void toggleArchived(category, path),
                    loading: checking === category.id,
                    // In the « … » menu, never a button.
                    inMenu: true,
                  },
                  ...(menuItems?.(category) ?? []),
                  {
                    label: 'Supprimer',
                    icon: <TrashIcon aria-hidden />,
                    danger: true,
                    disabled: Boolean(undeletable?.(category)),
                    hint: undeletable?.(category) ?? undefined,
                    onClick: () => confirmDelete(category, path),
                  },
                ]}
              />
            </>
          )}
          onMove={handleMove}
          canMove={(id, parentId) => {
            // Nothing goes under an archived item (read only).
            if (parentId && items.find((other) => other.id === parentId)?.archived) return false;
            const item = items.find((other) => other.id === id);
            return !item || !canMove || canMove(item, parentId);
          }}
        />
      )}
    </SettingsSection>
  );
}
