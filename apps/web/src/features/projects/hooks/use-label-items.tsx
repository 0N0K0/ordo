import { labelFormSchema } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import {
  useCreateProjectCategory,
  useCreateProjectStatus,
  useDeleteProjectCategory,
  useDeleteProjectStatus,
  useUpdateProjectCategory,
  useUpdateProjectStatus,
  type ProjectCategory,
  type ProjectStatus,
} from '../api';

/** Deletion of an item of a list, besides its form (the settings list deletes it). */
type WithRemove = { remove: (id: string) => Promise<unknown> };

/**
 * Statuses of the projects, for their settings list and their form (a creation from a select too): label, color and image.
 * @returns {SettingsItemKind<ProjectStatus> & WithRemove} List and form, and the deletion.
 */
export function useProjectStatusItems(): SettingsItemKind<ProjectStatus> & WithRemove {
  const create = useCreateProjectStatus();
  const update = useUpdateProjectStatus();
  const remove = useDeleteProjectStatus();
  return { kind: 'PROJECT_STATUS', schema: labelFormSchema, ...listMutations({ create, update, remove }) };
}

/**
 * Categories of the projects, for their settings list and their form (a creation from a select too): label, color and image.
 * @returns {SettingsItemKind<ProjectCategory> & WithRemove} List and form, and the deletion.
 */
export function useProjectCategoryItems(): SettingsItemKind<ProjectCategory> & WithRemove {
  const create = useCreateProjectCategory();
  const update = useUpdateProjectCategory();
  const remove = useDeleteProjectCategory();
  return { kind: 'PROJECT_CATEGORY', schema: labelFormSchema, ...listMutations({ create, update, remove }) };
}
