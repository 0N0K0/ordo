import { Group, Paper, Stack, Text } from "@mantine/core";
import {
  twoDigits,
  type MyDayHour,
  type MyDayRow,
  type MyDaySettings,
} from "@ordo/shared";
import { ArrowsClockwiseIcon, CalendarPlusIcon, CheckSquareOffsetIcon, PlusIcon, SunIcon } from "@phosphor-icons/react";
import { useMemo, useState, type CSSProperties } from "react";
import { useProvideAddDay, type AddDay } from "../../../app/layout/page-add";
import { PageSettings } from "../../../app/layout/PageSettings";
import { PAGES } from "../../../app/pages";
import { ActionButton } from "../../../components/actions/ActionButton";
import { ErrorAlert } from "../../../components/feedback/ErrorAlert";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ListSkeleton } from "../../../components/feedback/Skeletons";
import { Caption } from "../../../components/page/Caption";
import { DayNav } from "../../../components/page/DayNav";
import { PageHeader } from "../../../components/page/PageHeader";
import { SettingsSection } from "../../../components/settings/SettingsSection";
import { parisToday } from "../../../lib/dates";
import { unarchived } from "../../../lib/archive";
import { useCalendars, useScheduleSources } from "../../calendar/api";
import { CalendarDisplayChoices } from "../../calendar/components/CalendarDisplayChoices";
import { CalendarFilters } from "../../calendar/components/CalendarFilters";
import { scheduleSources } from "../../calendar/lib/calendar-events";
import {
  calendarChoices,
  scheduleChoices,
} from "../../calendar/lib/layer-label";
import type { TaskContext } from "../../tasks/hooks/use-task-context";
import { MyDayRowView } from "../components/MyDayRows";
import classes from "../components/MyDay.module.css";
import { useDayAdd } from "../hooks/use-day-add";
import {
  useMyDay,
  type MyDayEntry,
  type MyDayHourSlot,
} from "../hooks/use-my-day";

/** What the rows of a block read. */
interface BlockProps {
  rows: MyDayRow<MyDayEntry>[];
  context: TaskContext;
  today: string;
  /** Day shown (YYYY-MM-DD). */
  day: string;
}

/**
 * Rows of a block, one under the other.
 * @param {BlockProps} props Component props.
 * @returns {JSX.Element[]} Rows.
 */
function Rows({ rows, context, today, day }: BlockProps) {
  return (
    <>
      {rows.map((row) => (
        <MyDayRowView
          key={row.item.key}
          row={row}
          context={context}
          today={today}
          day={day}
        />
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
      {title && <Caption>{title}</Caption>}
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
function hourStyle(
  hour: MyDayHour<MyDayEntry, MyDayHourSlot>,
): CSSProperties | undefined {
  const [slot] = hour.slots;
  if (!slot) return undefined;
  const color = slot.color
    ? `color-mix(in srgb, ${slot.color} 15%, transparent)`
    : "var(--mantine-color-green-light)";
  return { "--slot-color": color } as CSSProperties;
}

/**
 * An hour of the day: its time, the slots met during it (« Indisponible » told), and its rows.
 * @param {Omit<BlockProps, 'rows'> & { hour: MyDayHour<MyDayEntry, MyDayHourSlot> }} props Component props.
 * @returns {JSX.Element} Hour.
 */
function HourBlock({
  hour,
  context,
  today,
  day,
}: Omit<BlockProps, "rows"> & { hour: MyDayHour<MyDayEntry, MyDayHourSlot> }) {
  const names = [...new Set(hour.slots.map((slot) => slot.label))];
  return (
    <div
      className={classes.hour}
      style={hourStyle(hour)}
      data-unavailable={hour.unavailable || undefined}
      data-current={hour.current || undefined}
      aria-current={hour.current ? "time" : undefined}
    >
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
        <Rows rows={hour.rows} context={context} today={today} day={day} />
      </Stack>
    </div>
  );
}

/**
 * Settings of « Ma journée », in the sidebar of the page (⚙), as the display choices of the agenda: the calendars of
 * the workspace and the créneaux and éphémérides shown (those of the workspaces it subscribes to too), none archived nor
 * of an archived kind, in their workspace (the day never shows them), and the kinds of
 * items (tasks, routines, créneaux and éphémérides with the birthdays); saved on the server at each change.
 * @param {{ settings: MyDaySettings, onChange: (patch: Partial<MyDaySettings>) => void }} props Component props.
 * @returns {JSX.Element} Settings.
 */
function MyDaySettingsPanel({
  settings,
  onChange,
}: {
  settings: MyDaySettings;
  onChange: (patch: Partial<MyDaySettings>) => void;
}) {
  const { data: calendarsData } = useCalendars();
  const { schedules, foreign, types, defaultKind } = useScheduleSources();
  // The day shows the events of the calendars of the workspace only.
  const calendars = useMemo(
    () => calendarChoices(unarchived(calendarsData?.calendars ?? []), []),
    [calendarsData],
  );
  const shownSchedules = useMemo(
    () =>
      scheduleChoices(
        scheduleSources(
          schedules ?? [],
          foreign ?? [],
          types ?? [],
          defaultKind,
          false,
        ),
      ),
    [schedules, foreign, types, defaultKind],
  );
  return (
    <SettingsSection
      title="Affichage"
      description="Enregistré pour vous dans cet espace, dès que vous le changez."
    >
      <CalendarDisplayChoices
        shown={settings}
        calendars={calendars}
        schedules={shownSchedules}
        alsoLabel="Aussi dans Ma journée"
        onChange={onChange}
      />
    </SettingsSection>
  );
}

/**
 * « Ajouter » of the day, as in the agenda: a new task, event or routine on the day shown (past days too), in the side
 * panel, prefilled as the header « Ajouter » prefills it on this page (`useDayAdd`): a task opened and due that day, an
 * event all day in the first calendar shown, a routine done the first time that day.
 * @param {{ addDay: AddDay | null, context: TaskContext | null }} props Component props: the day shown and the calendars hidden (null until the saved settings and the calendars are loaded), the task context (null while loading).
 * @returns {JSX.Element} Button and its menu.
 */
function MyDayAdd({ addDay, context }: { addDay: AddDay | null; context: TaskContext | null }) {
  const add = useDayAdd(context);
  return (
    <ActionButton
      icon={<PlusIcon aria-hidden />}
      menu={[
        {
          label: "Tâche",
          icon: <CheckSquareOffsetIcon aria-hidden />,
          disabled: !context || !addDay,
          onClick: () => add.task(addDay),
        },
        {
          label: "Évènement",
          icon: <CalendarPlusIcon aria-hidden />,
          disabled: !context || !addDay,
          onClick: () => add.event(addDay),
        },
        {
          label: "Routine",
          icon: <ArrowsClockwiseIcon aria-hidden />,
          disabled: !addDay,
          onClick: () => add.routine(addDay),
        },
      ]}
    >
      Ajouter
    </ActionButton>
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
  const {
    layout,
    settings,
    settingsReady,
    changeSettings,
    filterSections,
    context,
    today,
    loading,
    error,
  } = useMyDay(day);
  const { data: calendarsData } = useCalendars();
  // The day the items are added onto, here and in the header, once the calendars shown are known.
  const addDay = useMemo(
    () =>
      settingsReady && calendarsData
        ? { day, hiddenCalendarIds: settings.hiddenCalendarIds }
        : null,
    [settingsReady, calendarsData, day, settings.hiddenCalendarIds],
  );
  useProvideAddDay(addDay);
  const empty =
    layout !== null &&
    !layout.header.length &&
    !layout.unscheduled.length &&
    !layout.finished.length &&
    !layout.hours.some((hour) => hour.rows.length);

  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.myDay.label} />
      {/* The day, then « Filtrer », on the left, as the period and the filters of the agenda; « Ajouter » on the right. */}
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="wrap">
          <DayNav day={day} onChange={setDay} />
          {settingsReady && (
            <CalendarFilters
              sections={filterSections}
              onChange={(kind, filter) =>
                changeSettings((current) => ({
                  filters: { ...current.filters, [kind]: filter },
                }))
              }
            />
          )}
        </Group>
        <MyDayAdd addDay={addDay} context={context} />
      </Group>
      <PageSettings title="Paramètres de Ma journée">
        {/* Shown once the saved settings are loaded: a change before would save the defaults over them. */}
        {settingsReady ? (
          <MyDaySettingsPanel settings={settings} onChange={changeSettings} />
        ) : (
          <ListSkeleton items={3} />
        )}
      </PageSettings>
      {error ? (
        <ErrorAlert title="Journée indisponible">
          Les éléments de ce jour n’ont pas pu être chargés. Rechargez la page
          pour réessayer.
        </ErrorAlert>
      ) : loading || !layout || !context ? (
        <ListSkeleton items={6} />
      ) : empty ? (
        <EmptyState
          icon={<SunIcon aria-hidden />}
          message={
            day === today
              ? "Rien de prévu aujourd’hui."
              : "Rien de prévu ce jour-là."
          }
        />
      ) : (
        <Paper withBorder radius="md">
          <Block rows={layout.header} context={context} today={today} day={day} />
          <Block
            title="Sans horaire"
            rows={layout.unscheduled}
            context={context}
            today={today}
            day={day}
          />
          {layout.hours.map((hour) => (
            <HourBlock
              key={hour.hour}
              hour={hour}
              context={context}
              today={today}
              day={day}
            />
          ))}
          <Block
            title="Faits et annulés"
            rows={layout.finished}
            context={context}
            today={today}
            day={day}
          />
        </Paper>
      )}
    </Stack>
  );
}
