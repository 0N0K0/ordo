import { Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const NOTIFICATION_ID = 'app-update';
/** A deployed version is looked for this often while the app stays open. */
const CHECK_MS = 60 * 60_000;

/**
 * Offers the new version of the app once it is downloaded (installed app or browser tab): a toast that stays
 * until the user reloads or closes it. Renders nothing.
 * @returns {null} Nothing.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    /**
     * Looks for a new version regularly (the app may stay open for days).
     * @param {string} _url Service worker script.
     * @param {ServiceWorkerRegistration | undefined} registration Registration.
     * @returns {void}
     */
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), CHECK_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    notifications.show({
      id: NOTIFICATION_ID,
      icon: <ArrowsClockwiseIcon />,
      title: 'Nouvelle version d’Ordo',
      autoClose: false,
      message: (
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Text size="sm">Rechargez pour l’utiliser.</Text>
          <Button size="xs" onClick={() => void updateServiceWorker(true)}>
            Recharger
          </Button>
        </Group>
      ),
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
