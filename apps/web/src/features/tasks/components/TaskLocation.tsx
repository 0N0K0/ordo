import { EventLocation } from '../../geo/components/EventLocation';
import { useLocationDraft } from '../../geo/hooks/use-location-draft';
import type { Task, TaskInputValues } from '../api';

interface TaskLocationProps {
  task: Task;
  /** Saves a change of the task right away. */
  save: (input: Omit<TaskInputValues, 'projectId'>) => void;
}

/**
 * Location of a task in its panel (the field of the events and routines, no travel time): saved once an address is
 * chosen or the map clicked, when the text is cleared, or on leaving the field for a free text (`useLocationDraft`).
 * @param {TaskLocationProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function TaskLocation({ task, save }: TaskLocationProps) {
  const location = useLocationDraft(task, save);
  return <EventLocation value={location.value} onChange={location.onChange} onBlur={location.leave} />;
}
