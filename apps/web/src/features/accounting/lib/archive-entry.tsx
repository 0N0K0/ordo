import { ArchiveIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { archiveWithUndo } from '../../../lib/archive';

/** Mutation archiving or restoring, as `useSetArchived` gives it. */
interface ArchiveMutation {
  mutateAsync: (variables: { ids: readonly string[]; archived: boolean }) => Promise<unknown>;
}

/**
 * « Archiver » / « Restaurer » entry of the menu of a document (hidden from the lists, read only; a final one stays
 * valid, its number and PDF kept), told with its undo.
 * @param {{ archived: boolean, label: string, feminine?: boolean }} document Document: archived, its name in the message, named in the feminine (optional).
 * @param {ArchiveMutation} mutation Archive mutation of its kind.
 * @param {string} id Document.
 * @returns {{ label: string, icon: JSX.Element, onClick: () => void }} Menu entry.
 */
export function archiveEntry({ archived, label, feminine }: { archived: boolean; label: string; feminine?: boolean }, mutation: ArchiveMutation, id: string) {
  return {
    label: archived ? 'Restaurer' : 'Archiver',
    icon: archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
    onClick: () => void archiveWithUndo(mutation, { ids: [id], archived: !archived, label, feminine }),
  };
}
