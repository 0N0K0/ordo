import { calendarCategoryFormSchema } from '@ordo/shared';
import { categorySubtree } from '../../components/category-tree/category-tree';
import { listMutations } from '../../components/settings/settings-api';
import { SettingsList } from '../../components/settings/SettingsList';
import { useCalendarCategories, useCalendarCategoryMutations } from './api';

/**
 * Settings of the calendar categories, as every settings list, in a tree: added (also as a sub-category), edited
 * (name, color, image, parent), reordered and put under another by drag and drop, deleted with their sub-categories.
 * @returns {JSX.Element} Manager.
 */
export function CalendarCategoriesManager() {
  const { data: categories, isPending } = useCalendarCategories();
  const { create, update, remove, move } = useCalendarCategoryMutations();
  const items = categories ?? [];
  /**
   * Input of a category from the form values.
   * @param {{ name: string, color: string, parentId: string | null }} values Values.
   * @returns {{ name: string, color: string, parentId: string | null }} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null }) => ({ name: values.name, color: values.color, parentId: values.parentId });
  const { create: add, update: save } = listMutations({ create, update, remove: { mutateAsync: async () => undefined } }, input);
  return (
    <SettingsList
      kind="CALENDAR_CATEGORY"
      nested
      colorRequired
      title="Catégories d’agenda"
      description="Classent les évènements, en arborescence. Filtrer l’agenda sur une catégorie inclut ses sous-catégories."
      noun="la catégorie"
      items={items}
      loading={isPending}
      storageKey="calendar-categories"
      schema={calendarCategoryFormSchema}
      create={add}
      update={save}
      remove={(id) => remove.mutateAsync(id)}
      move={(id, parentId, index) => move.mutateAsync({ id, parentId, index })}
      deleteMessage={(category, path) => {
        const subCount = categorySubtree(items, category.id).size - 1;
        return (
          <>
            La catégorie « {path} »{subCount > 0 ? ` et ses ${subCount} sous-catégorie${subCount > 1 ? 's' : ''}` : ''} seront supprimées définitivement et retirées des évènements (qui sont
            conservés). Cette action est irréversible.
          </>
        );
      }}
    />
  );
}
