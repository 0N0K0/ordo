import { TASK_AUTOMATIONS_EXTENSION } from '@ordo/shared';
import { handleStreamOrSingleExecutionResult, type Plugin } from 'graphql-yoga';
import { taskAutomationReports } from '../services/tasks/task-automation-engine';

/**
 * Tells the app which automations of the tasks a request applied: their reports (name, what they did, the tasks, the
 * undo) in the extensions of the answer, under `taskAutomations`, whatever the mutation (the toasts of the app).
 * The request runs in `collectTaskAutomationReports`.
 */
export const taskAutomationsPlugin: Plugin = {
  /**
   * Adds the reports of the rules applied to the answer of an operation.
   * @returns {object} Hook on the result.
   */
  onExecute() {
    return {
      /**
       * Puts the reports in the extensions of the result, when there are some.
       * @param {object} payload Result of the operation.
       * @returns {void}
       */
      onExecuteDone(payload) {
        return handleStreamOrSingleExecutionResult(payload, ({ result, setResult }) => {
          const reports = taskAutomationReports();
          if (reports.length) setResult({ ...result, extensions: { ...result.extensions, [TASK_AUTOMATIONS_EXTENSION]: reports } });
        });
      },
    };
  },
};
