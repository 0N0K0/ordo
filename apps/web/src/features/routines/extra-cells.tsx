import { ActionIcon, Anchor, Badge, Group, NumberInput, Popover, Select, Stack, Text, Tooltip } from '@mantine/core';
import { BellIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { TimeField } from '../../components/TimeField';
import { treeOptions, treeSelectProps } from '../../components/tree-select/tree-select';
import { notifyError } from '../../lib/notify';
import { AddressInput, type AddressValue } from '../geo/AddressInput';
import { useRoutineMutations, type Routine } from './api';
import { useRoutineCellEdit } from './routine-cell-edit';
import { applyDiff } from '../../components/data-table/bulk-edit';
import { EditableMultiSelect } from '../../components/data-table/EditableCells';
import { StackedValues } from '../../components/data-table/StackedValues';
import { openRoutineForm } from './open-routine-form';
import { OpensOnInput } from './OpensOnInput';
import { ruleOf } from './routine-format';
import { ROUTINE_REMINDERS } from './routine-format';

/** Cells do not open the routine when used. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Whether a routine has its own single time of the day (not several moments, nor those of cases or of schedules).
 * @param {Routine} routine Routine.
 * @returns {boolean} Own times.
 */
const hasOwnTimes = (routine: Routine) => !routine.scheduleIds.length && !(routine.cases as unknown[] | null)?.length && ((routine.moments as unknown[] | null) ?? []).length <= 1;

/**
 * Parent routine cell: chosen in place (not itself nor one of its sub-routines).
 * @param {{ routine: Routine, routines: Routine[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ParentRoutineCell({ routine, routines }: { routine: Routine; routines: Routine[] }) {
  const { apply } = useRoutineCellEdit(routine, 'parent');
  const below = new Set([routine.id]);
  for (let grown = true; grown;) {
    grown = false;
    for (const other of routines) {
      if (other.parentId && below.has(other.parentId) && !below.has(other.id)) {
        below.add(other.id);
        grown = true;
      }
    }
  }
  const options = treeOptions(
    [...routines].sort((a, b) => a.position - b.position).map((other) => ({ id: other.id, parentId: other.parentId ?? null, label: other.title })),
    (id) => !below.has(id),
  );
  return (
    <Select
      variant="unstyled"
      size="xs"
      aria-label={`Routine parente de ${routine.title}`}
      placeholder="—"
      clearable
      searchable
      {...treeSelectProps(options)}
      value={routine.parentId ?? null}
      // A routine is not its own parent (the API refuses the other loops).
      onChange={(parentId) => apply((target) => (target.id === parentId ? {} : { parentId }))}
      onClick={stop}
      comboboxProps={{ withinPortal: true }}
    />
  );
}

/**
 * Sub-routines cell: their names, and a button adding one.
 * @param {{ routine: Routine, routines: Routine[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function SubRoutinesCell({ routine, routines }: { routine: Routine; routines: Routine[] }) {
  const children = routines.filter((other) => other.parentId === routine.id && !other.archived);
  return (
    <Group gap={4} wrap="nowrap" align="flex-start" onClick={stop} style={{ minWidth: 0 }}>
      <StackedValues>
        {children.map((child) => (
          <Text key={child.id} size="sm" truncate>
            {child.title}
          </Text>
        ))}
      </StackedValues>
      <Tooltip label="Ajouter une sous-routine">
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Ajouter une sous-routine à ${routine.title}`} onClick={() => openRoutineForm({ parent: routine })} style={{ flex: 'none' }}>
          <PlusIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/**
 * Time of the day cell (from, by): changed in place, for a routine of a single rule (not one of cases or of a
 * schedule).
 * @param {{ routine: Routine, field: 'fromTime' | 'dueTime' }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeOfDayCell({ routine, field }: { routine: Routine; field: 'fromTime' | 'dueTime' }) {
  const { apply } = useRoutineCellEdit(routine, field);
  const ownTimes = hasOwnTimes(routine);
  if (!ownTimes) {
    return (
      <Text size="xs" c="dimmed">
        {routine.scheduleIds.length ? 'Selon les plages' : (routine.cases as unknown[] | null)?.length ? 'Selon les cas' : 'Plusieurs moments'}
      </Text>
    );
  }
  return (
    <TimeField
      variant="unstyled"
      size="xs"
      aria-label={`${field === 'fromTime' ? 'À partir de' : 'Avant'} (${routine.title})`}
      value={routine[field] ?? ''}
      onChange={(value) => value !== (routine[field] ?? '') && apply((target) => (hasOwnTimes(target) ? { [field]: value || null } : {}))}
      onClick={stop}
      clearable
    />
  );
}

/**
 * Place cell: an address chosen in place (with its point on the map), or none.
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function LocationCell({ routine }: { routine: Routine }) {
  const { apply } = useRoutineCellEdit(routine, 'location');
  const [draft, setDraft] = useState<AddressValue | null>(null);
  const current: AddressValue = { text: routine.location ?? '', point: routine.locationLat != null && routine.locationLon != null ? { lat: routine.locationLat, lon: routine.locationLon } : null };
  return (
    <Popover position="bottom-start" withinPortal shadow="md" width={360} onClose={() => setDraft(null)}>
      <Popover.Target>
        <Anchor component="button" type="button" size="sm" c={routine.location ? undefined : 'dimmed'} onClick={stop} style={{ textAlign: 'left' }} truncate>
          {routine.location || '—'}
        </Anchor>
      </Popover.Target>
      <Popover.Dropdown onClick={stop}>
        <AddressInput
          aria-label={`Lieu de ${routine.title}`}
          placeholder="Adresse ou lieu enregistré"
          withinPortal={false}
          value={draft ?? current}
          onChange={(value) => {
            setDraft(value);
            // Saved once a proposed address is chosen, or when the text is cleared.
            if (value.point || !value.text.trim()) apply({ location: value.text.trim() || null, locationLat: value.point?.lat ?? null, locationLon: value.point?.lon ?? null });
          }}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * Travel cell: minutes to get there or back, changed in place.
 * @param {{ routine: Routine, field: 'travelBefore' | 'travelAfter' }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TravelCell({ routine, field }: { routine: Routine; field: 'travelBefore' | 'travelAfter' }) {
  const { apply } = useRoutineCellEdit(routine, field);
  const [draft, setDraft] = useState<string | number | null>(null);
  return (
    <NumberInput
      variant="unstyled"
      size="xs"
      aria-label={`${field === 'travelBefore' ? 'Trajet aller' : 'Trajet retour'} (${routine.title})`}
      min={0}
      max={24 * 60}
      allowDecimal={false}
      suffix=" min"
      hideControls
      placeholder="—"
      value={draft ?? (routine[field] || '')}
      onChange={setDraft}
      onBlur={() => {
        if (draft === null) return;
        setDraft(null);
        const minutes = draft === '' ? 0 : Number(draft);
        if (Number.isFinite(minutes) && minutes !== routine[field]) apply({ [field]: minutes });
      }}
      onClick={stop}
      styles={{ input: { textAlign: 'right' } }}
    />
  );
}

/**
 * Alerts cell: a bell with the alerts before its moment, chosen in place.
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RemindersCell({ routine }: { routine: Routine }) {
  const { apply } = useRoutineCellEdit(routine, 'alarms');
  const labels = new Map(ROUTINE_REMINDERS.map((preset) => [preset.value, preset.label]));
  return (
    <Popover position="bottom-start" withinPortal shadow="md" width={280}>
      <Popover.Target>
        <Anchor component="button" type="button" onClick={stop} aria-label={`Alertes de ${routine.title}`}>
          {routine.reminders.length ? (
            <Badge size="sm" variant="light" color="teal" leftSection={<BellIcon aria-hidden />} tt="none">
              {routine.reminders.length}
            </Badge>
          ) : (
            <Text span size="sm" c="dimmed">
              —
            </Text>
          )}
        </Anchor>
      </Popover.Target>
      <Popover.Dropdown onClick={stop}>
        <Stack gap="xs">
          <BatchMultiSelect
            label="Alertes"
            data={ROUTINE_REMINDERS.map((preset) => ({ value: String(preset.value), label: preset.label }))}
            value={routine.reminders.map(String)}
            // On a selection, those added here are added to each routine, those removed here removed.
            onChange={(values) =>
              apply((target) => ({
                reminders: applyDiff(target.reminders.map(String), routine.reminders.map(String), values)
                  .map(Number)
                  .sort((a, b) => a - b),
              }))
            }
            comboboxProps={{ withinPortal: false }}
          />
          <Text size="xs" c="dimmed">
            {routine.reminders.map((minutes) => labels.get(minutes) ?? `${minutes} min avant`).join(', ') || 'Aucune alerte.'}
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * « À partir du » cell: the day of the period an occurrence can be done from (monthly or yearly routines only).
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function OpensOnCell({ routine }: { routine: Routine }) {
  const { apply } = useRoutineCellEdit(routine, 'opensOn');
  const rule = ruleOf(routine);
  const frequency = rule?.frequency;
  if (routine.scheduleIds.length || (routine.cases as unknown[] | null)?.length || (frequency !== 'MONTHLY' && frequency !== 'YEARLY')) {
    return null;
  }
  const text = routine.opensOn ? (routine.opensOn.includes('-') ? `Le ${routine.opensOn.slice(3)}/${routine.opensOn.slice(0, 2)}` : `Le ${Number(routine.opensOn)}`) : '—';
  return (
    <Popover position="bottom-start" withinPortal shadow="md" width={320}>
      <Popover.Target>
        <Anchor component="button" type="button" size="sm" c={routine.opensOn ? undefined : 'dimmed'} onClick={stop}>
          {text}
        </Anchor>
      </Popover.Target>
      <Popover.Dropdown onClick={stop}>
        <OpensOnInput
          frequency={frequency}
          value={routine.opensOn ?? null} // The day is that of a month, or of a year: only routines of the same frequency take it.
          onChange={(opensOn) => apply((target) => (hasOwnTimes(target) && ruleOf(target)?.frequency === frequency ? { opensOn } : {}))}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * « Bloque » cell: the routines waiting for this one, chosen in place (they then depend on it).
 * @param {{ routine: Routine, routines: Routine[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function BlocksCell({ routine, routines }: { routine: Routine; routines: Routine[] }) {
  const { patch } = useRoutineMutations();
  const { targets } = useRoutineCellEdit(routine, 'blocks');
  const waiting = routines.filter((other) => other.requiredIds.includes(routine.id)).map((other) => other.id);
  return (
    <EditableMultiSelect
      label={`Routines qu’attend ${routine.title}`}
      data={routines.filter((other) => other.id !== routine.id && (!other.archived || waiting.includes(other.id))).map((other) => ({ value: other.id, label: other.title }))}
      value={waiting}
      onSave={(next) => {
        // Those added here wait for this routine (and each one of the selection), those removed here no more.
        const added = next.filter((id) => !waiting.includes(id));
        const removed = waiting.filter((id) => !next.includes(id));
        for (const other of routines) {
          let required = other.requiredIds;
          if (added.includes(other.id)) required = [...new Set([...required, ...targets.filter((id) => id !== other.id)])];
          if (removed.includes(other.id)) required = required.filter((id) => !targets.includes(id));
          if (required.length !== other.requiredIds.length || required.some((id) => !other.requiredIds.includes(id))) {
            patch.mutate({ id: other.id, input: { requiredIds: required } }, { onError: (error) => notifyError(error.message) });
          }
        }
      }}
    />
  );
}
