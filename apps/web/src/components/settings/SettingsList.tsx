import { ActionIcon, Group, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { ArchiveIcon, ArrowCounterClockwiseIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import { archiveWithUndo, useSetArchived, visibleItems } from '../../lib/archive';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { CategoryTree } from '../tree/CategoryTree';
import { categoryTree } from '../tree/category-tree';
import { confirmDestructive } from '../dialogs/confirm-destructive';
import { EmptyState } from '../feedback/EmptyState';
import { ListSkeleton } from '../feedback/Skeletons';
import { ShowArchivedSwitch } from '../filters/ShowArchivedSwitch';
import { openFormPanel } from '../panels/panels';
import { ArchivedBadge } from '../items/ItemBadge';
import { useReorderSettingsItems } from './settings-api';
import { SettingsItemForm, type SettingsItem, type SettingsItemKind, type SettingsItemValues } from './SettingsItemForm';
import { SettingsSection } from './SettingsSection';
import { ActionButton } from '../actions/ActionButton';

interface SettingsListProps<C extends SettingsItem, E extends object> extends SettingsItemKind<C, E> {
  title: string;
  description: ReactNode;
  /** « le statut », « la catégorie »: in the messages (a noun after « la » agrees in the feminine: « archivée »). */
  noun: string;
  items: readonly C[];
  /** A tree: items under others, moved under another by drag and drop. Optional. Default = false. */
  nested?: boolean;
  /** Number of rows of each item. Optional. */
  usage?: ReadonlyMap<string, number>;
  /** What the rows are, in the deletion message (« tâches »). Optional. */
  usageNoun?: string;
  /** Deletes an item. */
  remove: (id: string) => Promise<unknown>;
  /** Puts an item under a parent (null: top level) at an index among its siblings; none: the order of the list is saved as is. Optional. */
  move?: (id: string, parentId: string | null, index: number) => Promise<unknown>;
  /** Badges after the name. Optional. */
  renderBadges?: (item: C) => ReactNode;
  /** Deletion message, instead of the default one. Optional. */
  deleteMessage?: (item: C, path: string) => ReactNode;
  /** Key remembering the folded items of a tree in this browser. Optional. */
  storageKey?: string;
  /** Buttons of a row of the list of its own (export…), before the common ones. Optional. */
  renderActions?: (item: C) => ReactNode;
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
 * panel, archived or restored (with an undo), deleted once confirmed, reordered — and in a tree put under another — by
 * drag and drop. Archived items are hidden behind « Afficher les archivés » (shown when there are some), with their
 * badge, read only (neither edited nor moved, nor given sub-items).
 * @param {SettingsListProps<C, E>} props Component props.
 * @returns {JSX.Element} List.
 */
export function SettingsList<C extends SettingsItem, E extends object = Record<string, never>>({
  kind,
  title,
  description,
  noun,
  items,
  nested = false,
  withColor = true,
  colorRequired,
  namePlaceholder,
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
  storageKey,
  renderActions,
  headerActions,
  undeletable,
  loading = false,
  withParent = true,
  canMove,
  adderRef,
}: SettingsListProps<C, E>) {
  const reorder = useReorderSettingsItems();
  const setArchived = useSetArchived(kind);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = items.filter((item) => item.archived).length;
  const shown = visibleItems(items, showArchived);
  const feminine = noun.startsWith('la ');

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
        withParent={withParent}
        initial={initial}
        withColor={withColor}
        colorRequired={colorRequired}
        namePlaceholder={namePlaceholder}
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
    const onError = onMutationError;
    // The index is among the siblings shown: the archived ones hidden keep their place among all of them.
    const order = categoryTree(items)
      .map(({ category }) => category)
      .filter((other) => other.id !== id);
    const siblings = order.filter((other) => (other.parentId ?? null) === parentId);
    const shownSiblings = siblings.filter((other) => showArchived || !other.archived);
    const before = shownSiblings[index];
    const last = shownSiblings[shownSiblings.length - 1];
    const fullIndex = before ? siblings.indexOf(before) : last ? siblings.indexOf(last) + 1 : 0;
    if (move) {
      move(id, parentId, fullIndex).catch(onError);
      return;
    }
    const ids = order.map((other) => other.id);
    ids.splice(before ? ids.indexOf(before.id) : last ? ids.indexOf(last.id) + 1 : 0, 0, id);
    reorder.mutate({ kind, ids }, { onError });
  };

  /**
   * Archives or restores an item, told with an undo.
   * @param {C} item Item.
   * @param {string} path Its full name.
   * @returns {void}
   */
  const toggleArchived = (item: C, path: string) => {
    void archiveWithUndo(setArchived, { ids: [item.id], archived: !item.archived, label: `« ${path} »`, feminine });
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
        <Text size="sm">
          {deleteMessage?.(item, path) ?? (
            <>
              « {path} » sera supprimé définitivement{used && usageNoun ? ` et retiré des ${used} ${usageNoun} qui l’utilisent` : ''}.{nested ? ' Ses sous-éléments remonteront d’un niveau.' : ''}{' '}
              Cette action est irréversible.
            </>
          )}
        </Text>
      ),
      onConfirm: () => {
        remove(item.id).then(() => notifySuccess(`« ${path} » supprimé.`), onMutationError);
      },
    });
  };

  return (
    <SettingsSection
      title={title}
      description={description}
      actions={
        <>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            <ShowArchivedSwitch checked={showArchived} onChange={setShowArchived} count={archivedCount} />
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
              {nested && !category.archived && (
                <Tooltip label="Ajouter un sous-élément">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter un sous-élément à ${path}`} onClick={() => openForm({ parentId: category.id })}>
                    <PlusIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              )}
              {!category.archived && (
                <Tooltip label="Modifier">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${path}`} onClick={() => openForm({ item: category })}>
                    <PencilSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label={category.archived ? 'Restaurer' : 'Archiver'}>
                <ActionIcon variant="subtle" color="gray" aria-label={`${category.archived ? 'Restaurer' : 'Archiver'} ${path}`} onClick={() => toggleArchived(category, path)}>
                  {category.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label={undeletable?.(category) ?? 'Supprimer'}>
                <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${path}`} disabled={Boolean(undeletable?.(category))} onClick={() => confirmDelete(category, path)}>
                  <TrashIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
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
