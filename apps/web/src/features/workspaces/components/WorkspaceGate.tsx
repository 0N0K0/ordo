import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import type { ReactNode } from 'react';

import { useWorkspaces } from '../api';
import { FullPageLoader } from '../../../components/feedback/FullPageLoader';

/**
 * Shows its content once the workspace is known: pages differ in a personal one, and the requests of the tab are
 * pinned to it first.
 * @param {{ children: ReactNode }} props Content.
 * @returns {JSX.Element} Content, loader or error.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { data, error } = useWorkspaces();
  if (error) {
    return <ErrorAlert m="md">{error.message}</ErrorAlert>;
  }
  if (!data) {
    return <FullPageLoader label="Chargement de l’espace" />;
  }
  return children;
}
