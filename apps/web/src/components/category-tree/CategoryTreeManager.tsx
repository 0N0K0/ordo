import { confirmDestructive } from '../dialogs/confirm-destructive';
import { closePanel, openPanel } from '../panels/panels';
import { ActionIcon, Button, Group, Paper, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { CategoryTree } from './CategoryTree';
import type { TreeCategory } from './category-tree';

let modalCount = 0;

export interface CategoryTreeManagerProps<C extends TreeCategory> {
  title?: string;
  description: string;
  categories: C[];
  /** Number of rows of each category. */
  usage: Map<string, number>;
  /** What the rows are, in the deletion message ("produit(s)"). */
  usageNoun: string;
  /** Form of a category: the one edited, or a new one under a parent. */
  renderForm: (props: { category?: C; parentId?: string | null; onDone: () => void }) => ReactNode;
  /** Extra badges of a row. Optional. */
  renderBadges?: (category: C) => ReactNode;
  /** Puts a category under a parent (null: top level) at an index among its siblings. */
  onMove: (id: string, parentId: string | null, index: number) => void;
  /** Key remembering the folded categories in this browser. Optional. */
  storageKey?: string;
  /** Deletion message, instead of the default one (sub-categories go one level up). Optional. */
  deleteMessage?: (category: C, path: string) => ReactNode;
  /** Deletes a category. */
  onDelete: (id: string) => void;
}

/**
 * Categories as a tree: add a category or a sub-category, edit, delete, fold the sub-categories, reorder or put one
 * under another by drag and drop.
 * @param {CategoryTreeManagerProps<C>} props Component props.
 * @returns {JSX.Element} Manager.
 */
export function CategoryTreeManager<C extends TreeCategory>({
  title = 'Catégories',
  description,
  categories,
  usage,
  usageNoun,
  renderForm,
  renderBadges,
  onMove,
  onDelete,
  storageKey,
  deleteMessage,
}: CategoryTreeManagerProps<C>) {
  /**
   * Opens the category form.
   * @param {{ category?: C, parentId?: string | null }} [options] Category edited, or parent of a new one. Optional.
   * @returns {void}
   */
  const openForm = ({ category, parentId }: { category?: C; parentId?: string | null } = {}) => {
    const modalId = `category-tree-${++modalCount}`;
    openPanel({
      panelId: modalId,
      title: category ? 'Modifier la catégorie' : parentId ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie',
      children: renderForm({ category, parentId, onDone: () => closePanel(modalId) }),
    });
  };

  /**
   * Asks for confirmation before deleting a category.
   * @param {C} category Category.
   * @param {string} path Its full name.
   * @returns {void}
   */
  const confirmDelete = (category: C, path: string) => {
    const used = usage.get(category.id) ?? 0;
    confirmDestructive({
      title: 'Supprimer la catégorie',
      risks: (
        <>
          <Text size="sm">
            {deleteMessage?.(category, path) ?? (
              <>
                « {path} » sera supprimée définitivement.{used ? ` Ses ${used} ${usageNoun} n’auront plus de catégorie.` : ''} Ses sous-catégories remonteront d’un niveau. Cette action est
                irréversible.
              </>
            )}
          </Text>
        </>
      ),
      onConfirm: () => {
        onDelete(category.id);
      },
    });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              {title}
            </Title>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Ajouter
          </Button>
        </Group>
        {categories.length === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <TagIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucune catégorie pour le moment.
            </Text>
          </Group>
        ) : (
          <CategoryTree
            categories={categories}
            storageKey={storageKey}
            renderMeta={({ category }) => (
              <Text size="xs" c="dimmed">
                {usage.get(category.id) || ''}
              </Text>
            )}
            renderBadges={renderBadges}
            renderActions={({ category, path }) => (
              <>
                <Tooltip label="Ajouter une sous-catégorie">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter une sous-catégorie à ${path}`} onClick={() => openForm({ parentId: category.id })}>
                    <PlusIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Modifier">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${path}`} onClick={() => openForm({ category })}>
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
            onMove={onMove}
          />
        )}
      </Stack>
    </Paper>
  );
}
