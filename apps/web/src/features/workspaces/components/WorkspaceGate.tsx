import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { Center, Loader } from '@mantine/core';
import type { ReactNode } from 'react';

import { useWorkspaces } from '../api';

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
    return (
      <Center h="100vh">
        <Loader aria-label="Chargement de l’espace" />
      </Center>
    );
  }
  return children;
}
