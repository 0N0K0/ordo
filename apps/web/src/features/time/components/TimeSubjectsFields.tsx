import type { ComboboxProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { useCalendarEvents } from '../../calendar/api';
import { useRoutinesData } from '../../routines/api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import type { TimeEntry } from '../api';
import { dayEventOptions } from '../lib/time-events';
import { timeRoutineOptions } from '../lib/time-tasks';
import { TimeTasksSelect } from './TimeTasksSelect';

/** What a time is spent on besides its project, as its fields hold it (events: occurrence keys). */
export interface TimeSubjectsValue {
  routineIds: string[];
  taskIds: string[];
  events: string[];
}

interface TimeSubjectsFieldsProps {
  context: TaskContext;
  /** Project of the time (null: none, only routines and tasks of no project offered). */
  projectId: string | null;
  /** Day whose events are offered (YYYY-MM-DD). */
  day: string;
  /** Time edited: its routines and events stay offered even when archived or moved. Optional. */
  entry?: Pick<TimeEntry, 'events'>;
  value: TimeSubjectsValue;
  onChange: (change: Partial<TimeSubjectsValue>) => void;
  /** Errors under the fields. Optional. */
  errors?: Partial<Record<keyof TimeSubjectsValue, ReactNode>>;
  /** Options of the dropdowns (kept inside a popover). Optional. */
  comboboxProps?: ComboboxProps;
}

/**
 * What a time is spent on, the same in its form and its timer: routines, tasks and events of its day (several of
 * each, decision D18); routines and tasks of its project tree, as the API's rule.
 * @param {TimeSubjectsFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function TimeSubjectsFields({ context, projectId, day, entry, value, onChange, errors, comboboxProps }: TimeSubjectsFieldsProps) {
  const { data: routinesData } = useRoutinesData();
  const { data: dayEvents } = useCalendarEvents({ from: day, to: day });
  const eventOptions = dayEventOptions(dayEvents ?? [], day, entry);
  return (
    <>
      <BatchMultiSelect
        label="Routines"
        description={value.routineIds.length > 1 ? `Le temps est réparti à parts égales entre les ${value.routineIds.length} routines.` : projectId ? undefined : 'Sans projet : routines sans projet.'}
        placeholder={value.routineIds.length ? undefined : 'Aucune'}
        searchable
        clearable
        nothingFoundMessage="Aucune routine"
        {...treeSelectProps(timeRoutineOptions(context, routinesData?.routines ?? [], projectId, value.routineIds))}
        value={value.routineIds}
        onChange={(routineIds) => onChange({ routineIds })}
        error={errors?.routineIds}
        comboboxProps={comboboxProps}
      />
      <TimeTasksSelect context={context} projectId={projectId} value={value.taskIds} onChange={(taskIds) => onChange({ taskIds })} error={errors?.taskIds} comboboxProps={comboboxProps} />
      <BatchMultiSelect
        label="Évènements"
        description={`Le temps passé sur des évènements de l’agenda : seule la part hors de ces évènements y apparaît${value.events.length > 1 ? ` ; il est réparti à parts égales entre les ${value.events.length} évènements` : ''}.`}
        placeholder={value.events.length ? undefined : eventOptions.length ? 'Aucun' : 'Aucun évènement ce jour-là'}
        searchable
        clearable
        nothingFoundMessage="Aucun évènement ce jour-là"
        data={eventOptions}
        value={value.events}
        onChange={(events) => onChange({ events })}
        error={errors?.events}
        comboboxProps={comboboxProps}
      />
    </>
  );
}
