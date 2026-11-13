import { closePanel, openPanel } from '../../components/panels/panels';
import { ActionIcon, Button, ColorInput, Group, Paper, Select, Skeleton, Stack, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { calendarCategoryFormSchema, type CalendarCategoryFormValues } from '@ordo/shared';
import { PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { CategoryTree } from '../../components/category-tree/CategoryTree';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useCalendarCategories, useCalendarCategoryMutations, type CalendarCategory } from './api';
import { categoryOptions, categorySubtree } from './category-tree';
import { treeSelectProps } from '../../components/tree-select/tree-select';

let modalCount = 0;

interface CategoryFormProps {
  categories: CalendarCategory[];
  category?: CalendarCategory;
  parentId?: string | null;
  onDone: () => void;
}

/**
 * Calendar category form: name, color, parent category.
 * @param {CategoryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function CategoryForm({ categories, category, parentId, onDone }: CategoryFormProps) {
  const { create, update } = useCalendarCategoryMutations();
  const swatches = useColorSwatches();
  const form = useAppForm<CalendarCategoryFormValues>({
    initialValues: {
      name: category?.name ?? '',
      color: category?.color ?? (parentId ? (categories.find((item) => item.id === parentId)?.color ?? swatches[0]) : swatches[0]),
      parentId: category ? (category.parentId ?? null) : (parentId ?? null),
    },
    schema: calendarCategoryFormSchema,
  });
  const excluded = category ? categorySubtree(categories, category.id) : new Set<string>();

  const handleSubmit = form.onSubmit((values) => {
    const callbacks = {
      onSuccess: () => {
        notifySuccess(category ? 'Catégorie modifiée.' : 'Catégorie créée.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (category) update.mutate({ id: category.id, input: values }, callbacks);
    else create.mutate(values, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <ColorInput label="Couleur" required format="hex" swatches={swatches} swatchesPerRow={9} {...form.getInputProps('color')} />
        <Select
          label="Catégorie parente"
          placeholder="Aucune (catégorie principale)"
          clearable
          searchable
          {...treeSelectProps(categoryOptions(categories, excluded))}
          {...form.getInputProps('parentId')}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {category ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Settings of the calendar categories, in a tree: create (also as a sub-category), edit, reorder among
 * siblings, delete.
 * @returns {JSX.Element} Manager.
 */
export function CalendarCategoriesManager() {
  const { data: categories, isPending } = useCalendarCategories();
  const { remove, move } = useCalendarCategoryMutations();

  /**
   * Opens the category form.
   * @param {object} [options] Category to edit, or parent of a new one. Optional.
   * @param {CalendarCategory} [options.category] Category to edit. Optional.
   * @param {string | null} [options.parentId] Parent of a new category. Optional.
   * @returns {void}
   */
  const openForm = ({ category, parentId }: { category?: CalendarCategory; parentId?: string | null } = {}) => {
    const modalId = `calendar-category-${++modalCount}`;
    openPanel({
      panelId: modalId,
      title: category ? 'Modifier la catégorie' : parentId ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie',
      children: <CategoryForm categories={categories ?? []} category={category} parentId={parentId} onDone={() => closePanel(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a category and its sub-categories.
   * @param {CalendarCategory} category Category.
   * @returns {void}
   */
  const confirmDelete = (category: CalendarCategory) => {
    const subCount = categorySubtree(categories ?? [], category.id).size - 1;
    const modalId = `delete-calendar-category-${category.id}`;
    modals.open({
      modalId,
      title: 'Supprimer la catégorie',
      children: (
        <Stack gap="md">
          <Text size="sm">
            La catégorie « {category.name} »{subCount > 0 ? ` et ses ${subCount} sous-catégorie${subCount > 1 ? 's' : ''}` : ''} seront
            supprimées définitivement et retirées des évènements (qui sont conservés). Cette action est irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(category.id, {
                onSuccess: () => notifySuccess('Catégorie supprimée.'),
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Catégories d’agenda
            </Title>
            <Text size="sm" c="dimmed">
              Classent les évènements, en arborescence. Filtrer l’agenda sur une catégorie inclut ses sous-catégories.
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Ajouter
          </Button>
        </Group>
        {isPending ? (
          <Skeleton height={48} />
        ) : !categories?.length ? (
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
            categories={categories ?? []}
            storageKey="calendar-categories"
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
                  <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${path}`} onClick={() => confirmDelete(category)}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
            onMove={(id, parentId, index) => move.mutate({ id, parentId, index }, { onError: (error) => notifyError(error.message) })}
          />
        )}
      </Stack>
    </Paper>
  );
}
