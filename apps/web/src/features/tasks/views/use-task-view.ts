import { defaultTaskViewConfig, taskViewConfigSchema, type TaskViewConfig } from '@ordo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { notifyError } from '../../../lib/notify';
import { useTaskViewMutations, useTaskViews, type TaskViewRecord } from '../api';

export interface TaskView extends Omit<TaskViewRecord, 'config'> {
  config: TaskViewConfig;
}

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
 * JSON with sorted object keys, to compare configurations regardless of key order.
 * @param {unknown} value Value.
 * @returns {string} Canonical JSON.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

/**
 * Saved views of a scope (a project's task tab or the home page) and the working copy of the current one.
 * The selected view is kept in the URL (?view=); each view keeps its unsaved changes while switching
 * tabs. A first view is created when the scope has none.
 * @param {string | null} projectId Project, or null for the home page.
 * @returns {object} Views, current view, its working configuration and the view actions.
 */
export function useTaskView(projectId: string | null) {
  const viewsQuery = useTaskViews(projectId);
  const mutations = useTaskViewMutations();
  const [params, setParams] = useSearchParams();
  const [drafts, setDrafts] = useState<Record<string, TaskViewConfig>>({});
  // Scope whose first view was asked for: asked once only, even when it fails (no retry loop).
  const created = useRef<string | null>(null);

  const views: TaskView[] = useMemo(
    () =>
      [...(viewsQuery.data ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((view) => ({ ...view, config: parseConfig(view.config) })),
    [viewsQuery.data],
  );

  const requestedId = params.get('view');
  const current = views.find((view) => view.id === requestedId) ?? views.find((view) => view.isDefault) ?? views[0];
  const config = current ? (drafts[current.id] ?? current.config) : null;
  const dirty = Boolean(current && drafts[current.id] && canonical(drafts[current.id]) !== canonical(current.config));

  // The first visit creates a "Toutes les tâches" view so there is always a tab.
  const { create } = mutations;
  useEffect(() => {
    const scope = projectId ?? '';
    if (!viewsQuery.isSuccess || views.length > 0 || created.current === scope) return;
    created.current = scope;
    create.mutate(
      { name: 'Toutes les tâches', config: defaultTaskViewConfig(), projectId },
      { onError: (error) => notifyError(error.message) },
    );
  }, [viewsQuery.isSuccess, views.length, create, projectId]);

  /**
   * Selects a view (kept in the URL).
   * @param {string} id View id.
   * @returns {void}
   */
  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('view', id);
    setParams(next, { replace: true });
  };

  /**
   * Drops the working copy of a view.
   * @param {string} id View id.
   * @returns {void}
   */
  const discard = (id: string) =>
    setDrafts(({ [id]: _dropped, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars

  return {
    views,
    current,
    config,
    dirty,
    isPending: viewsQuery.isPending,
    error: viewsQuery.error,
    select,

    /**
     * Changes the working configuration of the current view.
     * @param {(config: TaskViewConfig) => TaskViewConfig} change Update.
     * @returns {void}
     */
    change: (change: (config: TaskViewConfig) => TaskViewConfig) => {
      if (!current || !config) return;
      setDrafts((all) => ({ ...all, [current.id]: change(all[current.id] ?? current.config) }));
    },

    /**
     * Saves the working configuration into the current view.
     * @returns {void}
     */
    save: () => {
      if (!current || !config) return;
      mutations.update.mutate(
        { id: current.id, input: { config } },
        { onSuccess: () => discard(current.id), onError: (error) => notifyError(error.message) },
      );
    },

    /**
     * Drops the unsaved changes of the current view.
     * @returns {void}
     */
    revert: () => current && discard(current.id),

    /**
     * Creates a view, from the working configuration or the defaults, and opens it.
     * @param {string} name View name.
     * @param {boolean} fromCurrent Whether to start from the current working configuration.
     * @returns {void}
     */
    createView: (name: string, fromCurrent: boolean) =>
      mutations.create.mutate(
        { name, config: fromCurrent && config ? config : defaultTaskViewConfig(), projectId },
        {
          onSuccess: (view) => {
            if (fromCurrent && current) discard(current.id);
            select(view.id);
          },
          onError: (error) => notifyError(error.message),
        },
      ),

    /**
     * Renames a view.
     * @param {string} id View id.
     * @param {string} name New name.
     * @returns {void}
     */
    rename: (id: string, name: string) =>
      mutations.update.mutate({ id, input: { name } }, { onError: (error) => notifyError(error.message) }),

    /**
     * Duplicates a view (saved configuration) and opens the copy.
     * @param {TaskView} view View.
     * @returns {void}
     */
    duplicate: (view: TaskView) =>
      mutations.duplicate.mutate(
        { id: view.id, name: `${view.name} (copie)`.slice(0, 60) },
        { onSuccess: (copy) => select(copy.id), onError: (error) => notifyError(error.message) },
      ),

    /**
     * Deletes a view.
     * @param {TaskView} view View.
     * @returns {void}
     */
    remove: (view: TaskView) =>
      mutations.remove.mutate(
        { id: view.id },
        {
          onSuccess: () => {
            discard(view.id);
            if (view.id === current?.id) {
              const next = new URLSearchParams(params);
              next.delete('view');
              setParams(next, { replace: true });
            }
          },
          onError: (error) => notifyError(error.message),
        },
      ),

    /**
     * Makes a view the one opened by default.
     * @param {TaskView} view View.
     * @returns {void}
     */
    setDefault: (view: TaskView) =>
      mutations.setDefault.mutate({ id: view.id }, { onError: (error) => notifyError(error.message) }),

    /**
     * Moves a view tab.
     * @param {string} id View id.
     * @param {number} index Target index.
     * @returns {void}
     */
    move: (id: string, index: number) =>
      mutations.move.mutate({ id, index }, { onError: (error) => notifyError(error.message) }),
  };
}

export type TaskViewState = ReturnType<typeof useTaskView>;
