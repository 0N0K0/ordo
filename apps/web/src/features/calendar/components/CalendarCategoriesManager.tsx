import { useCalendarCategoryItems } from '../hooks/use-settings-items';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useCalendarCategories, useCalendarCategoryMutations } from '../api';
import { countOf } from '../../../lib/text';

/**
 * Settings of the calendar categories, as every settings list, in a tree: added (also as a sub-category), edited
 * (name, color, image, parent), reordered and put under another by drag and drop, deleted (their sub-categories go up a level).
 * @returns {JSX.Element} Manager.
 */
export function CalendarCategoriesManager() {
  const { data: categories, isPending } = useCalendarCategories();
  const { remove, move } = useCalendarCategoryMutations();
  const kind = useCalendarCategoryItems();
  const items = categories ?? [];
  return (
    <SettingsList
      {...kind}
      nested
      title="Catégories d’agenda"
      description="Classent les évènements, en arborescence. Filtrer l’agenda sur une catégorie inclut ses sous-catégories."
      noun="la catégorie"
      items={items}
      loading={isPending}
      storageKey="calendar-categories"
      remove={(id) => remove.mutateAsync(id)}
      move={(id, parentId, index) => move.mutateAsync({ id, parentId, index })}
      deleteMessage={(category, path) => {
        const childCount = items.filter((c) => c.parentId === category.id).length;
        return (
          <>
            La catégorie « {path} » sera supprimée définitivement et retirée des évènements (qui sont conservés).
            {childCount > 0 ? ` ${childCount > 1 ? `Ses ${countOf(childCount, 'sous-catégorie')} remontent` : 'Sa sous-catégorie remonte'} d’un niveau.` : ''}
          </>
        );
      }}
    />
  );
}
