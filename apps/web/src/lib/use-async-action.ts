import { useState } from 'react';
import { notifyFailure, notifySuccess } from './notify';

interface AsyncActionOptions<T> {
  /** Success toast once done. Optional. Default = none. */
  success?: string;
  /** Error toast when the error has no message. Optional. Default = « Action impossible. ». */
  fallback?: string;
  /** Runs once done (after the success toast): closes the form, opens what was created… Optional. */
  onDone?: (result: T) => void;
  /** Tells the failure instead of the error toast (under a field of the form…). Optional. */
  onError?: (error: unknown) => void;
}

/**
 * Action of a form sent to the server (a mutation, a download…): waits while it runs, tells its success in a toast
 * then goes on, or tells its failure in an error toast.
 * @param {(...args: A) => Promise<T>} action Action (with what it is run with: the values of the form…).
 * @param {AsyncActionOptions<T>} [options] Toasts and what follows. Optional.
 * @returns {{ run: (...args: A) => Promise<void>, loading: boolean }} The action to run, and whether it is running.
 */
export function useAsyncAction<T, A extends unknown[] = []>(
  action: (...args: A) => Promise<T>,
  { success, fallback = 'Action impossible.', onDone, onError }: AsyncActionOptions<T> = {},
): { run: (...args: A) => Promise<void>; loading: boolean } {
  const [loading, setLoading] = useState(false);

  /**
   * Runs the action.
   * @param {A} args What the action is run with.
   * @returns {Promise<void>}
   */
  const run = async (...args: A) => {
    setLoading(true);
    try {
      const result = await action(...args);
      if (success) notifySuccess(success);
      onDone?.(result);
    } catch (error) {
      if (onError) onError(error);
      else notifyFailure(error, fallback);
    } finally {
      // eslint-disable-next-line no-restricted-syntax -- useAsyncAction itself.
      setLoading(false);
    }
  };

  return { run, loading };
}
