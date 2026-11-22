import { TASK_AUTOMATIONS_EXTENSION, taskAutomationMessage, type TaskAutomationReport } from '@ordo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { onResponseExtensions } from '../../../lib/graphql-client';
import { notifyWarning, notifyWithUndo } from '../../../lib/notify';
import { tasksQueryKey } from '../../../lib/query-keys';
import { useBulkUndo } from '../lib/bulk-undo';

/**
 * Tells the automations of the tasks a change applied (the API lists them in its answer, whatever the change): a toast
 * per rule, « Règle « Démarrage » : statut « En cours » », with « Annuler » giving its tasks back as they were; a rule
 * refused, a warning with why. The tasks are reloaded (a rule changes more than the change asked).
 * @returns {null} Nothing shown itself.
 */
export function TaskAutomationToasts() {
  const queryClient = useQueryClient();
  const undo = useBulkUndo();
  // The undo builders change at each render: the listener reads the last ones.
  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  });

  useEffect(
    () =>
      onResponseExtensions((extensions) => {
        const reports = extensions[TASK_AUTOMATIONS_EXTENSION] as TaskAutomationReport[] | undefined;
        if (!reports?.length) return;
        for (const report of reports) {
          if (report.error) notifyWarning('Règle non appliquée', taskAutomationMessage(report));
          else notifyWithUndo(taskAutomationMessage(report), undoRef.current.automation(report.reverts));
        }
        void queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      }),
    [queryClient],
  );
  return null;
}
