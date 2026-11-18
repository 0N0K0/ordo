import { ArchiveIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import type { QueryKey } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
 * Elements not archived, as a picker offers them (a select, an autocomplete, a filter) or an action takes them: the
 * archived ones left out, except the current value(s).
 * @param {readonly T[]} items Elements, in their order.
 * @param {string | readonly (string | null | undefined)[] | null} [keep] Current value(s), kept when archived. Optional.
 * @param {(item: T) => string} [idOf] Id of an element, compared with `keep`. Optional. Default = its `id`.
 * @returns {T[]} Elements offered.
 */
export function unarchived<T extends { archived?: boolean | null }>(
  items: readonly T[],
  keep?: string | readonly (string | null | undefined)[] | null,
  idOf: (item: T) => string = (item) => (item as unknown as MaybeArchived).id,
): T[] {
  const kept = keptIds(keep);
  // eslint-disable-next-line no-restricted-syntax -- the archived filter itself.
  return items.filter((item) => !item.archived || kept.has(idOf(item)));
}

/** Props of the « Afficher les archivés » switch (`ShowArchivedSwitch`), as `useArchivedToggle` gives them. */
export interface ArchivedToggle {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Number of archived elements (none: the switch is not shown). */
  count: number;
}

/**
 * Whether an element is archived (its `archived` field).
 * @param {unknown} item Element.
 * @returns {boolean} Archived.
 */
const isArchivedItem = (item: unknown): boolean => Boolean((item as MaybeArchived).archived);

/** What `useArchivedToggle` gives. */
interface ArchivedToggleState<T> {
  /** Elements shown: the archived ones only when asked. */
  shown: T[];
  /** Archived elements shown. */
  showArchived: boolean;
  /** Props of the switch: `<ShowArchivedSwitch {...toggle} />`. */
  toggle: ArchivedToggle;
}

export function useArchivedToggle<T extends { archived?: boolean | null }>(items: readonly T[]): ArchivedToggleState<T>;
export function useArchivedToggle<T>(items: readonly T[], isArchived: (item: T) => boolean): ArchivedToggleState<T>;
/**
 * « Afficher les archivés » of a list, a table, a board: the elements shown (the archived ones hidden until asked)
 * and the props of its switch (`ShowArchivedSwitch`), with the number of archived elements.
 * @param {readonly T[]} items Every element.
 * @param {(item: T) => boolean} [isArchived] Whether an element is archived. Optional. Default = its `archived` field.
 * @returns {ArchivedToggleState<T>} Elements shown, state and switch props.
 */
export function useArchivedToggle<T>(items: readonly T[], isArchived: (item: T) => boolean = isArchivedItem): ArchivedToggleState<T> {
  const [showArchived, setShowArchived] = useState(false);
  const shown = useMemo(() => (showArchived ? [...items] : items.filter((item) => !isArchived(item))), [items, showArchived, isArchived]);
  const count = useMemo(() => items.filter(isArchived).length, [items, isArchived]);
  return { shown, showArchived, toggle: { checked: showArchived, onChange: setShowArchived, count } };
}

/** How the success of an archive or a restore is told. */
interface ArchivedMessageOptions {
  /** Named in the feminine (« archivée »). Optional. Default = false. */
  feminine?: boolean;
  /** Number of elements. Optional. Default = 1. */
  count?: number;
  /** What is archived along, told after an archive (« avec ses projets »). Optional. Default = none. */
  cascade?: string;
}

/**
 * Message of the success of an archive or a restore: « « Courses » archivée. », « 3 listes restaurées. ».
 * @param {string} label What is changed (« « Courses » », « 3 listes »).
 * @param {boolean} archived Archived (else restored).
 * @param {ArchivedMessageOptions} [options] Agreement and cascade. Optional. Default = masculine, one, no cascade.
 * @returns {string} Message.
 */
function archivedMessage(label: string, archived: boolean, { feminine = false, count = 1, cascade }: ArchivedMessageOptions = {}): string {
  return `${label} ${plural(count, `${archived ? 'archivé' : 'restauré'}${feminine ? 'e' : ''}`)}${archived && cascade ? ` ${cascade}` : ''}.`;
}

/** Mutation archiving or restoring, as `useSetArchived` gives it (only its promise is used). */
export interface ArchiveMutation {
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
 * @param {string} [options.cascade] What is archived along (« avec ses projets »). Optional.
 * @returns {Promise<void>}
 */
export async function archiveWithUndo(
  mutation: ArchiveMutation,
  { ids, archived, label, feminine = false, cascade }: { ids: readonly string[]; archived: boolean; label: string; feminine?: boolean; cascade?: string },
): Promise<void> {
  try {
    await mutation.mutateAsync({ ids, archived });
  } catch (error) {
    notifyFailure(error);
    return;
  }
  notifyWithUndo(archivedMessage(label, archived, { feminine, count: ids.length, cascade }), () => void mutation.mutateAsync({ ids, archived: !archived }).catch(onMutationError));
}

/**
 * « Archiver » / « Restaurer » entry of the menu of an element (hidden from the lists, read only), told with its undo.
 * @param {{ archived?: boolean | null, type: string, name: string, feminine?: boolean, cascade?: string }} element Element: archived, its type and its name, told « <Type> « nom » » in the message (« Liste « Courses » archivée. »), its type in the feminine (optional), what is archived along (optional).
 * @param {ArchiveMutation} mutation Archive mutation of its kind (`useSetArchived(kind)`).
 * @param {string} id Element.
 * @param {() => void} [onDone] Called once archived or restored (closes its form…). Optional.
 * @returns {{ label: string, icon: JSX.Element, onClick: () => void, inMenu: true }} Menu entry, never a button (decision R).
 */
export function archiveEntry(
  { archived, type, name, feminine, cascade }: { archived?: boolean | null; type: string; name: string; feminine?: boolean; cascade?: string },
  mutation: ArchiveMutation,
  id: string,
  onDone?: () => void,
) {
  return {
    label: archived ? 'Restaurer' : 'Archiver',
    icon: archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
    onClick: () => void archiveWithUndo(mutation, { ids: [id], archived: !archived, label: `${type} « ${name} »`, feminine, cascade }).then(onDone),
    inMenu: true as const,
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
