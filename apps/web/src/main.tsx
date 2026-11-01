import '@mantine/core/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
import '@mantine/dates/styles.layer.css';
import 'dayjs/locale/fr';
import './styles/layers.css';

import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { IconContext } from '@phosphor-icons/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { queryClient } from './lib/query-client';
import { router } from './router';
import { iconDefaults, theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: 1 }}>
        <IconContext.Provider value={iconDefaults}>
          <Notifications position="top-right" />
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </IconContext.Provider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
