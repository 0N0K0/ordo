import { SidePanelHost } from '../../components/panels/SidePanel';
import { AppShell, Burger, Group, Stack } from '@mantine/core';
import { ActionButton } from '../../components/actions/ActionButton';
import { ActionsMenu } from '../../components/actions/ActionsMenu';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { ModalsProvider } from '@mantine/modals';
import { SignOutIcon, UserIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useLogout, useMe } from '../../features/auth/api';
import { TaskPanel } from '../../features/tasks/components/TaskPanel';
import { AlarmCenter } from '../../features/alarms/components/AlarmCenter';
import { Sidebar } from '../../features/projects/components/Sidebar';
import { MailWatcher } from '../../features/mail/components/MailWatcher';
import { ElsewhereNotifier } from '../../features/workspaces/components/ElsewhereNotifier';
import { WorkspaceGate } from '../../features/workspaces/components/WorkspaceGate';
import { WorkspaceSwitcher } from '../../features/workspaces/components/WorkspaceSwitcher';
import { ON_ERROR } from '../../lib/notify';
import classes from './AppLayout.module.css';
import { HeaderClock } from './HeaderClock';
import { HeaderTitle } from './HeaderTitle';
import { QuickActions } from './QuickActions';
import { PageSettingsContext, useSettingsOpened } from './page-settings';
import { SettingsAside } from './SettingsAside';
import { SettingsButton } from './SettingsButton';
import { SettingsOverlay } from './SettingsOverlay';
import { TimerWidget } from '../../features/time/components/TimerWidget';
import { useResizablePanel } from './use-resizable-panel';
import { SETTINGS_PANEL, SIDEBAR_PANEL } from './panel-widths';
import { ResizeHandle } from './ResizeHandle';
import { useIsPhone } from '../../lib/use-is-phone';
import { PAGES } from '../pages';
import { MenuCaret } from '../../components/actions/MenuCaret';

/**
 * Layout of the logged-in area, once its workspace is known: header (with the workspace switcher), resizable
 * client/project sidebar and page content.
 * @returns {JSX.Element} Layout wrapping the child route.
 */
export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  // Open state of the sidebar, kept (each window its own).
  const [sidebarShown, setSidebarShown] = useLocalStorage({ key: 'ordo.sidebar.opened', sync: false, defaultValue: true });
  const sidebar = useResizablePanel({ ...SIDEBAR_PANEL, opened: sidebarShown, setOpened: setSidebarShown });
  const mobile = useIsPhone();
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
    logout.mutate(undefined, ON_ERROR);
  };

  const sidebarOpened = mobile ? mobileOpened : sidebarShown;
  // Settings of the page shown (drawn by the page in the sidebar on the right).
  const [settingsTitle, setSettingsTitle] = useState<string | null>(null);
  const [settingsContainer, setSettingsContainer] = useState<HTMLDivElement | null>(null);
  const { opened: settingsOpened, setOpened: setSettingsOpened } = useSettingsOpened();
  const aside = useResizablePanel({ ...SETTINGS_PANEL, opened: settingsOpened, setOpened: setSettingsOpened });
  const closeSettings = useCallback(() => setSettingsOpened(false), [setSettingsOpened]);
  const settingsShown = settingsOpened && settingsTitle !== null;
  const pageSettings = useMemo(() => ({ title: settingsTitle, setTitle: setSettingsTitle, container: settingsContainer }), [settingsTitle, settingsContainer]);

  return (
    <ModalsProvider modalProps={{ centered: true }}>
      <PageSettingsContext.Provider value={pageSettings}>
        <WorkspaceGate>
          <AppShell
            header={{ height: 56 }}
            navbar={{
              width: sidebar.width,
              breakpoint: 'sm',
              // One open state for both: at exactly the breakpoint, Mantine applies its mobile and its desktop rules at
              // once, which must not disagree (the sidebar could then not be closed).
              collapsed: { mobile: !sidebarOpened, desktop: !sidebarOpened },
            }}
            // Settings of the page, on the right (closed by default; the same state for both rules, as the navbar).
            aside={{ width: aside.width, breakpoint: 'sm', collapsed: { mobile: !settingsShown, desktop: !settingsShown } }}
            padding="md"
            data-resizing={sidebar.resizing || aside.resizing || undefined}
            className={classes.shell}
          >
            <AppShell.Header>
              <div className={classes.header}>
                <Group gap="sm" wrap="nowrap">
                  <Burger
                    opened={sidebarOpened}
                    onClick={mobile ? mobileSidebar.toggle : () => setSidebarShown((current) => !current)}
                    size="sm"
                    aria-label={sidebarOpened ? 'Masquer la barre latérale' : 'Afficher la barre latérale'}
                  />
                  {/* Date and time above the sidebar (none on a phone). */}
                  <HeaderClock />
                  {/* On a phone, the workspace as a button; from the tablet on, it is in the middle, before the page. */}
                  <div className={classes.phoneOnly}>
                    <WorkspaceSwitcher />
                  </div>
                </Group>
                <HeaderTitle />
                <Group gap="sm" wrap="nowrap" justify="flex-end">
                  {/* The running timer, not on a phone. */}
                  <div className={classes.fromTablet}>
                    <TimerWidget />
                  </div>
                  <SettingsButton />
                  <QuickActions />
                  {/* The logged-in account: its page and the logout, on hover (or a click, by touch or keyboard). */}
                  <ActionsMenu
                    about="mon compte"
                    hover
                    items={[
                      { label: 'Mon compte', icon: <UserIcon aria-hidden />, to: PAGES.account.path },
                      'divider',
                      { label: 'Me déconnecter', icon: <SignOutIcon aria-hidden />, onClick: handleLogout },
                    ]}
                    target={
                      <ActionButton priority="tertiary" icon={<UserIcon aria-hidden />} after={<MenuCaret />} loading={logout.isPending} maw={200}>
                        {user?.username ?? 'Mon compte'}
                      </ActionButton>
                    }
                  />
                </Group>
              </div>
            </AppShell.Header>

            <AlarmCenter />
            <ElsewhereNotifier />
            <MailWatcher />
            <AppShell.Navbar aria-label="Clients et projets">
              <Sidebar />
              {!mobile && (
                <ResizeHandle edge="right" label="Redimensionner la barre latérale" resizing={sidebar.resizing} onResizeStart={sidebar.onResizeStart} onResizeReset={sidebar.onResizeReset} />
              )}
            </AppShell.Navbar>

            <SettingsOverlay opened={settingsShown} onClose={closeSettings} />
            <SettingsAside onContainer={setSettingsContainer} resize={aside} />

            {/* Pages use the full available width. */}
            <AppShell.Main>
              <Stack gap="md">
                <Outlet />
              </Stack>
              {/* Task of ?task=12, over any page. */}
              <TaskPanel />
              {/* Forms opened in the side panel, over any page. */}
              <SidePanelHost />
            </AppShell.Main>
          </AppShell>
        </WorkspaceGate>
      </PageSettingsContext.Provider>
    </ModalsProvider>
  );
}
