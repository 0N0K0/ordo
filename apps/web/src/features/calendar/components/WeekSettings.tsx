import { Group, Select, Text } from '@mantine/core';
import { readWeek, WEEKDAY_LABELS, weekLength } from '@ordo/shared';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ON_ERROR } from '../../../lib/notify';
import { countOf } from '../../../lib/text';
import { useActiveWorkspace, useWorkspaceMutations } from '../../workspaces/api';

const WEEKDAYS = WEEKDAY_LABELS.map((label, index) => ({ value: String(index + 1), label }));

/**
 * Week of the workspace (« Semaine du … au … »), each day saved when chosen: it sets the week view of the calendar and
 * every « this week » of the workspace (filters, planned time, home, dashboards, mail scheduling).
 * @returns {JSX.Element | null} Section, nothing before the workspace is loaded.
 */
export function WeekSettings() {
  const { workspace } = useActiveWorkspace();
  const { setWeek } = useWorkspaceMutations();
  if (!workspace) return null;
  const week = readWeek(workspace);
  /**
   * Saves one end of the week, the other one kept.
   * @param {Partial<{ start: number, end: number }>} change Day changed.
   * @returns {void}
   */
  const save = (change: Partial<{ start: number; end: number }>) => setWeek.mutate({ id: workspace.id, start: week.start, end: week.end, ...change }, ON_ERROR);
  const length = weekLength(week);
  return (
    <SettingsSection
      title="Semaine"
      description="Pour tout l’espace : vue semaine de l’agenda, « cette semaine » des filtres, temps prévu, accueil, tableaux de bord, envoi programmé des mails. Les sélecteurs de date vont toujours du lundi au dimanche."
    >
      <Group gap="xs" align="center">
        <Text size="sm">Semaine du</Text>
        <Select
          size="xs"
          w={120}
          aria-label="Premier jour de la semaine"
          data={WEEKDAYS}
          value={String(week.start)}
          allowDeselect={false}
          onChange={(value) => value && save({ start: Number(value) })}
        />
        <Text size="sm">au</Text>
        <Select
          size="xs"
          w={120}
          aria-label="Dernier jour de la semaine"
          data={WEEKDAYS}
          value={String(week.end)}
          allowDeselect={false}
          onChange={(value) => value && save({ end: Number(value) })}
        />
        <Text size="xs" c="dimmed">
          {length === 8 ? '8 jours : les semaines se chevauchent ce jour-là.' : `${countOf(length, 'jour')}.`}
        </Text>
      </Group>
    </SettingsSection>
  );
}
