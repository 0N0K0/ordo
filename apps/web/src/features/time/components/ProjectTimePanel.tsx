import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeEntries } from '../api';
import { TimeLogActions } from './TimeLogActions';
import { TimeLog } from './TimeLog';
import { useTimeEntryDialogs } from '../hooks/use-time-dialogs';

/**
 * Time tab of a project: a button starting a timer on it (in a modal), time added by hand, and the tracked times of the project and its
 * sub-projects by day, with day and overall totals and what is billed.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectTimePanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const entries = useTimeEntries(projectId);
  const { openForm, duplicate, confirmDelete } = useTimeEntryDialogs(context, projectId);
  const archived = context?.projectById.get(projectId)?.archived;

  return (
    <TimeLog
      entries={entries.data}
      context={context}
      projectId={projectId}
      emptyMessage="Aucun temps sur ce projet."
      onEdit={openForm}
      onDuplicate={duplicate}
      onDelete={confirmDelete}
      actions={<TimeLogActions context={context} onNew={() => openForm()} projectId={projectId} archived={archived} />}
    />
  );
}
