import { Paper, Stack, Text } from '@mantine/core';
import { twoDigits, type MyDayHour, type MyDayRow } from '@ordo/shared';
import { SunIcon } from '@phosphor-icons/react';
import { useState, type CSSProperties } from 'react';
import { PAGES } from '../../../app/pages';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Caption } from '../../../components/page/Caption';
import { DayNav } from '../../../components/page/DayNav';
import { PageHeader } from '../../../components/page/PageHeader';
import { parisToday } from '../../../lib/dates';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { MyDayRowView } from '../components/MyDayRows';
import classes from '../components/MyDay.module.css';
import { useMyDay, type MyDayEntry, type MyDayHourSlot } from '../hooks/use-my-day';

/** What the rows of a block read. */
interface BlockProps {
  rows: MyDayRow<MyDayEntry>[];
  context: TaskContext;
  today: string;
}

/**
 * Rows of a block, one under the other.
 * @param {BlockProps} props Component props.
 * @returns {JSX.Element[]} Rows.
 */
function Rows({ rows, context, today }: BlockProps) {
  return (
    <>
      {rows.map((row) => (
        <MyDayRowView key={row.item.key} row={row} context={context} today={today} />
      ))}
    </>
  );
}

/**
 * A block of the day, under a small title when it has one.
 * @param {BlockProps & { title?: string }} props Component props.
 * @returns {JSX.Element | null} Block, nothing without rows.
 */
function Block({ title, ...props }: BlockProps & { title?: string }) {
  if (!props.rows.length) return null;
  return (
    <Stack gap={0} className={classes.block}>
      {title && (
        <Caption>{title}</Caption>
      )}
      <Rows {...props} />
    </Stack>
  );
}

/**
 * Background of an hour: the colour of the first slot met (the working hours in green), greyed when one is
 * « Indisponible » (the CSS does it).
 * @param {MyDayHour<MyDayEntry, MyDayHourSlot>} hour Hour.
 * @returns {CSSProperties | undefined} Style.
 */
function hourStyle(hour: MyDayHour<MyDayEntry, MyDayHourSlot>): CSSProperties | undefined {
  const [slot] = hour.slots;
  if (!slot) return undefined;
  const color = slot.color ? `color-mix(in srgb, ${slot.color} 15%, transparent)` : 'var(--mantine-color-green-light)';
  return { '--slot-color': color } as CSSProperties;
}

/**
 * An hour of the day: its time, the slots met during it (« Indisponible » told), and its rows.
 * @param {Omit<BlockProps, 'rows'> & { hour: MyDayHour<MyDayEntry, MyDayHourSlot> }} props Component props.
 * @returns {JSX.Element} Hour.
 */
function HourBlock({ hour, context, today }: Omit<BlockProps, 'rows'> & { hour: MyDayHour<MyDayEntry, MyDayHourSlot> }) {
  const names = [...new Set(hour.slots.map((slot) => slot.label))];
  return (
    <div className={classes.hour} style={hourStyle(hour)} data-unavailable={hour.unavailable || undefined} data-current={hour.current || undefined} aria-current={hour.current ? 'time' : undefined}>
      <Stack gap={0} className={classes.hourLabel}>
        <Text size="sm" ff="monospace" fw={hour.current ? 700 : undefined}>
          {twoDigits(hour.hour)}:00
        </Text>
        {names.map((name) => (
          <Text key={name} size="xs" c="dimmed" truncate>
            {name}
          </Text>
        ))}
        {hour.unavailable && (
          <Text size="xs" c="dimmed" fs="italic">
            Indisponible
          </Text>
        )}
      </Stack>
      <Stack gap={0}>
        <Rows rows={hour.rows} context={context} today={today} />
      </Stack>
    </div>
  );
}

/**
 * « Ma journée »: the routines, tasks and events of a day of the current workspace with their hours (today by
 * default; previous and next day, or a day picked), in four blocks: its head (éphémérides, events of the whole day,
 * birthdays, late items), the items without hours, the hours (their slots as a background, « Indisponible » greyed,
 * the hour of now marked today), then those done and cancelled; a message when its data cannot be loaded. Each row: its state button (none for an event), its
 * chrono, its name opening its panel, its menu; the tasks and routines linked to an event under it.
 * @returns {JSX.Element} Page.
 */
export function MyDayPage() {
  const [day, setDay] = useState(parisToday);
  const { layout, context, today, loading, error } = useMyDay(day);
  const empty = layout !== null && !layout.header.length && !layout.unscheduled.length && !layout.finished.length && !layout.hours.some((hour) => hour.rows.length);

  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.myDay.label} />
      <DayNav day={day} onChange={setDay} />
      {error ? (
        <ErrorAlert title="Journée indisponible">Les éléments de ce jour n’ont pas pu être chargés. Rechargez la page pour réessayer.</ErrorAlert>
      ) : loading || !layout || !context ? (
        <ListSkeleton items={6} />
      ) : empty ? (
        <EmptyState icon={<SunIcon aria-hidden />} message={day === today ? 'Rien de prévu aujourd’hui.' : 'Rien de prévu ce jour-là.'} />
      ) : (
        <Paper withBorder radius="md">
          <Block rows={layout.header} context={context} today={today} />
          <Block title="Sans horaire" rows={layout.unscheduled} context={context} today={today} />
          {layout.hours.map((hour) => (
            <HourBlock key={hour.hour} hour={hour} context={context} today={today} />
          ))}
          <Block title="Faits et annulés" rows={layout.finished} context={context} today={today} />
        </Paper>
      )}
    </Stack>
  );
}
