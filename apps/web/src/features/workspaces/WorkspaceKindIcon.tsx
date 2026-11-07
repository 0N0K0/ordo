import { BriefcaseIcon, HouseLineIcon } from '@phosphor-icons/react';
import type { WorkspaceKind } from './api';

/**
 * Icon of a kind of workspace: briefcase (professional) or house (personal).
 * @param {{ kind: WorkspaceKind }} props Kind.
 * @returns {JSX.Element} Icon.
 */
export function WorkspaceKindIcon({ kind }: { kind: WorkspaceKind }) {
  return kind === 'PERSO' ? <HouseLineIcon aria-label="Personnel" /> : <BriefcaseIcon aria-label="Professionnel" />;
}
