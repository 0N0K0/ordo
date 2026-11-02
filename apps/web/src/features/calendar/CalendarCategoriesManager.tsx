import { ActionIcon, Button, ColorInput, ColorSwatch, Group, Paper, Select, Skeleton, Stack, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { calendarCategoryFormSchema, type CalendarCategoryFormValues } from '@ordo/shared';
import { ArrowDownIcon, ArrowUpIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useCalendarCategories, useCalendarCategoryMutations, type CalendarCategory } from './api';
import { categoryOptions, categorySubtree, flattenCategories } from './category-tree';

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
          data={categoryOptions(categories, excluded)}
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
  const nodes = flattenCategories(categories ?? []);

  /**
   * Opens the category form.
   * @param {object} [options] Category to edit, or parent of a new one. Optional.
   * @param {CalendarCategory} [options.category] Category to edit. Optional.
   * @param {string | null} [options.parentId] Parent of a new category. Optional.
   * @returns {void}
   */
  const openForm = ({ category, parentId }: { category?: CalendarCategory; parentId?: string | null } = {}) => {
    const modalId = `calendar-category-${++modalCount}`;
    modals.open({
      modalId,
      title: category ? 'Modifier la catégorie' : parentId ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie',
      children: <CategoryForm categories={categories ?? []} category={category} parentId={parentId} onDone={() => modals.close(modalId)} />,
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
        ) : nodes.length === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <TagIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucune catégorie pour le moment.
            </Text>
          </Group>
        ) : (
          <Stack gap={4}>
            {nodes.map(({ category, depth }) => {
              const siblings = (categories ?? []).filter((item) => (item.parentId ?? null) === (category.parentId ?? null)).sort((a, b) => a.position - b.position);
              const index = siblings.findIndex((item) => item.id === category.id);
              return (
                <Group key={category.id} gap="sm" wrap="nowrap" style={{ paddingLeft: `calc(${depth} * var(--mantine-spacing-lg))` }}>
                  <ColorSwatch color={category.color} size={14} />
                  <Text size="sm" style={{ flex: 1 }} truncate>
                    {category.name}
                  </Text>
                  <Tooltip label="Ajouter une sous-catégorie">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter une sous-catégorie à ${category.name}`} onClick={() => openForm({ parentId: category.id })}>
                      <PlusIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Monter">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Monter ${category.name}`}
                      disabled={index === 0}
                      onClick={() => move.mutate({ id: category.id, index: index - 1 }, { onError: (error) => notifyError(error.message) })}
                    >
                      <ArrowUpIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Descendre">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Descendre ${category.name}`}
                      disabled={index === siblings.length - 1}
                      onClick={() => move.mutate({ id: category.id, index: index + 1 }, { onError: (error) => notifyError(error.message) })}
                    >
                      <ArrowDownIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Modifier">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${category.name}`} onClick={() => openForm({ category })}>
                      <PencilSimpleIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Supprimer">
                    <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${category.name}`} onClick={() => confirmDelete(category)}>
                      <TrashIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
