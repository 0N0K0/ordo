import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../api';
import { FullPageLoader } from '../../../components/feedback/FullPageLoader';
import { AUTH_PATHS, PAGES } from '../../../app/pages';

interface FromState {
  from?: { pathname: string; search: string };
}

/**
 * Renders child routes only for a logged-in user; otherwise redirects to /login.
 * @returns {JSX.Element} Child routes, loader or redirect.
 */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <FullPageLoader label="Chargement" />;
  if (!me.data) return <Navigate to={AUTH_PATHS.login} replace state={{ from: location } satisfies FromState} />;
  return <Outlet />;
}

/**
 * Renders child routes only when logged out; otherwise returns to the page asked before login.
 * @returns {JSX.Element} Child routes, loader or redirect.
 */
export function RequireGuest() {
  const me = useMe();
  const from = (useLocation().state as FromState | null)?.from;

  if (me.isPending) return <FullPageLoader label="Chargement" />;
  if (me.data) return <Navigate to={from ? `${from.pathname}${from.search}` : PAGES.home.path} replace />;
  return <Outlet />;
}
