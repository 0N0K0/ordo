import { Group, Text } from '@mantine/core';
import { InfoIcon } from '@phosphor-icons/react';

/**
 * One line saying that the settings shown in a narrower place (a project) are those of the whole workspace: the
 * same everywhere, the same wording.
 * @returns {JSX.Element} Note.
 */
export function SettingsScopeNote() {
  return (
    <Group gap={6} wrap="nowrap" c="dimmed">
      <InfoIcon aria-hidden />
      <Text size="sm">Ces paramètres valent pour tout l’espace, pas seulement pour ce projet.</Text>
    </Group>
  );
}
