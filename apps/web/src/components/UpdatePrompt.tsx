import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { notifyInfo } from '../lib/notify';

const NOTIFICATION_ID = 'app-update';
/** A deployed version is looked for this often while the app stays open. */
const CHECK_MS = 60 * 60_000;

/**
 * Offers the new version of the app once it is downloaded (installed app or browser tab): an information toast
 * with a reload button. Renders nothing.
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
    notifyInfo({
      id: NOTIFICATION_ID,
      icon: <ArrowsClockwiseIcon />,
      title: 'Nouvelle version d’Ordo',
      lines: ['Rechargez pour l’utiliser.'],
      actions: [{ label: 'Recharger', onClick: () => void updateServiceWorker(true) }],
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
