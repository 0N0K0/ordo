import { useState } from 'react';
import type { AddressValue } from '../../geo/components/AddressInput';
import { EventLocation } from '../../geo/components/EventLocation';
import { addressOf, locationOf } from '../../geo/lib/location';
import type { Task, TaskInputValues } from '../api';

interface TaskLocationProps {
  task: Task;
  /** Saves a change of the task right away. */
  save: (input: Omit<TaskInputValues, 'projectId'>) => void;
}

/**
 * Location of a task in its panel (the field of the events and routines, no travel time): saved once an address is
 * chosen or the map clicked, when the text is cleared, or on leaving the field for a free text.
 * @param {TaskLocationProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function TaskLocation({ task, save }: TaskLocationProps) {
  const [draft, setDraft] = useState<AddressValue | null>(null);
  /**
   * Saves an address, when it changes the location of the task.
   * @param {AddressValue} value Address.
   * @returns {void}
   */
  const commit = (value: AddressValue) => {
    const change = { ...locationOf(value), location: value.text.trim() || null };
    if (change.location !== task.location || change.locationLat !== task.locationLat || change.locationLon !== task.locationLon) save(change);
  };
  return (
    <EventLocation
      value={draft ?? addressOf(task)}
      onChange={(value) => {
        setDraft(value);
        if (value.point || !value.text.trim()) commit(value);
      }}
      onBlur={() => draft && commit(draft)}
    />
  );
}
