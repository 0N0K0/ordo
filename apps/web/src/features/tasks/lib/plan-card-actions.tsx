import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { archiveEntry, type ArchiveMutation } from '../../../lib/archive';

/** Milestone or sprint, as its menu needs it. */
interface PlanItem {
  id: string;
  label: string;
  archived: boolean;
}

/**
 * Menu of the card of a milestone or a sprint, the same for both: « Modifier » (not when archived or of an archived
 * project: read only), « Archiver » / « Restaurer », « Supprimer ».
 * @param {PlanItem} item Milestone or sprint.
 * @param {{ type: string, locked: boolean, setArchived: ArchiveMutation, onEdit: () => void, onDelete: () => void }} options Its type (« Jalon »), whether its project is archived, its archive mutation, its form, its deletion.
 * @returns {RowMenuEntry[]} Menu entries.
 */
export function planCardActions(
  item: PlanItem,
  { type, locked, setArchived, onEdit, onDelete }: { type: string; locked: boolean; setArchived: ArchiveMutation; onEdit: () => void; onDelete: () => void },
): RowMenuEntry[] {
  return [
    !item.archived && !locked && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: onEdit },
    archiveEntry({ archived: item.archived, type, label: item.label }, setArchived, item.id),
    { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: onDelete },
  ];
}
