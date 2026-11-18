import { HouseLineIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { PageMessage } from '../../../components/feedback/PageMessage';
import { useActiveWorkspace } from '../api';

/**
 * Page of a professional workspace only (invoicing, clients): in a personal one, says so with a way back home.
 * @param {{ children: ReactNode }} props Page.
 * @returns {JSX.Element} Page, or the explanation.
 */
export function ProOnly({ children }: { children: ReactNode }) {
  const { workspace, perso } = useActiveWorkspace();
  if (!perso) return children;
  return (
    <PageMessage
      icon={<HouseLineIcon size="55%" aria-hidden />}
      title="Indisponible dans un espace personnel"
      message={<>L’espace « {workspace?.label} » est personnel : il n’a ni facturation, ni clients, ni société.</>}
    />
  );
}
