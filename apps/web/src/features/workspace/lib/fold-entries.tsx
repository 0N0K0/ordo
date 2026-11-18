import { ArrowsInLineVerticalIcon, ArrowsOutLineVerticalIcon, FolderPlusIcon, UserPlusIcon } from '@phosphor-icons/react';
import type { RowMenuEntry } from '../../../components/data-table/cells/RowActions';

/**
 * « Tout déplier » and « Tout replier » entries of a menu of the sidebar (a section, a client, a project).
 * @param {(expanded: boolean) => void} setExpanded Unfolds (true) or folds (false) everything under it.
 * @returns {RowMenuEntry[]} Entries.
 */
export function foldEntries(setExpanded: (expanded: boolean) => void): RowMenuEntry[] {
  return [
    { label: 'Tout déplier', icon: <ArrowsOutLineVerticalIcon aria-hidden />, onClick: () => setExpanded(true) },
    { label: 'Tout replier', icon: <ArrowsInLineVerticalIcon aria-hidden />, onClick: () => setExpanded(false) },
  ];
}

/**
 * « Nouveau client » (not in a personal workspace) and « Nouveau projet » entries.
 * @param {{ openClientForm: () => void, openProjectForm: () => void }} actions Forms opened.
 * @param {boolean} perso A personal workspace (no clients).
 * @returns {RowMenuEntry[]} Entries.
 */
export function newEntityEntries(actions: { openClientForm: () => void; openProjectForm: () => void }, perso: boolean): RowMenuEntry[] {
  return [
    !perso && { label: 'Nouveau client', icon: <UserPlusIcon aria-hidden />, onClick: () => actions.openClientForm() },
    { label: 'Nouveau projet', icon: <FolderPlusIcon aria-hidden />, onClick: () => actions.openProjectForm() },
  ];
}
