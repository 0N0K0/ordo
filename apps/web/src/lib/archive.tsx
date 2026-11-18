import { ArchiveIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import type { QueryKey } from '@tanstack/react-query';
import { graphql } from '../graphql';
import type { ArchivableKind } from '../graphql/graphql';
import { execute } from './graphql-client';
import { plural } from './text';
import { useInvalidatingMutation } from './mutation';
import { notifyFailure, notifyWithUndo, onMutationError } from './notify';

export type { ArchivableKind };

const SetArchivedDocument = graphql(`
  mutation SetArchived($kind: ArchivableKind!, $ids: [ID!]!, $archived: Boolean!) {
    setArchived(kind: $kind, ids: $ids, archived: $archived)
  }
`);

/** Message of the API refusing a change of an archived element (the same as `ARCHIVED_MESSAGE` of the API). */
export const ARCHIVED_MESSAGE = 'Élément archivé : restaurez-le pour le modifier.';

/**
 * Archives (hidden by default, read only) or restores elements of a kind, all at once.
 * @param {ArchivableKind} kind Kind of the elements.
 * @param {readonly string[]} ids Elements.
 * @param {boolean} archived Archives (else restores).
 * @returns {Promise<boolean>} Done.
 */
export async function setArchived(kind: ArchivableKind, ids: readonly string[], archived: boolean): Promise<boolean> {
  return (await execute(SetArchivedDocument, { kind, ids: [...ids], archived })).setArchived;
}

/**
 * Archives or restores elements of a kind (`mutate({ ids, archived })`), then refreshes the queries showing them.
 * @param {ArchivableKind} kind Kind of the elements.
 * @param {readonly QueryKey[]} [invalidate] Queries refreshed (with what starts with these keys). Optional. Default = every query (the element may show in many lists, selects, filters…).
 * @returns {UseMutationResult<boolean, Error, { ids: readonly string[], archived: boolean }>} Mutation state.
 */
export function useSetArchived(kind: ArchivableKind, invalidate: readonly QueryKey[] = [[]]) {
  return useInvalidatingMutation(({ ids, archived }: { ids: readonly string[]; archived: boolean }) => setArchived(kind, ids, archived), { invalidate });
}

/** Element that may be archived (its `archived` field; none: never archived). */
interface MaybeArchived {
  id: string;
  archived?: boolean | null;
}

/**
 * Ids kept whatever their state: the current value(s) of a field, still offered when archived.
 * @param {string | readonly (string | null | undefined)[] | null | undefined} keep Value or values. Optional.
 * @returns {Set<string>} Ids.
 */
const keptIds = (keep: string | readonly (string | null | undefined)[] | null | undefined): Set<string> =>
  new Set((typeof keep === 'string' ? [keep] : (keep ?? [])).filter((id): id is string => Boolean(id)));

/**
 * Elements offered by a picker (a select, an autocomplete, a filter): those not archived, and the current value(s) even
 * when archived.
 * @param {readonly T[]} items Elements, in their order.
 * @param {string | readonly (string | null | undefined)[] | null} [keep] Current value(s), kept when archived. Optional.
 * @returns {T[]} Elements offered.
 */
export function unarchived<T extends MaybeArchived>(items: readonly T[], keep?: string | readonly (string | null | undefined)[] | null): T[] {
  const kept = keptIds(keep);
  return items.filter((item) => !item.archived || kept.has(item.id));
}

/**
 * Elements shown by a list, a table, a board: the archived ones only when asked (« Afficher les archivés »).
 * @param {readonly T[]} items Elements.
 * @param {boolean} showArchived Archived ones shown too.
 * @returns {readonly T[]} Elements shown.
 */
export function visibleItems<T extends MaybeArchived>(items: readonly T[], showArchived: boolean): readonly T[] {
  return showArchived ? items : items.filter((item) => !item.archived);
}

/**
 * Message of the success of an archive or a restore: « « Courses » archivée. », « 3 listes restaurées. ».
 * @param {string} label What is changed (« « Courses » », « 3 listes »).
 * @param {boolean} archived Archived (else restored).
 * @param {{ feminine?: boolean, count?: number }} [options] Agreement: feminine noun, number of elements. Optional. Default = masculine, one.
 * @returns {string} Message.
 */
export function archivedMessage(label: string, archived: boolean, { feminine = false, count = 1 }: { feminine?: boolean; count?: number } = {}): string {
  return `${label} ${plural(count, `${archived ? 'archivé' : 'restauré'}${feminine ? 'e' : ''}`)}.`;
}

/** Mutation archiving or restoring, as `useSetArchived` gives it (only its promise is used). */
interface ArchiveMutation {
  mutateAsync: (variables: { ids: readonly string[]; archived: boolean }) => Promise<unknown>;
}

/**
 * Archives or restores elements, then tells it with an « Annuler » undo (putting them back); a failure in an error toast.
 * @param {ArchiveMutation} mutation Mutation (`useSetArchived(kind)`).
 * @param {object} options Options.
 * @param {readonly string[]} options.ids Elements.
 * @param {boolean} options.archived Archives (else restores).
 * @param {string} options.label What is changed, for the message (« « Courses » », « 3 listes »).
 * @param {boolean} [options.feminine] Named in the feminine (« archivée »). Optional. Default = false.
 * @returns {Promise<void>}
 */
export async function archiveWithUndo(
  mutation: ArchiveMutation,
  { ids, archived, label, feminine = false }: { ids: readonly string[]; archived: boolean; label: string; feminine?: boolean },
): Promise<void> {
  try {
    await mutation.mutateAsync({ ids, archived });
  } catch (error) {
    notifyFailure(error);
    return;
  }
  notifyWithUndo(archivedMessage(label, archived, { feminine, count: ids.length }), () => void mutation.mutateAsync({ ids, archived: !archived }).catch(onMutationError));
}

/**
 * « Archiver » / « Restaurer » entry of the menu of an element (hidden from the lists, read only), told with its undo.
 * @param {{ archived?: boolean | null, label: string, feminine?: boolean }} element Element: archived, its name in the message (« « Courses » »), named in the feminine (optional).
 * @param {ArchiveMutation} mutation Archive mutation of its kind (`useSetArchived(kind)`).
 * @param {string} id Element.
 * @returns {{ label: string, icon: JSX.Element, onClick: () => void }} Menu entry.
 */
export function archiveEntry({ archived, label, feminine }: { archived?: boolean | null; label: string; feminine?: boolean }, mutation: ArchiveMutation, id: string) {
  return {
    label: archived ? 'Restaurer' : 'Archiver',
    icon: archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
    onClick: () => void archiveWithUndo(mutation, { ids: [id], archived: !archived, label, feminine }),
  };
}

/**
 * Which nodes of a tree picker can be chosen (`categoryOptions(…, offered)`): those not archived, and the current
 * value(s) even when archived. An archived parent stays greyed out above what can be chosen under it.
 * @param {readonly MaybeArchived[]} items Every node.
 * @param {string | readonly (string | null | undefined)[] | null} [keep] Current value(s), kept when archived. Optional.
 * @returns {(id: string) => boolean} Whether a node can be chosen.
 */
export function unarchivedOffered(items: readonly MaybeArchived[], keep?: string | readonly (string | null | undefined)[] | null): (id: string) => boolean {
  const offered = new Set(unarchived(items, keep).map((item) => item.id));
  return (id) => offered.has(id);
}
