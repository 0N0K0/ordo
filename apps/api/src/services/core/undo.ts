/**
 * Runs a change made of several steps whose first step is already written, and undoes that step when a later one
 * fails (a check refusing the change), before passing the error on.
 * @param {() => Promise<T>} run Rest of the change.
 * @param {() => Promise<unknown>} undo Puts the first step back.
 * @returns {Promise<T>} What the change returns.
 */
export async function undoOnFailure<T>(run: () => Promise<T>, undo: () => Promise<unknown>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    await undo();
    throw error;
  }
}
