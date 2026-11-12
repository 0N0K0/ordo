import { Button, ColorInput, Group, Select, Stack, TextInput } from '@mantine/core';
import { routineCategorySchema } from '@ordo/shared';
import { CategoryTreeManager } from '../../components/category-tree/CategoryTreeManager';
import { categoryOptions, categoryTree } from '../../components/category-tree/category-tree';
import { PageSettings } from '../../layouts/PageSettings';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useRoutineMutations, useRoutinesData, type RoutineCategory } from './api';

interface CategoryFormProps {
  categories: RoutineCategory[];
  category?: RoutineCategory;
  parentId?: string | null;
  onDone: () => void;
}

/**
 * Category of routines: name, color (the one of its parent by default) and parent category.
 * @param {CategoryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function CategoryForm({ categories, category, parentId = null, onDone }: CategoryFormProps) {
  const { createCategory, updateCategory } = useRoutineMutations();
  const swatches = useColorSwatches();
  const parentColor = parentId ? categoryTree(categories).find((item) => item.category.id === parentId)?.color : null;
  const form = useAppForm<{ name: string; color: string; parentId: string | null }>({
    initialValues: {
      name: category?.name ?? '',
      color: category ? (category.color ?? '') : (parentColor ?? swatches[0]),
      parentId: category ? (category.parentId ?? null) : parentId,
    },
    schema: routineCategorySchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const input = { ...values, color: values.color || null };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(category ? 'Catégorie modifiée.' : 'Catégorie créée.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (category) updateCategory.mutate({ id: category.id, input }, callbacks);
    else createCategory.mutate(input, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <ColorInput label="Couleur" format="hex" swatches={swatches} swatchesPerRow={9} {...form.getInputProps('color')} />
        <Select label="Catégorie parente" placeholder="Aucune (catégorie principale)" clearable searchable data={categoryOptions(categories, category?.id)} {...form.getInputProps('parentId')} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createCategory.isPending || updateCategory.isPending}>
            {category ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Settings of the routines page: the categories, as a tree.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function RoutineSettings() {
  const { data } = useRoutinesData();
  const { moveCategory, deleteCategory } = useRoutineMutations();
  const categories = data?.routineCategories ?? [];
  const usage = new Map<string, number>();
  for (const routine of data?.routines ?? []) if (routine.categoryId) usage.set(routine.categoryId, (usage.get(routine.categoryId) ?? 0) + 1);
  return (
    <PageSettings title="Paramètres des routines">
      <Stack gap="md">
        <CategoryTreeManager
          description="Classent les routines, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente."
          categories={categories}
          usage={usage}
          usageNoun="routine(s)"
          renderForm={(props) => <CategoryForm categories={categories} {...props} />}
          onMove={(id, parentId) => moveCategory.mutate({ id, parentId }, { onError: (error) => notifyError(error.message) })}
          onDelete={(id) => deleteCategory.mutate(id, { onSuccess: () => notifySuccess('Catégorie supprimée.'), onError: (error) => notifyError(error.message) })}
        />
      </Stack>
    </PageSettings>
  );
}
