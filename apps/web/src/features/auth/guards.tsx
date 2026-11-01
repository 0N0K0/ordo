import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from './api';

interface FromState {
  from?: { pathname: string; search: string };
}

/**
 * Full-page loader shown while the session is being checked.
 * @returns {JSX.Element} Loader.
 */
function SessionLoader() {
  return (
    <Center h="100dvh">
      <Loader aria-label="Chargement" />
    </Center>
  );
}

/**
 * Renders child routes only for a logged-in user; otherwise redirects to /login.
 * @returns {JSX.Element} Child routes, loader or redirect.
 */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <SessionLoader />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location } satisfies FromState} />;
  return <Outlet />;
}

/**
 * Renders child routes only when logged out; otherwise returns to the page asked before login.
 * @returns {JSX.Element} Child routes, loader or redirect.
 */
export function RequireGuest() {
  const me = useMe();
  const from = (useLocation().state as FromState | null)?.from;

  if (me.isPending) return <SessionLoader />;
  if (me.data) return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />;
  return <Outlet />;
}
