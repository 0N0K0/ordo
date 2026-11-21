import '@mantine/core/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
import '@mantine/dates/styles.layer.css';
import '@mantine/tiptap/styles.layer.css';
import '@mantine/charts/styles.layer.css';
import 'dayjs/locale/fr';
import './styles/layers.css';
import './styles/tokens.css';
import './styles/dialogs.css';
import './styles/tabs.css';
import './styles/reveal.css';
import './styles/drop.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { IconContext } from '@phosphor-icons/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { UpdatePrompt } from './app/UpdatePrompt';
import { WeekDatesProvider } from './app/WeekDatesProvider';
import { queryClient } from './lib/query-client';
import { router } from './app/router';
import { iconDefaults, theme } from './app/theme';

// A page whose code is gone (a new version was deployed since this one loaded): the app is reloaded, once.
window.addEventListener('vite:preloadError', () => {
  const key = 'ordo-reloaded';
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    return;
  }
  window.location.reload();
});

// The app has started: its update toast takes over from public/boot-rescue.js.
document.documentElement.setAttribute('data-app-started', '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <WeekDatesProvider>
          <IconContext.Provider value={iconDefaults}>
            <Notifications position="top-right" />
            <UpdatePrompt />
            <RouterProvider router={router} />
          </IconContext.Provider>
        </WeekDatesProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
