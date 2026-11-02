import { Anchor, AppShell, Burger, Button, Group, Stack } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { ModalsProvider } from '@mantine/modals';
import { SignOutIcon, UserIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useLogout, useMe } from '../features/auth/api';
import { TaskPanel } from '../features/tasks/TaskPanel';
import { AlarmCenter } from '../features/alarms/AlarmCenter';
import { TimerWidget } from '../features/time/TimerWidget';
import { Sidebar } from '../features/workspace/sidebar/Sidebar';
import { notifyError } from '../lib/notify';
import classes from './AppLayout.module.css';
import { useResizableSidebar } from './use-resizable-sidebar';

/**
 * Layout of the logged-in area: header, resizable client/project sidebar and page content.
 * @returns {JSX.Element} Layout wrapping the child route.
 */
export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const sidebar = useResizableSidebar();
  const mobile = useMediaQuery('(max-width: 48em)');
  const [mobileOpened, mobileSidebar] = useDisclosure(false);
  const { pathname } = useLocation();

  // The mobile drawer closes after navigating.
  useEffect(() => {
    mobileSidebar.close();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Closes the session; the guard then redirects to /login.
   * @returns {void}
   */
  const handleLogout = () => {
    logout.mutate(undefined, { onError: (error) => notifyError(error.message) });
  };

  const sidebarOpened = mobile ? mobileOpened : sidebar.opened;

  return (
    <ModalsProvider modalProps={{ centered: true }}>
      <AppShell
        header={{ height: 56 }}
        navbar={{
          width: sidebar.width,
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpened, desktop: !sidebar.opened },
        }}
        padding="md"
        data-resizing={sidebar.resizing || undefined}
        className={classes.shell}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Burger
                opened={sidebarOpened}
                onClick={mobile ? mobileSidebar.toggle : sidebar.toggle}
                size="sm"
                aria-label={sidebarOpened ? 'Masquer la barre latérale' : 'Afficher la barre latérale'}
              />
              <Anchor component={Link} to="/" fw={700} c="inherit" underline="never">
                Ordo
              </Anchor>
            </Group>
            <Group gap="sm" wrap="nowrap">
              <TimerWidget />
              <Button
                component={NavLink}
                to="/account"
                variant="subtle"
                size="xs"
                leftSection={<UserIcon aria-hidden />}
                aria-label="Mon compte"
              >
                {user?.username ?? 'Mon compte'}
              </Button>
              <Button
                variant="default"
                size="xs"
                leftSection={<SignOutIcon aria-hidden />}
                onClick={handleLogout}
                loading={logout.isPending}
              >
                Se déconnecter
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AlarmCenter />
        <AppShell.Navbar aria-label="Clients et projets">
          <Sidebar />
          {!mobile && (
            <div
              className={classes.resizeHandle}
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionner la barre latérale"
              onPointerDown={sidebar.onResizeStart}
            />
          )}
        </AppShell.Navbar>

        {/* Pages use the full available width. */}
        <AppShell.Main>
          <Stack gap="md">
            <Outlet />
          </Stack>
          {/* Task of ?task=12, over any page. */}
          <TaskPanel />
        </AppShell.Main>
      </AppShell>
    </ModalsProvider>
  );
}
