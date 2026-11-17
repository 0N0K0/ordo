import { ActionIcon, Button, Group, Paper, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { CategoryTree } from '../category-tree/CategoryTree';
import { categoryTree } from '../category-tree/category-tree';
import { confirmDestructive } from '../dialogs/confirm-destructive';
import { EmptyState } from '../feedback/EmptyState';
import { closePanel, openPanel } from '../panels/panels';
import { useReorderSettingsItems, type SettingsListKind } from './settings-api';
import { SettingsItemForm, type SettingsItem, type SettingsItemExtra, type SettingsItemValues } from './SettingsItemForm';

let panelCount = 0;

export interface SettingsListProps<C extends SettingsItem, E extends Record<string, unknown>> {
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
}

/**
 * Settings list, flat or tree (every one of the app): each item with its avatar (its image, or its initials on its
 * color), its name and number of uses; added, edited (name, color, image, parent, fields of the list) in the side
 * panel, deleted once confirmed, reordered — and in a tree put under another — by drag and drop.
 * @param {SettingsListProps<C, E>} props Component props.
 * @returns {JSX.Element} List.
 */
export function SettingsList<C extends SettingsItem, E extends Record<string, unknown> = Record<string, never>>({
  kind,
  title,
  description,
  noun,
  items,
  nested = false,
  withColor = true,
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
}: SettingsListProps<C, E>) {
  const reorder = useReorderSettingsItems();

  /**
   * Opens the form of an item in the side panel.
   * @param {{ item?: C, parentId?: string | null }} [options] Item edited, or parent of a new one. Optional.
   * @returns {void}
   */
  const openForm = ({ item, parentId }: { item?: C; parentId?: string | null } = {}) => {
    const panelId = `settings-list-${++panelCount}`;
    openPanel({
      panelId,
      title: item ? `Modifier ${noun}` : `Ajouter ${noun}`,
      children: (
        <SettingsItemForm<C, E>
          kind={kind}
          item={item}
          parentId={parentId}
          tree={nested ? items : undefined}
          withColor={withColor}
          schema={schema}
          extra={extra}
          create={create}
          update={update}
          onDone={() => closePanel(panelId)}
        />
      ),
    });
  };

  /**
   * Moves an item: with the move of its list, else by saving the new order of the flat list.
   * @param {string} id Item.
   * @param {string | null} parentId New parent.
   * @param {number} index Index among its new siblings.
   * @returns {void}
   */
  const handleMove = (id: string, parentId: string | null, index: number) => {
    const onError = (error: Error) => notifyError(error.message);
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
        remove(item.id).then(
          () => notifySuccess(`« ${path} » supprimé.`),
          (error: Error) => notifyError(error.message),
        );
      },
    });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4}>
            <Title order={2} size="h4">
              {title}
            </Title>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} style={{ flexShrink: 0 }}>
            Ajouter
          </Button>
        </Group>
        {items.length === 0 ? (
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
                <Tooltip label="Supprimer">
                  <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${path}`} onClick={() => confirmDelete(category, path)}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
            onMove={handleMove}
          />
        )}
      </Stack>
    </Paper>
  );
}
