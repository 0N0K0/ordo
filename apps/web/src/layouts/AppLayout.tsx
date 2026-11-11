import { AppShell, Burger, Button, Group, Menu, Stack } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { ModalsProvider } from '@mantine/modals';
import { CaretDownIcon, SignOutIcon, UserIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useLogout, useMe } from '../features/auth/api';
import { TaskPanel } from '../features/tasks/TaskPanel';
import { AlarmCenter } from '../features/alarms/AlarmCenter';
import { Sidebar } from '../features/workspace/sidebar/Sidebar';
import { MailWatcher } from '../features/mail/MailWatcher';
import { ElsewhereNotifier } from '../features/workspaces/ElsewhereNotifier';
import { WorkspaceGate } from '../features/workspaces/WorkspaceGate';
import { WorkspaceSwitcher } from '../features/workspaces/WorkspaceSwitcher';
import { notifyError } from '../lib/notify';
import classes from './AppLayout.module.css';
import { HeaderClock } from './HeaderClock';
import { QuickActions } from './QuickActions';
import { TimerWidget } from '../features/time/TimerWidget';
import { useResizableSidebar } from './use-resizable-sidebar';

/**
 * Layout of the logged-in area, once its workspace is known: header (with the workspace switcher), resizable
 * client/project sidebar and page content.
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
      <WorkspaceGate>
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
            <div className={classes.header}>
              <Group gap="sm" wrap="nowrap">
                <Burger
                  opened={sidebarOpened}
                  onClick={mobile ? mobileSidebar.toggle : sidebar.toggle}
                  size="sm"
                  aria-label={sidebarOpened ? 'Masquer la barre latérale' : 'Afficher la barre latérale'}
                />
                <WorkspaceSwitcher />
                <QuickActions />
              </Group>
              <HeaderClock />
              <Group gap="sm" wrap="nowrap" justify="flex-end">
                <TimerWidget />
                {/* The logged-in account: its page and the logout, on hover (or a click, by touch or keyboard). */}
                <Menu trigger="click-hover" openDelay={60} closeDelay={150} position="bottom-end" shadow="md" withinPortal>
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<UserIcon aria-hidden />}
                      rightSection={<CaretDownIcon aria-hidden size={12} />}
                      loading={logout.isPending}
                      aria-haspopup="menu"
                      maw={200}
                    >
                      {user?.username ?? 'Mon compte'}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item component={Link} to="/account" leftSection={<UserIcon aria-hidden />}>
                      Mon compte
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item leftSection={<SignOutIcon aria-hidden />} onClick={handleLogout}>
                      Me déconnecter
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </div>
          </AppShell.Header>

          <AlarmCenter />
          <ElsewhereNotifier />
          <MailWatcher />
          <AppShell.Navbar aria-label="Clients et projets">
            <Sidebar />
            {!mobile && (
              <div
                className={classes.resizeHandle}
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionner la barre latérale"
                onPointerDown={sidebar.onResizeStart}
                onDoubleClick={sidebar.onResizeReset}
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
      </WorkspaceGate>
    </ModalsProvider>
  );
}
