import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { notifyError } from '../../../lib/notify';
import { useTaskViewMutations, useTaskViews, type TaskViewRecord, type ViewKind } from '../api';

/** Saved view with its configuration parsed. */
export interface SavedView<C> extends Omit<TaskViewRecord, 'config'> {
  config: C;
}

/**
 * JSON with sorted object keys, to compare configurations regardless of key order.
 * @param {unknown} value Value.
 * @returns {string} Canonical JSON.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
}

interface SavedViewsOptions<C> {
  /** Project, or null for the page. */
  projectId: string | null;
  /** Tasks, routines, shopping lists or another table. */
  kind: ViewKind;
  /** Table of the views of kind TABLE. Optional. */
  tableKey?: string | null;
  /** Configuration of a stored view (the defaults when it is invalid). */
  parse: (config: unknown) => C;
  /** Configuration of a new blank view. */
  blank: () => C;
  /** Views made when the scope has none, the first one opened by default. */
  first: () => { name: string; config: C }[];
  /** Whether the first views can be made (what they start with is known). Optional. Default = true. */
  ready?: boolean;
  /** URL parameter of the selected view. Optional. Default = 'view'. */
  param?: string;
}

/**
 * Saved views of a scope (the tasks or the routines of a project's tab, or of their page) and the working copy of
 * the current one. The selected view is kept in the URL (?view=, or the parameter given); each view keeps its unsaved changes while switching
 * tabs. First views are made when the scope has none.
 * @param {SavedViewsOptions<C>} options Scope and configurations.
 * @returns {object} Views, current view, its working configuration and the view actions.
 */
export function useSavedViews<C>({ projectId, kind, tableKey = null, parse, blank, first, ready = true, param = 'view' }: SavedViewsOptions<C>) {
  const viewsQuery = useTaskViews(projectId, kind, tableKey);
  const mutations = useTaskViewMutations();
  const [params, setParams] = useSearchParams();
  const [drafts, setDrafts] = useState<Record<string, C>>({});
  // Scope whose first views were asked for: asked once only, even when it fails (no retry loop).
  const created = useRef<string | null>(null);

  const views: SavedView<C>[] = useMemo(() => [...(viewsQuery.data ?? [])].sort((a, b) => a.position - b.position).map((view) => ({ ...view, config: parse(view.config) })), [viewsQuery.data, parse]);

  const requestedId = params.get(param);
  const current = views.find((view) => view.id === requestedId) ?? views.find((view) => view.isDefault) ?? views[0];
  const config = current ? (drafts[current.id] ?? current.config) : null;
  const dirty = Boolean(current && drafts[current.id] && canonical(drafts[current.id]) !== canonical(current.config));

  // The first visit makes the first views so there is always a tab (one after the other: in their order).
  const createAsync = mutations.create.mutateAsync;
  useEffect(() => {
    const scope = `${kind}:${tableKey ?? ''}:${projectId ?? ''}`;
    if (!viewsQuery.isSuccess || !ready || views.length > 0 || created.current === scope) return;
    created.current = scope;
    void (async () => {
      for (const view of first()) await createAsync({ name: view.name, config: view.config, projectId, kind, tableKey });
    })().catch((error: Error) => notifyError(error.message));
  }, [viewsQuery.isSuccess, ready, views.length, createAsync, projectId, kind, tableKey, first]);

  /**
   * Selects a view (kept in the URL).
   * @param {string} id View id.
   * @returns {void}
   */
  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set(param, id);
    setParams(next, { replace: true });
  };

  /**
   * Drops the working copy of a view.
   * @param {string} id View id.
   * @returns {void}
   */
  const discard = (id: string) => setDrafts(({ [id]: _dropped, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars

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
     * @param {(config: C) => C} change Update.
     * @returns {void}
     */
    change: (change: (config: C) => C) => {
      if (!current || !config) return;
      setDrafts((all) => ({ ...all, [current.id]: change(all[current.id] ?? current.config) }));
    },

    /**
     * Saves the working configuration into the current view.
     * @returns {void}
     */
    save: () => {
      if (!current || !config) return;
      mutations.update.mutate({ id: current.id, input: { config } }, { onSuccess: () => discard(current.id), onError: (error) => notifyError(error.message) });
    },

    /**
     * Drops the unsaved changes of the current view.
     * @returns {void}
     */
    revert: () => current && discard(current.id),

    /**
     * Creates a view, from the working configuration or a blank one, and opens it.
     * @param {string} name View name.
     * @param {boolean} fromCurrent Whether to start from the current working configuration.
     * @returns {void}
     */
    createView: (name: string, fromCurrent: boolean) =>
      mutations.create.mutate(
        { name, config: fromCurrent && config ? config : blank(), projectId, kind, tableKey },
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
    rename: (id: string, name: string) => mutations.update.mutate({ id, input: { name } }, { onError: (error) => notifyError(error.message) }),

    /**
     * Duplicates a view (saved configuration) and opens the copy.
     * @param {SavedView<C>} view View.
     * @returns {void}
     */
    duplicate: (view: SavedView<C>) =>
      mutations.duplicate.mutate({ id: view.id, name: `${view.name} (copie)`.slice(0, 60) }, { onSuccess: (copy) => select(copy.id), onError: (error) => notifyError(error.message) }),

    /**
     * Deletes a view.
     * @param {SavedView<C>} view View.
     * @returns {void}
     */
    remove: (view: SavedView<C>) =>
      mutations.remove.mutate(
        { id: view.id },
        {
          onSuccess: () => {
            discard(view.id);
            if (view.id === current?.id) {
              const next = new URLSearchParams(params);
              next.delete(param);
              setParams(next, { replace: true });
            }
          },
          onError: (error) => notifyError(error.message),
        },
      ),

    /**
     * Makes a view the one opened by default.
     * @param {SavedView<C>} view View.
     * @returns {void}
     */
    setDefault: (view: SavedView<C>) => mutations.setDefault.mutate({ id: view.id }, { onError: (error) => notifyError(error.message) }),

    /**
     * Moves a view tab.
     * @param {string} id View id.
     * @param {number} index Target index.
     * @returns {void}
     */
    move: (id: string, index: number) => mutations.move.mutate({ id, index }, { onError: (error) => notifyError(error.message) }),
  };
}

export type SavedViewsState<C> = ReturnType<typeof useSavedViews<C>>;
