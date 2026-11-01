import { Anchor, AppShell, Button, Container, Group, Stack } from '@mantine/core';
import { SignOutIcon, UserIcon } from '@phosphor-icons/react';
import { Link, NavLink, Outlet } from 'react-router';
import { useLogout, useMe } from '../features/auth/api';
import { notifyError } from '../lib/notify';

/**
 * Layout of the logged-in area: header with navigation and logout.
 * @returns {JSX.Element} Layout wrapping the child route.
 */
export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();

  /**
   * Closes the session; the guard then redirects to /login.
   * @returns {void}
   */
  const handleLogout = () => {
    logout.mutate(undefined, { onError: (error) => notifyError(error.message) });
  };

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Anchor component={Link} to="/" fw={700} c="inherit" underline="never">
              Ordo
            </Anchor>
            <Group gap="sm">
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
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg">
          <Stack gap="md">
            <Outlet />
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
