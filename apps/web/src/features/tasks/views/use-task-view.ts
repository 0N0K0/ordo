import { defaultTaskViewConfig, taskViewConfigSchema, type TaskViewConfig } from '@ordo/shared';
import { useTaskColumnDefaults } from '../api';
import { useSavedViews, type SavedView } from './use-saved-views';

export type TaskView = SavedView<TaskViewConfig>;

/**
 * Parses a stored view configuration, falling back to the defaults when it is invalid.
 * @param {unknown} config Stored configuration.
 * @returns {TaskViewConfig} Configuration.
 */
function parseConfig(config: unknown): TaskViewConfig {
  const result = taskViewConfigSchema.safeParse(config);
  return result.success ? result.data : defaultTaskViewConfig();
}

/**
 * Saved task views of a scope (a project's task tab or the home page) and the working copy of the current one; a
 * "Toutes les tâches" view is made when the scope has none, with the columns of the workspace.
 * @param {string | null} projectId Project, or null for the home page.
 * @returns {object} Views, current view, its working configuration and the view actions.
 */
export function useTaskView(projectId: string | null) {
  // Columns new views start with: those chosen for the workspace.
  const columnsQuery = useTaskColumnDefaults();
  const columnDefaults = columnsQuery.data;
  return useSavedViews<TaskViewConfig>({
    projectId,
    kind: 'TASKS',
    parse: parseConfig,
    blank: () => defaultTaskViewConfig(columnDefaults),
    first: () => [{ name: 'Toutes les tâches', config: defaultTaskViewConfig(columnDefaults) }],
    // The first view waits for the columns of the workspace (the app's if they cannot be read).
    ready: !columnsQuery.isPending,
  });
}

export type TaskViewState = ReturnType<typeof useTaskView>;
