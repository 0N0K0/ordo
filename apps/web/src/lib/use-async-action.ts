import { useState } from 'react';
import { notifyError, notifySuccess } from './notify';

interface AsyncActionOptions<T> {
  /** Success toast once done. Optional. Default = none. */
  success?: string;
  /** Error toast when the error has no message. Optional. Default = « Action impossible. ». */
  fallback?: string;
  /** Runs once done (after the success toast): closes the form, opens what was created… Optional. */
  onDone?: (result: T) => void;
}

/**
 * Action of a form sent to the server (a mutation, a download…): waits while it runs, tells its success in a toast
 * then goes on, or tells its failure in an error toast.
 * @param {() => Promise<T>} action Action.
 * @param {AsyncActionOptions<T>} [options] Toasts and what follows. Optional.
 * @returns {{ run: () => Promise<void>, loading: boolean }} The action to run, and whether it is running.
 */
export function useAsyncAction<T>(action: () => Promise<T>, { success, fallback = 'Action impossible.', onDone }: AsyncActionOptions<T> = {}): { run: () => Promise<void>; loading: boolean } {
  const [loading, setLoading] = useState(false);

  /**
   * Runs the action.
   * @returns {Promise<void>}
   */
  const run = async () => {
    setLoading(true);
    try {
      const result = await action();
      if (success) notifySuccess(success);
      onDone?.(result);
    } catch (error) {
      notifyError(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setLoading(false);
    }
  };

  return { run, loading };
}
