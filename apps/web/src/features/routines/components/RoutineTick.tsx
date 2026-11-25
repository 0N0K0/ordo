import { CheckCircleIcon, ClockIcon, XIcon } from '@phosphor-icons/react';
import { Group, Popover, Stack } from '@mantine/core';
import { routineTickPrefill, type RoutineDoneAt, type RoutineTickTarget } from '@ordo/shared';
import { useState, type FocusEvent, type FormEvent, type ReactNode } from 'react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { IconAction } from '../../../components/actions/IconAction';
import { stopClick } from '../../../components/data-table/cells/cell-field';
import { StateButton } from '../../../components/data-table/cells/StateButton';
import { DateTimeField } from '../../../components/inputs/DateTimeField';
import { parisDay, parisInstant } from '../../../lib/dates';
import { useNow } from '../../../lib/use-now';
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
  /** Not needed for the day to be done (shown dashed). Optional. Default = false. */
  optional?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm';
}

/**
 * State button ticking a time of the day of an occurrence of a routine, the same everywhere: to do, a click opens the
 * « Faite le » form in a popover, proposing its scheduled time once past, else now (`routineTickPrefill`); Entrée
 * validates, Échap closes without ticking. Done, a click unticks it at once; a clock beside it (« Changer l’heure de
 * réalisation ») opens the same form at the time it was done. Each write has a toast with « Annuler ».
 * @param {RoutineTickButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function RoutineTickButton({ tick, label, hint, done, doneAt, target, optional = false, disabled = false, size = 'sm' }: RoutineTickButtonProps) {
  const writes = useRoutineTick();
  const [opened, setOpened] = useState(false);
  const previous = done ? doneAt : null;

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={300} trapFocus returnFocus>
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
          {done && !disabled && (
            <IconAction
              label="Changer l’heure de réalisation"
              item={label}
              hint={previous ? `Changer l’heure de réalisation (${doneAtText(previous)})` : undefined}
              size={size}
              onClick={(event) => {
                stopClick(event);
                setOpened(true);
              }}
            >
              <ClockIcon aria-hidden />
            </IconAction>
          )}
        </Group>
      </Popover.Target>
      <Popover.Dropdown onClick={stopClick} onFocusCapture={keepEscape}>
        {opened && (
          <DoneAtForm
            initial={previous ? doneAtParts(previous) : routineTickPrefill(target, new Date())}
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
