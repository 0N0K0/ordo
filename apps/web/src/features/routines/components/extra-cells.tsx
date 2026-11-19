import { ROUTINE_REMINDERS } from '../../../components/inputs/reminder-presets';

import { cellPicker } from '../../../components/data-table/cells/cell-field';
import { Badge, Select, Stack, Text } from '@mantine/core';
import { BellIcon } from '@phosphor-icons/react';
import { useState } from 'react';

import { treeSelectProps } from '../../../components/tree/tree-select';
import { ON_ERROR } from '../../../lib/notify';
import { AddressInput, type AddressValue } from '../../geo/components/AddressInput';
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
 * Place cell: an address chosen in place (with its point on the map), or none.
 * @param {{ routine: Routine, readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function LocationCell({ routine, readOnly = false }: { routine: Routine; readOnly?: boolean }) {
  const { apply, count } = useRoutineCellEdit(routine, 'location');
  const [draft, setDraft] = useState<AddressValue | null>(null);
  const current: AddressValue = { text: routine.location ?? '', point: routine.locationLat != null && routine.locationLon != null ? { lat: routine.locationLat, lon: routine.locationLon } : null };
  return (
    <EditablePopoverCell width={360} empty={!routine.location} truncate readOnly={readOnly} onClose={() => setDraft(null)} target={routine.location || '—'}>
      <AddressInput
        aria-label={routineCellLabel('Lieu', routine, count)}
        placeholder="Adresse ou lieu enregistré"
        withinPortal={false}
        value={draft ?? current}
        onChange={(value) => {
          setDraft(value);
          // Saved once a proposed address is chosen, or when the text is cleared.
          if (value.point || !value.text.trim()) apply({ location: value.text.trim() || null, locationLat: value.point?.lat ?? null, locationLon: value.point?.lon ?? null });
        }}
      />
    </EditablePopoverCell>
  );
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
 * Alerts cell: a bell with the alerts before its moment, chosen in place.
 * @param {{ routine: Routine, readOnly?: boolean }} props Component props (read only: archived or being created).
 * @returns {JSX.Element} Cell.
 */
export function RemindersCell({ routine, readOnly = false }: { routine: Routine; readOnly?: boolean }) {
  const { apply, count } = useRoutineCellEdit(routine, 'alarms');
  const labels = new Map(ROUTINE_REMINDERS.map((preset) => [preset.value, preset.label]));
  return (
    <EditablePopoverCell
      width={280}
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
          presets={ROUTINE_REMINDERS}
          value={routine.reminders}
          // On a selection, those added here are added to each routine, those removed here removed.
          onChange={(values) =>
            apply((target) => ({
              reminders: applyDiff(target.reminders.map(String), routine.reminders.map(String), values.map(String))
                .map(Number)
                .sort((a, b) => a - b),
            }))
          }
          comboboxProps={{ withinPortal: false }}
        />
        <Text size="xs" c="dimmed">
          {routine.reminders.map((minutes) => labels.get(minutes) ?? `${minutes} min avant`).join(', ') || 'Aucun rappel.'}
        </Text>
      </Stack>
    </EditablePopoverCell>
  );
}

/**
 * « À partir du » cell: the day each occurrence of its rule can be done from (its cases have theirs, in its repetition).
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
