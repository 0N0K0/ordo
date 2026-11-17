import { Checkbox, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { readScheduleDisplay, type ScheduleDayDisplay, type ScheduleDisplay, type ScheduleMonthDisplay } from '@ordo/shared';

const DAY_DISPLAYS: { value: ScheduleDayDisplay; label: string }[] = [
  { value: 'SLOT_BACKGROUND', label: 'Fond sur les horaires' },
  { value: 'DAY_BACKGROUND', label: 'Fond sur toute la journée' },
  { value: 'SLOT_BORDER', label: 'Fine bordure à gauche des horaires' },
  { value: 'NONE', label: 'Rien' },
];
const MONTH_DISPLAYS: { value: ScheduleMonthDisplay; label: string }[] = [
  { value: 'BACKGROUND', label: 'Fond du jour' },
  { value: 'BORDER', label: 'Bordure en bas' },
  { value: 'NONE', label: 'Rien' },
];

interface ScheduleLookEditorProps {
  value: { dayDisplay: string; dayBar: boolean; monthDisplay: string };
  onChange: (display: ScheduleDisplay) => void;
  /** Name of the kind, for the labels. */
  name: string;
}

/**
 * How the slots of a kind show in the calendar: in the week and the day (their hours or the whole day in the
 * background, a thin line on the left of their hours, or nothing; a bar at the top or not), and in the month (the
 * day in the background, a thin line at its bottom, or nothing).
 * @param {ScheduleLookEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function ScheduleLookEditor({ value, onChange, name }: ScheduleLookEditorProps) {
  const display = readScheduleDisplay(value);
  return (
    <Stack gap={6}>
      <Group gap="xs" align="center">
        <Text size="xs" w={120}>
          Semaine et jour
        </Text>
        <Select
          size="xs"
          w={250}
          aria-label={`Affichage de ${name} en semaine et en jour`}
          data={DAY_DISPLAYS}
          value={display.dayDisplay}
          allowDeselect={false}
          onChange={(dayDisplay) => dayDisplay && onChange({ ...display, dayDisplay: dayDisplay as ScheduleDayDisplay })}
        />
        <Checkbox size="xs" label="Bandeau en haut" checked={display.dayBar} onChange={(event) => onChange({ ...display, dayBar: event.currentTarget.checked })} />
      </Group>
      <Group gap="xs" align="center">
        <Text size="xs" w={120}>
          Mois
        </Text>
        <SegmentedControl
          size="xs"
          aria-label={`Affichage de ${name} en mois`}
          data={MONTH_DISPLAYS}
          value={display.monthDisplay}
          onChange={(monthDisplay) => onChange({ ...display, monthDisplay: monthDisplay as ScheduleMonthDisplay })}
        />
      </Group>
    </Stack>
  );
}
