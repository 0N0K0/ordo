import { ActionIcon, Button, Group, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { CategoryTree } from '../tree/CategoryTree';
import { categoryTree } from '../tree/category-tree';
import { confirmDestructive } from '../dialogs/confirm-destructive';
import { EmptyState } from '../feedback/EmptyState';
import { ListSkeleton } from '../feedback/Skeletons';
import { openFormPanel } from '../panels/panels';
import { useReorderSettingsItems, type SettingsListKind } from './settings-api';
import { SettingsItemForm, type SettingsItem, type SettingsItemExtra, type SettingsItemValues } from './SettingsItemForm';
import { SettingsSection } from './SettingsSection';

interface SettingsListProps<C extends SettingsItem, E extends object> {
  kind: SettingsListKind;
  title: string;
  description: ReactNode;
  /** « le statut », « la catégorie »: in the messages. */
  noun: string;
  items: readonly C[];
  /** A tree: items under others, moved under another by drag and drop. Optional. Default = false. */
  nested?: boolean;
  /** Items have a color (none: their image or initials alone). Optional. Default = true. */
  withColor?: boolean;
  /** A color is required (else, in a tree, the one of its parent). Optional. Default = true for a flat list. */
  colorRequired?: boolean;
  /** Number of rows of each item. Optional. */
  usage?: ReadonlyMap<string, number>;
  /** What the rows are, in the deletion message (« tâches »). Optional. */
  usageNoun?: string;
  /** Rule of the form values (zod, `@ordo/shared`). */
  schema: Parameters<typeof SettingsItemForm>[0]['schema'];
  /** Fields of the list of its own, in the form. Optional. */
  extra?: SettingsItemExtra<C, E>;
  /** Saves a new item, gives its id. */
  create: (values: SettingsItemValues<E>) => Promise<string>;
  /** Saves an item edited. */
  update: (id: string, values: SettingsItemValues<E>) => Promise<unknown>;
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
 * panel, deleted once confirmed, reordered — and in a tree put under another — by drag and drop.
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
    if (move) {
      move(id, parentId, index).catch(onError);
      return;
    }
    const ids = categoryTree(items)
      .map(({ category }) => category.id)
      .filter((other) => other !== id);
    ids.splice(index, 0, id);
    reorder.mutate({ kind, ids }, { onError });
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
            {headerActions}
            <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
              Ajouter
            </Button>
          </Group>
        </>
      }
    >
      {loading ? (
        <ListSkeleton items={3} />
      ) : items.length === 0 ? (
        <Group gap="sm">
          <ThemeIcon variant="light" color="gray" radius="xl">
            <TagIcon aria-hidden />
          </ThemeIcon>
          <EmptyState compact message="Aucun élément pour le moment." />
        </Group>
      ) : (
        <CategoryTree
          categories={items}
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
          renderBadges={renderBadges}
          renderActions={({ category, path }) => (
            <>
              {renderActions?.(category)}
              {nested && (
                <Tooltip label="Ajouter un sous-élément">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter un sous-élément à ${path}`} onClick={() => openForm({ parentId: category.id })}>
                    <PlusIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Modifier">
                <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${path}`} onClick={() => openForm({ item: category })}>
                  <PencilSimpleIcon aria-hidden />
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
          canMove={
            canMove
              ? (id, parentId) => {
                  const item = items.find((other) => other.id === id);
                  return !item || canMove(item, parentId);
                }
              : undefined
          }
        />
      )}
    </SettingsSection>
  );
}
