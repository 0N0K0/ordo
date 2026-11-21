import {
  DAY_REMINDER_KINDS,
  normalizedReminders,
  readReminders,
  readSlotCondition,
  REMINDER_KINDS,
  reminderKey,
  reminderOfKey,
  ROUTINE_REMINDER_ANCHORS,
  routineHasHours,
  type RoutineCase,
  type RoutineSlot,
} from '@ordo/shared';

import { cellPicker } from '../../../components/data-table/cells/cell-field';
import { Badge, Select, Stack, Text } from '@mantine/core';
import { BellIcon } from '@phosphor-icons/react';

import { treeSelectProps } from '../../../components/tree/tree-select';
import { ON_ERROR } from '../../../lib/notify';
import { LocationCell } from '../../geo/components/LocationCell';
import { useRoutineMutations, type Routine } from '../api';
import { routineCellLabel, useRoutineCellEdit } from '../lib/routine-cell-edit';
import { applyDiff, listDiff } from '../../../components/data-table/selection/bulk-edit';
import { EditableMultiSelect, EditableNumber, EditablePopoverCell, EditableTime } from '../../../components/data-table/cells/EditableCells';

import { openRoutineForm } from '../lib/open-routine-form';
import { OpensOnInput } from './OpensOnInput';
import { opensText } from '../lib/opens-format';
import { opensFits, readOpens, subtreeOf } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { linkableRoutine, routineTreeOptions, ruleOf } from '../lib/routine-format';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { RemindersSelect } from '../../../components/inputs/RemindersSelect';
import { ChildrenCell } from '../../../components/data-table/cells/ChildrenCell';
import { unarchived } from '../../../lib/archive';

/**
 * Whether a routine has its own single time of the day (not several moments, nor those of cases or of schedules).
 * @param {Routine} routine Routine.
 * @returns {boolean} Own times.
 */
const hasOwnTimes = (routine: Routine) => !routine.slotCondition && !(routine.cases as unknown[] | null)?.length && ((routine.moments as unknown[] | null) ?? []).length <= 1;

/**
 * Parent routine cell: chosen in place (not itself nor one of its sub-routines).
 * @param {{ routine: Routine, routines: Routine[], readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function ParentRoutineCell({ routine, routines, readOnly = false }: { routine: Routine; routines: Routine[]; readOnly?: boolean }) {
  const { apply, count } = useRoutineCellEdit(routine, 'parent');
  // Neither the routine nor its sub-routines can be its parent.
  const below = subtreeOf(routines, routine.id);
  const options = routineTreeOptions(routines, (other) => !below.has(other.id));
  return (
    <Select
      {...cellPicker(readOnly)}
      aria-label={routineCellLabel('Routine parente', routine, count)}
      searchable
      {...treeSelectProps(options)}
      value={routine.parentId ?? null}
      // A routine is not its own parent (the API refuses the other loops).
      onChange={(parentId) => apply((target) => (target.id === parentId ? {} : { parentId }))}
    />
  );
}

/**
 * Sub-routines cell: their names, and a button adding one (none when read only).
 * @param {{ routine: Routine, routines: Routine[], readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function SubRoutinesCell({ routine, routines, readOnly = false }: { routine: Routine; routines: Routine[]; readOnly?: boolean }) {
  const children = unarchived(routines).filter((other) => other.parentId === routine.id);
  return (
    <ChildrenCell add={!readOnly && { label: 'Ajouter une sous-routine', item: routine.label, onClick: () => openRoutineForm({ parent: routine }) }}>
      {children.map((child) => (
        <Text key={child.id} size="sm" truncate>
          {child.label}
        </Text>
      ))}
    </ChildrenCell>
  );
}

/**
 * Time of the day cell (from, by): changed in place, for a routine of a single rule (not one of cases or of a
 * schedule).
 * @param {{ routine: Routine, field: 'fromTime' | 'dueTime', readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function TimeOfDayCell({ routine, field, readOnly = false }: { routine: Routine; field: 'fromTime' | 'dueTime'; readOnly?: boolean }) {
  const { apply, count } = useRoutineCellEdit(routine, field);
  const ownTimes = hasOwnTimes(routine);
  if (!ownTimes) {
    return (
      <Text size="xs" c="dimmed">
        {routine.slotCondition ? 'Selon les créneaux' : (routine.cases as unknown[] | null)?.length ? 'Selon les cas' : 'Plusieurs moments'}
      </Text>
    );
  }
  return (
    <EditableTime
      label={routineCellLabel(field === 'fromTime' ? 'À partir de' : 'Avant', routine, count)}
      value={routine[field] ?? ''}
      readOnly={readOnly}
      onSave={(value) => apply((target) => (hasOwnTimes(target) ? { [field]: value || null } : {}))}
      clearable
    />
  );
}

/**
 * Location cell of a routine (`LocationCell`), on the selection of its table.
 * @param {{ routine: Routine, readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function RoutineLocationCell({ routine, readOnly = false }: { routine: Routine; readOnly?: boolean }) {
  const { apply, count } = useRoutineCellEdit(routine, 'location');
  return <LocationCell item={routine} label={routineCellLabel('Lieu', routine, count)} readOnly={readOnly} count={count} onSave={(change) => apply(change)} />;
}

/**
 * Travel cell: minutes to get there or back, changed in place.
 * @param {{ routine: Routine, field: 'travelBefore' | 'travelAfter', readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function TravelCell({ routine, field, readOnly = false }: { routine: Routine; field: 'travelBefore' | 'travelAfter'; readOnly?: boolean }) {
  const { apply, count } = useRoutineCellEdit(routine, field);
  return (
    <EditableNumber
      label={routineCellLabel(field === 'travelBefore' ? 'Trajet aller' : 'Trajet retour', routine, count)}
      min={0}
      max={24 * 60}
      decimals={0}
      suffix="min"
      nullable
      value={routine[field] || null}
      readOnly={readOnly}
      onSave={(minutes) => apply({ [field]: minutes ?? 0 })}
    />
  );
}

/**
 * Reminders cell: a bell with the number of its reminders, chosen in place.
 * @param {{ routine: Routine, readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function RemindersCell({ routine, readOnly = false }: { routine: Routine; readOnly?: boolean }) {
  const { apply, count } = useRoutineCellEdit(routine, 'alarms');
  return (
    <EditablePopoverCell
      width={480}
      label={routineCellLabel('Rappels', routine, count)}
      readOnly={readOnly}
      target={
        <>
          {routine.reminders.length ? (
            <Badge size="sm" variant="light" color="teal" leftSection={<BellIcon aria-hidden />}>
              {routine.reminders.length}
            </Badge>
          ) : (
            <Text span size="sm" c="dimmed">
              —
            </Text>
          )}
        </>
      }
    >
      <Stack gap="xs">
        <RemindersSelect
          label="Rappels"
          value={routine.reminders}
          // Without any hour, only reminders at a time of the day (decision FW).
          kinds={
            routineHasHours({
              fromTime: routine.fromTime,
              dueTime: routine.dueTime,
              moments: (routine.moments as RoutineSlot[] | null) ?? [],
              slotCondition: readSlotCondition(routine.slotCondition),
              cases: (routine.cases as RoutineCase[] | null) ?? [],
            })
              ? REMINDER_KINDS
              : DAY_REMINDER_KINDS
          }
          anchors={ROUTINE_REMINDER_ANCHORS}
          // On a selection, those added here are added to each routine, those removed here removed (with their ringtone).
          onChange={(values) =>
            apply((target) => {
              const known = new Map([...readReminders(target.reminders), ...values].map((reminder) => [reminderKey(reminder), reminder]));
              return {
                reminders: normalizedReminders(applyDiff(target.reminders.map(reminderKey), routine.reminders.map(reminderKey), values.map(reminderKey)).flatMap((key) => known.get(key) ?? reminderOfKey(key) ?? [])),
              };
            })
          }
        />
      </Stack>
    </EditablePopoverCell>
  );
}

/**
 * « Ouverture » cell: the day each occurrence of its rule can be done from (its cases have theirs, in its repetition).
 * @param {{ routine: Routine, readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function OpensOnCell({ routine, readOnly = false }: { routine: Routine; readOnly?: boolean }) {
  const { apply } = useRoutineCellEdit(routine, 'opensOn');
  const frequency = ruleOf(routine)?.frequency;
  if ((routine.cases as unknown[] | null)?.length || !frequency) return null;
  const opens = readOpens(routine.opensOn);
  const words = opens ? opensText(opens, frequency) : '';
  const text = words ? fmt.capitalize(words) : '—';
  return (
    <EditablePopoverCell width={320} empty={!words} target={text} readOnly={readOnly}>
      <OpensOnInput
        frequency={frequency}
        value={opens}
        // A day of a month, or of a year: only the routines whose rule it fits take it.
        onChange={(opensOn) =>
          apply((target) => {
            const targetFrequency = ruleOf(target)?.frequency;
            return hasOwnTimes(target) && targetFrequency && (!opensOn || opensFits(opensOn, targetFrequency)) ? { opensOn } : {};
          })
        }
      />
    </EditablePopoverCell>
  );
}

/**
 * « Bloque » cell: the routines waiting for this one, chosen in place among those of its project tree (they then depend on it).
 * @param {{ routine: Routine, routines: Routine[], context: TaskContext, readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function BlocksCell({ routine, routines, context, readOnly = false }: { routine: Routine; routines: Routine[]; context: TaskContext; readOnly?: boolean }) {
  const { patch } = useRoutineMutations();
  const { targets, count } = useRoutineCellEdit(routine, 'blocks');
  const waiting = routines.filter((other) => other.requiredIds.includes(routine.id)).map((other) => other.id);
  return (
    <EditableMultiSelect
      label={routineCellLabel('Routines en attente', routine, count)}
      {...treeSelectProps(routineTreeOptions(routines, linkableRoutine(context, routine.projectId ?? null, routine.id, waiting)))}
      value={waiting}
      readOnly={readOnly}
      onSave={(next) => {
        // Those added here wait for this routine (and each one of the selection), those removed here no more.
        const { added, removed } = listDiff(waiting, next);
        for (const other of routines) {
          let required = other.requiredIds;
          if (added.includes(other.id)) required = [...new Set([...required, ...targets.filter((id) => id !== other.id)])];
          if (removed.includes(other.id)) required = required.filter((id) => !targets.includes(id));
          if (required.length !== other.requiredIds.length || required.some((id) => !other.requiredIds.includes(id))) {
            patch.mutate({ id: other.id, input: { requiredIds: required } }, ON_ERROR);
          }
        }
      }}
    />
  );
}
