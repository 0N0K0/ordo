import { Anchor, Text } from '@mantine/core';
import { Fragment, type ReactNode } from 'react';
import { Link, useLocation, useMatch } from 'react-router';
import { useWorkspace } from '../features/workspace/api';
import { WorkspaceSwitcher } from '../features/workspaces/WorkspaceSwitcher';
import classes from './HeaderTitle.module.css';
import { pageTitle } from './page-title';

interface Crumb {
  label: string;
  /** Link, or none for the page shown. */
  to?: string;
}

/**
 * Where the page is, after the workspace: the client and the projects above a project (each a link), the client of
 * a client page, or the name of the page.
 * @returns {Crumb[]} Crumbs.
 */
function useCrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const projectId = useMatch('/projects/:id')?.params.id;
  const clientId = useMatch('/clients/:id')?.params.id;
  const { data: workspace } = useWorkspace();

  if (projectId) {
    const project = workspace?.projects.find((item) => item.id === projectId);
    if (!project || !workspace) return [];
    const crumbs: Crumb[] = [{ label: project.title }];
    for (let parentId = project.parentId; parentId;) {
      const parent = workspace.projects.find((item) => item.id === parentId);
      if (!parent) break;
      crumbs.unshift({ label: parent.title, to: `/projects/${parent.id}` });
      parentId = parent.parentId;
    }
    const client = workspace.clients.find((item) => item.id === project.clientId);
    if (client) crumbs.unshift({ label: client.name, to: `/clients/${client.id}` });
    return crumbs;
  }
  if (clientId) {
    const client = workspace?.clients.find((item) => item.id === clientId);
    return [{ label: client?.name ?? 'Client' }];
  }
  const title = pageTitle(pathname);
  return title ? [{ label: title }] : [];
}

/**
 * Middle of the header, from the tablet on: the workspace (its menu on hover to switch or manage them), then, each
 * after a pipe, the name of the page, or the client and projects above a project, as links.
 * @returns {JSX.Element} Title.
 */
export function HeaderTitle() {
  const crumbs = useCrumbs();
  const separator: ReactNode = (
    <Text span c="dimmed" aria-hidden>
      |
    </Text>
  );
  return (
    <nav className={classes.title} aria-label="Emplacement">
      <WorkspaceSwitcher variant="text" />
      {crumbs.map((crumb, index) => (
        <Fragment key={`${crumb.label}-${index}`}>
          {separator}
          {crumb.to ? (
            <Anchor component={Link} to={crumb.to} size="sm" c="inherit" className={classes.crumb}>
              {crumb.label}
            </Anchor>
          ) : (
            <Text span size="sm" className={classes.crumb} aria-current="page">
              {crumb.label}
            </Text>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
