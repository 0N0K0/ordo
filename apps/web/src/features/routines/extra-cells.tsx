import { ActionIcon, Anchor, Badge, Group, NumberInput, Popover, Select, Stack, Text, Tooltip } from '@mantine/core';
import { readSlotRule, type SlotRule } from '@ordo/shared';
import { BellIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { TimeField } from '../../components/TimeField';
import { treeOptions, treeSelectProps } from '../../components/tree-select/tree-select';
import { notifyError } from '../../lib/notify';
import { AddressInput, type AddressValue } from '../geo/AddressInput';
import { SlotRuleInput } from '../slot-rules/SlotRuleInput';
import { useSlotRules } from '../slot-rules/use-slot-rules';
import { useRoutineMutations, type Routine, type RoutinePatchValues } from './api';
import { openRoutineForm } from './open-routine-form';
import { OpensOnInput } from './OpensOnInput';
import { ruleOf } from './routine-format';
import { ROUTINE_REMINDERS } from './routine-format';

/** Cells do not open the routine when used. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Saves a change of a routine made in a cell.
 * @returns {(routine: Routine, input: RoutinePatchValues) => void} Saver.
 */
function usePatch() {
  const { patch } = useRoutineMutations();
  return (routine: Routine, input: RoutinePatchValues) => patch.mutate({ id: routine.id, input }, { onError: (error) => notifyError(error.message) });
}

/**
 * Parent routine cell: chosen in place (not itself nor one of its sub-routines).
 * @param {{ routine: Routine, routines: Routine[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ParentRoutineCell({ routine, routines }: { routine: Routine; routines: Routine[] }) {
  const save = usePatch();
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
      onChange={(parentId) => save(routine, { parentId })}
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
    <Group gap={4} wrap="nowrap" onClick={stop} style={{ minWidth: 0 }}>
      <Text size="sm" truncate style={{ minWidth: 0 }} title={children.map((child) => child.title).join(', ')}>
        {children.map((child) => child.title).join(', ')}
      </Text>
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
  const save = usePatch();
  const ownTimes = !routine.scheduleId && !(routine.cases as unknown[] | null)?.length;
  if (!ownTimes) {
    return (
      <Text size="xs" c="dimmed">
        {routine.scheduleId ? 'Selon la plage' : 'Selon les cas'}
      </Text>
    );
  }
  return (
    <TimeField
      variant="unstyled"
      size="xs"
      aria-label={`${field === 'fromTime' ? 'À partir de' : 'Avant'} (${routine.title})`}
      value={routine[field] ?? ''}
      onChange={(value) => value !== (routine[field] ?? '') && save(routine, { [field]: value || null })}
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
  const save = usePatch();
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
            if (value.point || !value.text.trim()) save(routine, { location: value.text.trim() || null, locationLat: value.point?.lat ?? null, locationLon: value.point?.lon ?? null });
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
  const save = usePatch();
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
        if (Number.isFinite(minutes) && minutes !== routine[field]) save(routine, { [field]: minutes });
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
  const save = usePatch();
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
            onChange={(values) => save(routine, { reminders: values.map(Number).sort((a, b) => a - b) })}
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
  const save = usePatch();
  const rule = ruleOf(routine);
  const frequency = rule?.frequency;
  if (routine.scheduleId || (routine.cases as unknown[] | null)?.length || (frequency !== 'MONTHLY' && frequency !== 'YEARLY')) {
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
        <OpensOnInput frequency={frequency} value={routine.opensOn ?? null} onChange={(opensOn) => save(routine, { opensOn })} />
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * « Plages » cell: the slots of the routine told in words, changed in a popover.
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RoutineSlotsCell({ routine }: { routine: Routine }) {
  const save = usePatch();
  const { describe, ruleOf: ruleOfSlots } = useSlotRules();
  const own = readSlotRule(routine.slotRule);
  return (
    <Popover position="bottom-start" withinPortal shadow="md" width={420}>
      <Popover.Target>
        <Anchor component="button" type="button" size="sm" c={own ? undefined : 'dimmed'} onClick={stop} style={{ textAlign: 'left' }}>
          {describe(ruleOfSlots(routine.slotRule)) ?? 'Partout'}
          {!own && ' (défaut)'}
        </Anchor>
      </Popover.Target>
      <Popover.Dropdown onClick={stop}>
        <SlotRuleInput value={own} onChange={(slotRule: SlotRule | null) => save(routine, { slotRule })} />
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
  const save = usePatch();
  const waiting = routines.filter((other) => other.requiredIds.includes(routine.id)).map((other) => other.id);
  return (
    <BatchMultiSelect
      variant="unstyled"
      size="xs"
      aria-label={`Routines qu’attend ${routine.title}`}
      placeholder={waiting.length ? undefined : '—'}
      data={routines.filter((other) => other.id !== routine.id && !other.archived).map((other) => ({ value: other.id, label: other.title }))}
      value={waiting}
      onChange={(next) => {
        for (const other of routines) {
          const wants = next.includes(other.id);
          const has = other.requiredIds.includes(routine.id);
          if (wants && !has) save(other, { requiredIds: [...other.requiredIds, routine.id] });
          if (!wants && has) save(other, { requiredIds: other.requiredIds.filter((id) => id !== routine.id) });
        }
      }}
      onClick={stop}
      searchable
      comboboxProps={{ withinPortal: true }}
    />
  );
}
