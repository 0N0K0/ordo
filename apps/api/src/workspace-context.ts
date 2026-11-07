import { AsyncLocalStorage } from 'node:async_hooks';
import type { WorkspaceKind } from './generated/prisma/enums';

/** Workspace a request (or a background job) works in. */
export interface WorkspaceScope {
  id: string;
  kind: WorkspaceKind;
}

const storage = new AsyncLocalStorage<WorkspaceScope>();

/**
 * Runs a function in a workspace: every query on the workspace data it makes (even later, in its promises) is
 * limited to that workspace, and the rows it creates belong to it.
 * @template T
 * @param {WorkspaceScope} workspace Workspace.
 * @param {() => T} fn Function.
 * @returns {T} Result of the function.
 */
export function runInWorkspace<T>(workspace: WorkspaceScope, fn: () => T): T {
  return storage.run({ id: workspace.id, kind: workspace.kind }, () => {
    const result = fn();
    // Prisma queries are lazy (they run when awaited): one returned as is is started here, in the workspace.
    if (result !== null && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
      const thenable = result as PromiseLike<unknown>;
      return new Promise((resolve, reject) => thenable.then(resolve, reject)) as T;
    }
    return result;
  });
}

/**
 * Workspace of the current request or job, if any.
 * @returns {WorkspaceScope | undefined} Workspace.
 */
export function maybeWorkspace(): WorkspaceScope | undefined {
  return storage.getStore();
}

/**
 * Workspace of the current request or job.
 * @returns {WorkspaceScope} Workspace.
 * @throws {Error} Outside a workspace: no query on the workspace data may run there.
 */
export function currentWorkspace(): WorkspaceScope {
  const workspace = storage.getStore();
  if (!workspace) throw new Error('No workspace: the workspace data can only be read and written in one.');
  return workspace;
}

/**
 * Id of the workspace of the current request or job.
 * @returns {string} Id.
 */
export function currentWorkspaceId(): string {
  return currentWorkspace().id;
}

/**
 * Enters a workspace for the rest of the current execution (scripts: seed, command line).
 * @param {WorkspaceScope} workspace Workspace.
 * @returns {void}
 */
export function enterWorkspace(workspace: WorkspaceScope): void {
  storage.enterWith({ id: workspace.id, kind: workspace.kind });
}
