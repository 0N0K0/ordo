import { CheckCircleIcon, ClockIcon, XIcon } from '@phosphor-icons/react';
import { Group, Popover, Stack } from '@mantine/core';
import { routineTickPrefill, type RoutineDoneAt, type RoutineTickTarget } from '@ordo/shared';
import { useState, type FocusEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { IconAction } from '../../../components/actions/IconAction';
import { stopClick } from '../../../components/data-table/cells/cell-field';
import { StateButton } from '../../../components/data-table/cells/StateButton';
import { DateField } from '../../../components/inputs/DateField';
import { DateTimeField } from '../../../components/inputs/DateTimeField';
import { parisDay, parisInstant } from '../../../lib/dates';
import { useNow, useToday } from '../../../lib/use-now';
import { useRoutineTick, type RoutineTickRef } from '../hooks/use-routine-tick';
import { ROUTINE_DONE_STATES } from '../lib/routine-columns';
import { doneAtParts, doneAtText } from '../lib/routine-format';

interface DoneAtFormProps {
  /** Day and time it starts from. */
  initial: RoutineDoneAt;
  /** Its button (« Cocher comme faite », « Changer l’heure »). */
  submitLabel: string;
  /** Changes the time a done one was done at (a clock on its button). Optional. Default = ticks it (a check). */
  change?: boolean;
  /** Help under the field. Optional. */
  description?: string;
  /** Being saved. Optional. Default = false. */
  loading?: boolean;
  /** Cannot be sent (a deleted routine). Optional. Default = false. */
  disabled?: boolean;
  /** Shown in a popover: the picker opens inside it (a click there does not close it). Optional. Default = false. */
  inPopover?: boolean;
  /** Other buttons, before its own (« Décocher »). Optional. */
  children?: ReactNode;
  /** Sends the instant it was done at (ISO). */
  onSubmit: (doneAt: string) => void;
}

/**
 * « Faite le » form of a time of the day of a routine, the same everywhere it is ticked or its time changed: the day
 * (not after today) and the time in one picker, a time to come refused (« Cette heure n’est pas encore passée. »),
 * Entrée validates (in the field too), its button focused first. Every day and time is read in Paris.
 * @param {DoneAtFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function DoneAtForm({ initial, submitLabel, change = false, description, loading = false, disabled = false, inPopover = false, children, onSubmit }: DoneAtFormProps) {
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  // Now when the form opened: a later time is refused.
  const now = useNow(false);
  const at = parisInstant(day, time || '00:00');
  const future = at.getTime() > now;
  const blocked = disabled || !time || future;
  /**
   * Sends it when it can be.
   * @param {FormEvent | { preventDefault: () => void }} [event] Submit (or Entrée in the field). Optional.
   * @returns {void}
   */
  const submit = (event?: FormEvent | { preventDefault: () => void }) => {
    event?.preventDefault();
    if (!blocked && !loading) onSubmit(at.toISOString());
  };
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <DateTimeField
          label="Faite le"
          description={description}
          maxDate={parisDay(now)}
          day={day}
          time={time || null}
          onChange={(value, hour) => {
            if (value) setDay(value);
            setTime(hour ?? '');
          }}
          // Entrée in the field validates (its dropdown opens on a click or Espace).
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit(event);
          }}
          error={future ? 'Cette heure n’est pas encore passée.' : undefined}
          {...(inPopover ? { popoverProps: { withinPortal: false } } : {})}
        />
        <Group justify="flex-end" gap="sm">
          {children}
          <ActionButton type="submit" icon={change ? <ClockIcon aria-hidden /> : <CheckCircleIcon aria-hidden />} disabled={blocked} loading={loading} data-autofocus>
            {submitLabel}
          </ActionButton>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Keeps Échap pressed in the popover from closing the side panel under it too: Mantine's panels and modals leave a key
 * whose target is marked so; the popover still closes.
 * @param {FocusEvent<HTMLElement>} event Focus coming into the popover.
 * @returns {void}
 */
const keepEscape = (event: FocusEvent<HTMLElement>) => event.target.setAttribute('data-mantine-stop-propagation', 'true');

/**
 * Closes the popover on Échap, unless the key closes the calendar of its date picker, open inside it (that one
 * closes alone).
 * @param {KeyboardEvent<HTMLElement>} event Key pressed in the popover.
 * @param {() => void} close Closes the popover.
 * @returns {void}
 */
const escapeOwn = (event: KeyboardEvent<HTMLElement>, close: () => void) => {
  if (event.key === 'Escape' && (event.target as HTMLElement).closest('[role="dialog"]') === event.currentTarget) close();
};

interface RoutineTickButtonProps {
  /** Time of the day of the occurrence ticked. */
  tick: RoutineTickRef;
  /** What it is, read after its state (« Se brosser les dents », « …, midi »). */
  label: string;
  /** Tooltip instead of what a click does while to do (why it is disabled, its date, its time of the day). Optional. */
  hint?: string;
  done: boolean;
  /** When it was done (ISO); null: not done. */
  doneAt: string | null;
  /** Its due day and times, the time proposed is read from. */
  target: RoutineTickTarget;
  /** Day it is ticked from (a past day shown in « Ma journée »): proposed on that day. Optional. Default = its due day. */
  day?: string;
  /** Not needed for the day to be done (shown dashed). Optional. Default = false. */
  optional?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm';
}

/**
 * State button ticking a time of the day of an occurrence of a routine, the same everywhere: to do, a click opens the
 * « Faite le » form in a popover, proposing its scheduled time once past, else now (`routineTickPrefill`, on `day` when
 * given: the day it is ticked from); Entrée
 * validates, Échap closes without ticking. Done, a click unticks it at once; a clock beside it (« Changer l’heure de
 * réalisation ») opens the same form at the time it was done. Each write has a toast with « Annuler ». A routine that
 * has sub-routines (a group) has none: it is never ticked.
 * @param {RoutineTickButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function RoutineTickButton({ tick, label, hint, done, doneAt, target, day, optional = false, disabled = false, size = 'sm' }: RoutineTickButtonProps) {
  const writes = useRoutineTick();
  const [opened, setOpened] = useState(false);
  const previous = done ? doneAt : null;
  const clock = done && !disabled;

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={300} trapFocus returnFocus closeOnEscape={false}>
      <Popover.Target>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          {/* eslint-disable-next-line no-restricted-syntax -- the one state button of a routine tick. */}
          <StateButton
            {...ROUTINE_DONE_STATES}
            value={done}
            label={label}
            hint={done ? undefined : hint}
            dashed={optional}
            size={size}
            readOnly={disabled}
            loading={writes.pending && !opened}
            onChange={(next) => (next ? setOpened(true) : writes.untick(tick, previous))}
          />
          {/* Its place kept while to do: what follows does not move when it is ticked. */}
          <IconAction
            label="Changer l’heure de réalisation"
            item={label}
            hint={previous ? `Changer l’heure de réalisation (${doneAtText(previous)})` : undefined}
            size={size}
            {...(clock ? {} : { 'aria-hidden': true, tabIndex: -1, style: { visibility: 'hidden' } })}
            onClick={(event) => {
              stopClick(event);
              setOpened(true);
            }}
          >
            <ClockIcon aria-hidden />
          </IconAction>
        </Group>
      </Popover.Target>
      <Popover.Dropdown onClick={stopClick} onFocusCapture={keepEscape} onKeyDown={(event) => escapeOwn(event, () => setOpened(false))}>
        {opened && (
          <DoneAtForm
            initial={previous ? doneAtParts(previous) : routineTickPrefill(target, new Date(), day ?? null)}
            submitLabel={previous ? 'Changer l’heure' : 'Cocher comme faite'}
            change={previous !== null}
            description={previous ? undefined : 'L’heure prévue si elle est passée, sinon maintenant.'}
            loading={writes.pending}
            inPopover
            onSubmit={(at) => writes.tick(tick, at, previous, () => setOpened(false))}
          >
            <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={() => setOpened(false)}>
              Annuler
            </ActionButton>
          </DoneAtForm>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

interface RoutineTickPanelProps {
  /** Time of the day of the occurrence ticked. */
  tick: RoutineTickRef;
  /** Its due day and times, the time proposed is read from. */
  target: RoutineTickTarget;
  /** When it was done (ISO), if it already is: its time changed. */
  doneAt: string | null;
  onDone: () => void;
}

/**
 * « Faite le » of a time of the day in the side panel, where no state button shows it (« Marquer comme faite » of a
 * reminder ringing): the same form, proposed as on its button (`routineTickPrefill`), written by `useRoutineTick`.
 * @param {RoutineTickPanelProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineTickPanel({ tick, target, doneAt, onDone }: RoutineTickPanelProps) {
  const writes = useRoutineTick();
  const [initial] = useState(() => (doneAt ? doneAtParts(doneAt) : routineTickPrefill(target, new Date())));
  return (
    <DoneAtForm
      initial={initial}
      submitLabel={doneAt ? 'Changer l’heure' : 'Cocher comme faite'}
      change={doneAt !== null}
      description={doneAt ? undefined : 'L’heure prévue si elle est passée, sinon maintenant.'}
      loading={writes.pending}
      onSubmit={(at) => writes.tick(tick, at, doneAt, onDone)}
    >
      <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onDone}>
        Annuler
      </ActionButton>
    </DoneAtForm>
  );
}

interface BulkTickFormProps {
  /** Sends the day they were done (YYYY-MM-DD). */
  onSubmit: (doneOn: string) => void;
  onCancel: () => void;
}

/**
 * « Faites le » of the routines ticked together: a day only (today by default, not after it), each time of the day then
 * done that day at its scheduled time (`routineBulkDoneAt`, read by the API); Entrée validates.
 * @param {BulkTickFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function BulkTickForm({ onSubmit, onCancel }: BulkTickFormProps) {
  const today = useToday();
  const [day, setDay] = useState(today);
  /**
   * Sends the day.
   * @param {FormEvent | { preventDefault: () => void }} [event] Submit (or Entrée in the field). Optional.
   * @returns {void}
   */
  const submit = (event?: FormEvent | { preventDefault: () => void }) => {
    event?.preventDefault();
    onSubmit(day);
  };
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <DateField
          label="Faites le"
          description="Chaque moment à son heure prévue ce jour-là (« jusqu’à », sinon « dès ») ; sans heure, maintenant aujourd’hui, midi un autre jour ; jamais après maintenant."
          value={day}
          maxDate={today}
          onChange={(value) => value && setDay(value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit(event);
          }}
        />
        <Group justify="flex-end" gap="sm">
          <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onCancel}>
            Annuler
          </ActionButton>
          <ActionButton type="submit" icon={<CheckCircleIcon aria-hidden />} data-autofocus>
            Cocher
          </ActionButton>
        </Group>
      </Stack>
    </form>
  );
}
