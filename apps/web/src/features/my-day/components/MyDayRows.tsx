import { Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { windowText, type MyDayRow as Row } from '@ordo/shared';
import { CakeIcon, SparkleIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';
import { LateBadge } from '../../../components/feedback/LateBadge';
import { RoutineGroupProgress } from '../../../components/routines/RoutineGroupProgress';
import * as fmt from '../../../lib/format';
import { EventTimerToggle } from '../../calendar/components/EventTimerToggle';
import { useEventForm } from '../../calendar/hooks/use-event-form';
import { useEventMenu } from '../../calendar/hooks/use-event-menu';
import { usePersonOpener } from '../../calendar/hooks/use-person-opener';
import { RoutineTickButton } from '../../routines/components/RoutineTick';
import { RoutineTimerToggle } from '../../routines/components/routine-table-cells';
import { useRoutineOccurrenceMenu } from '../../routines/hooks/use-routine-occurrence-menu';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import { ROUTINE_DONE_STATES } from '../../routines/lib/routine-columns';
import { TimerCell } from '../../tasks/components/extra-cells';
import { TaskDoneButton } from '../../tasks/components/TaskDoneButton';
import { useTaskActions } from '../../tasks/hooks/use-task-actions';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTaskLink } from '../../tasks/hooks/use-task-link';
import { routineTimer, useRunningTimers } from '../../time/api';
import type { MyDayBirthday, MyDayEntry, MyDayEphemeris, MyDayEvent, MyDayRoutine, MyDayRoutineGroup, MyDayTask } from '../hooks/use-my-day';
import classes from './MyDay.module.css';

/** What every row of the day reads: the task context, today and the day shown. */
interface RowContext {
  context: TaskContext;
  /** Today in Paris (YYYY-MM-DD). */
  today: string;
  /** Day shown (YYYY-MM-DD). */
  day: string;
}

interface RowLineProps {
  /** State button (none for an event, an éphéméride, a birthday). Optional. */
  state?: ReactNode;
  /** Time it is placed at (HH:MM). */
  time: string | null;
  /** Its name, opening its panel. */
  label: ReactNode;
  /** Badges and other windows after its name. Optional. */
  details?: ReactNode;
  /** Timer and menu, on the right. Optional. */
  actions?: ReactNode;
  /** Done or cancelled: dimmed; cancelled: struck through. Optional. */
  finished?: 'done' | 'cancelled' | null;
}

/**
 * One line of the day, the same for every kind: its state button, its time, its name, its badges, then its timer and
 * its menu on the right.
 * @param {RowLineProps} props Component props.
 * @returns {JSX.Element} Line.
 */
function RowLine({ state, time, label, details, actions, finished = null }: RowLineProps) {
  return (
    <Group className={classes.row} gap="sm" wrap="nowrap" data-finished={finished ?? undefined}>
      <span className={classes.state}>{state}</span>
      <Text size="sm" ff="monospace" c="dimmed" className={classes.time}>
        {time ?? ''}
      </Text>
      <Group gap="xs" wrap="wrap" className={classes.label}>
        {label}
        {details}
      </Group>
      {actions && (
        <Group gap={4} wrap="nowrap">
          {actions}
        </Group>
      )}
    </Group>
  );
}

/**
 * Name of an item opening its panel (as the event cells of the tasks).
 * @param {{ children: ReactNode, onClick: () => void }} props Component props.
 * @param {ReactNode} props.children Name.
 * @param {() => void} props.onClick Opens its panel.
 * @returns {JSX.Element} Link.
 */
function OpenLabel({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <UnstyledButton className={classes.open} onClick={onClick}>
      <Text size="sm" span>
        {children}
      </Text>
    </UnstyledButton>
  );
}

/**
 * Other windows of a task or a routine that day, after its name.
 * @param {{ row: Row<MyDayEntry> }} props Component props.
 * @param {Row<MyDayEntry>} props.row Row.
 * @returns {JSX.Element | null} Text.
 */
function OtherWindows({ row }: { row: Row<MyDayEntry> }) {
  if (!row.otherWindows.length) return null;
  return (
    <Text size="xs" c="dimmed">
      aussi {row.otherWindows.map(windowText).join(', ')}
    </Text>
  );
}

/**
 * Row of a task: its state button, its name (its panel), late, its chrono and its menu.
 * @param {RowContext & { row: Row<MyDayEntry>, item: MyDayTask }} props Component props.
 * @returns {JSX.Element} Row.
 */
function TaskRow({ row, item, context, today }: RowContext & { row: Row<MyDayEntry>; item: MyDayTask }) {
  const { task } = item;
  const link = useTaskLink();
  const actions = useTaskActions(context);
  return (
    <RowLine
      state={<TaskDoneButton task={task} context={context} />}
      time={row.time}
      finished={item.cancelled ? 'cancelled' : item.done ? 'done' : null}
      label={<OpenLabel onClick={() => link.open(task.id)}>{context.taskLabel(task)}</OpenLabel>}
      details={
        <>
          {item.late && task.effectiveDeadline && <LateBadge due={task.effectiveDeadline} today={today} />}
          <OtherWindows row={row} />
        </>
      }
      actions={
        <>
          {!task.closed && <TimerCell task={task} size="sm" />}
          <ActionsMenu name={task.label} items={actions.menu(task)} />
        </>
      }
    />
  );
}

/**
 * Row of a time of the day of a routine: its state button (« Faite le »), its name (its panel, on that occurrence),
 * late (« Depuis … ») or « non faite » on a past day, its chrono and its menu.
 * @param {RowContext & { row: Row<MyDayEntry>, item: MyDayRoutine }} props Component props.
 * @returns {JSX.Element} Row.
 */
function RoutineRow({ row, item, today, day }: RowContext & { row: Row<MyDayEntry>; item: MyDayRoutine }) {
  const { routine, occurrence, slot } = item;
  const menuOf = useRoutineOccurrenceMenu();
  const running = useRunningTimers();
  const menu = menuOf(routine, occurrence);
  const several = occurrence.slots.length > 1;
  const name = several ? `${routine.label}, ${windowText(slot) || `fois ${slot.index + 1}`}` : routine.label;
  const locked = routine.archived || occurrence.cancelled;
  return (
    <RowLine
      state={
        <RoutineTickButton
          tick={{ id: routine.id, date: occurrence.date, slot: slot.index }}
          label={name}
          hint={ROUTINE_DONE_STATES.toggleLabels.yes}
          done={item.done ?? false}
          doneAt={slot.doneAt ?? null}
          optional={slot.optional}
          disabled={locked}
          target={{ dueDate: occurrence.dueDate, fromTime: slot.fromTime, dueTime: slot.dueTime }}
          // A past day: proposed on that day, as it is ticked from there.
          day={day < today ? day : undefined}
        />
      }
      time={row.time}
      finished={item.cancelled ? 'cancelled' : item.done ? 'done' : null}
      label={
        <OpenLabel onClick={() => openRoutineForm({ routine, occurrenceDate: occurrence.date })}>
          {name}
          {slot.optional ? ' (facultatif)' : ''}
        </OpenLabel>
      }
      details={
        <>
          {item.late && (
            <Badge color={LATE_COLOR} variant="light">
              Depuis {fmt.weekday(occurrence.dueDate)}
            </Badge>
          )}
          {item.missed && (
            <Badge color="red" variant="light">
              Non faite
            </Badge>
          )}
          {item.done && row.time && (
            <Text size="xs" c="dimmed">
              faite à {row.time}
            </Text>
          )}
          <OtherWindows row={row} />
        </>
      }
      actions={
        <>
          {!locked && !item.done && <RoutineTimerToggle routine={routine} mine={routineTimer(running.data, routine)} />}
          <RowActions name={routine.label} primary={menu.primary || null} items={menu.items} />
        </>
      }
    />
  );
}

/**
 * Head of a group of routines (a parent routine): no state button (it is never ticked), its name (its panel), its
 * progress « 2/3 » read from its sub-routines due that day, and its menu; its sub-routines of the day under it. Dimmed
 * once they are all done.
 * @param {RowContext & { row: Row<MyDayEntry>, item: MyDayRoutineGroup }} props Component props.
 * @returns {JSX.Element} Row.
 */
function RoutineGroupRow({ row, item, today, day }: RowContext & { row: Row<MyDayEntry>; item: MyDayRoutineGroup }) {
  const { routine, state, occurrence } = item;
  // Its own occurrence of that day, if any (moving it moves the sub-routines following its exceptions).
  const menu = useRoutineOccurrenceMenu()(routine, occurrence);
  return (
    <RowLine
      time={row.time}
      finished={state.complete ? 'done' : null}
      label={<OpenLabel onClick={() => openRoutineForm(occurrence ? { routine, occurrenceDate: occurrence.date } : { routine })}>{routine.label}</OpenLabel>}
      details={<RoutineGroupProgress state={state} when={day === today ? 'aujourd’hui' : 'ce jour-là'} />}
      actions={<RowActions name={routine.label} primary={menu.primary || null} items={menu.items} />}
    />
  );
}

/**
 * Row of an occurrence of an event: no state button (« Annuler l’évènement » / « Reporter » in its menu), its name (its
 * panel), its chrono and its menu; cancelled, struck through; over several days, its first or last day told.
 * @param {RowContext & { row: Row<MyDayEntry>, item: MyDayEvent }} props Component props.
 * @returns {JSX.Element} Row.
 */
function EventRow({ row, item, context }: RowContext & { row: Row<MyDayEntry>; item: MyDayEvent }) {
  const { occurrence } = item;
  const openEvent = useEventForm(context);
  const menu = useEventMenu(occurrence);
  const end = row.part === 'end' ? 'fin' : row.part === 'start' ? 'début' : null;
  return (
    <RowLine
      time={row.time}
      finished={occurrence.calledOff ? 'cancelled' : null}
      label={<OpenLabel onClick={() => void openEvent({ occurrence })}>{occurrence.label}</OpenLabel>}
      details={
        <>
          {occurrence.allDay && (
            <Text size="xs" c="dimmed">
              toute la journée
            </Text>
          )}
          {end && (
            <Text size="xs" c="dimmed">
              {end}
            </Text>
          )}
          {occurrence.calledOff && (
            <Badge color="gray" variant="light">
              Annulé
            </Badge>
          )}
        </>
      }
      actions={
        <>
          {!occurrence.calledOff && <EventTimerToggle context={context} occurrence={occurrence} size="sm" />}
          <ActionsMenu name={occurrence.label} items={menu} />
        </>
      }
    />
  );
}

/**
 * Row of an éphéméride: its name, in the colour of its kind.
 * @param {{ item: MyDayEphemeris }} props Component props.
 * @param {MyDayEphemeris} props.item Éphéméride.
 * @returns {JSX.Element} Row.
 */
function EphemerisRow({ item }: { item: MyDayEphemeris }) {
  return (
    <RowLine
      state={<SparkleIcon aria-hidden color={item.color ?? 'var(--mantine-color-dimmed)'} />}
      time={null}
      label={
        <Text size="sm" fs="italic">
          {item.label}
        </Text>
      }
    />
  );
}

/**
 * Row of a birthday: its name, opening its person.
 * @param {{ item: MyDayBirthday }} props Component props.
 * @param {MyDayBirthday} props.item Birthday.
 * @returns {JSX.Element} Row.
 */
function BirthdayRow({ item }: { item: MyDayBirthday }) {
  const openPerson = usePersonOpener();
  return <RowLine state={<CakeIcon aria-hidden />} time={null} label={<OpenLabel onClick={() => openPerson(item.birthday)}>{item.label}</OpenLabel>} />;
}

/**
 * A row of « Ma journée », by the kind of its item, with the tasks and routines under it (linked to an event, of a
 * group).
 * @param {RowContext & { row: Row<MyDayEntry> }} props Component props.
 * @returns {JSX.Element} Row.
 */
export function MyDayRowView({ row, ...rest }: RowContext & { row: Row<MyDayEntry> }) {
  const { item } = row;
  const line =
    item.kind === 'task' ? (
      <TaskRow row={row} item={item} {...rest} />
    ) : item.kind === 'routine' ? (
      <RoutineRow row={row} item={item} {...rest} />
    ) : item.kind === 'routineGroup' ? (
      <RoutineGroupRow row={row} item={item} {...rest} />
    ) : item.kind === 'event' ? (
      <EventRow row={row} item={item} {...rest} />
    ) : item.kind === 'ephemeris' ? (
      <EphemerisRow item={item} />
    ) : (
      <BirthdayRow item={item} />
    );
  if (!row.children.length) return line;
  return (
    <Stack gap={0}>
      {line}
      <Stack gap={0} className={classes.children}>
        {row.children.map((child) => (
          <MyDayRowView key={child.item.key} row={child} {...rest} />
        ))}
      </Stack>
    </Stack>
  );
}
