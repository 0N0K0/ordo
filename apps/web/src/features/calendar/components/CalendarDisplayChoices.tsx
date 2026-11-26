import { Switch } from '@mantine/core';
import type { CalendarViewConfig } from '@ordo/shared';
import { useMemo, type ReactNode } from 'react';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { useActiveWorkspace } from '../../workspaces/api';
import type { LayerChoice } from '../lib/layer-label';
import { EPHEMERIDES_TITLE, schedulesTitle } from '../lib/schedule-text';
import { HiddenChecklist } from './HiddenChecklist';

/** What the display choices change: the kinds of items shown, and the calendars and schedules left out. */
export type CalendarDisplayChoice = Pick<CalendarViewConfig, 'tasks' | 'routines' | 'schedules' | 'timers' | 'hiddenCalendarIds' | 'hiddenScheduleIds'>;

interface CalendarDisplayChoicesProps {
  /** Choices as they are; without `timers`, no « Chronos » (a page that shows none). */
  shown: Omit<CalendarDisplayChoice, 'timers'> & { timers?: boolean };
  /** Calendars that can be shown. */
  calendars: readonly LayerChoice[];
  /** Créneaux and éphémérides that can be shown. */
  schedules: readonly LayerChoice[];
  /** Title of the kinds shown (« Aussi dans l’agenda »). */
  alsoLabel: string;
  /** Called with the choices changed. */
  onChange: (patch: Partial<CalendarDisplayChoice>) => void;
  /** After the switches of the kinds (« Afficher les archivés »). Optional. */
  children?: ReactNode;
}

/**
 * What a page of the agenda shows (the agenda, « Ma journée »), the same choices everywhere: a box per calendar and per
 * créneau or éphéméride (ticked when shown, kept as those left out; the schedules disabled while their kind is hidden),
 * then a switch per kind of items (« Tâches », « Routines », « Créneaux et éphémérides » with the birthdays, and
 * « Chronos » when the page shows some).
 * @param {CalendarDisplayChoicesProps} props Component props.
 * @returns {JSX.Element} Choices.
 */
export function CalendarDisplayChoices({ shown, calendars, schedules, alsoLabel, onChange, children }: CalendarDisplayChoicesProps) {
  const { perso } = useActiveWorkspace();
  const schedulesLabel = `${schedulesTitle(perso)} et ${EPHEMERIDES_TITLE.toLowerCase()}`;
  const hiddenCalendars = useMemo(() => new Set(shown.hiddenCalendarIds), [shown.hiddenCalendarIds]);
  const hiddenSchedules = useMemo(() => new Set(shown.hiddenScheduleIds), [shown.hiddenScheduleIds]);
  const kinds: [keyof CalendarDisplayChoice, string, boolean | undefined][] = [
    ['tasks', 'Tâches', shown.tasks],
    ['routines', 'Routines', shown.routines],
    ['schedules', schedulesLabel, shown.schedules],
    ['timers', 'Chronos', shown.timers],
  ];
  return (
    <>
      <HiddenChecklist label="Calendriers" empty="Aucun calendrier." choices={calendars} hidden={hiddenCalendars} onChange={(hiddenCalendarIds) => onChange({ hiddenCalendarIds })} />
      <HiddenChecklist
        label={schedulesLabel}
        empty="Aucun créneau."
        choices={schedules}
        hidden={hiddenSchedules}
        disabled={!shown.schedules}
        onChange={(hiddenScheduleIds) => onChange({ hiddenScheduleIds })}
      />
      <LabeledField label={alsoLabel} gap="xs">
        {kinds.map(([key, label, checked]) =>
          checked === undefined ? null : <Switch key={key} label={label} checked={checked} onChange={(event) => onChange({ [key]: event.currentTarget.checked })} />,
        )}
        {children}
      </LabeledField>
    </>
  );
}
