import { personKey } from '../../../components/people/people-keys';
import { recurrenceSchema } from '@ordo/shared';
import type { BulkChange } from '../../../components/data-table/selection/bulk-edit';
import { useMemo } from 'react';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';
import type { TreeOption } from '../../../components/tree/tree-select';
import { useProjectTree } from '../../projects/api';
import { projectFullPath, projectOptions } from '../../projects/lib/tree';
import { useTreasuryDocumentOptions, useTreasurySettings, type ForecastEntry, type TreasuryAccount, type TreasuryEntry, type TreasurySettings } from '../api';
import { categoryPaths } from './categories';
import type { EntryValues } from './entry-values';
import type { LineLink } from './lines';
import { personName } from '../../../components/people/people-options';
import { taggedKey, parseTaggedKey, taggedIds } from '../../../lib/tagged-key';

/** Entry of a treasury table: actual or forecast. */
export type AnyEntry = TreasuryEntry | ForecastEntry;

/** Saves fields of an entry changed in a cell: the same change for each entry of the bulk selection, or made for each. */
export type EntrySave = (entry: AnyEntry, change: BulkChange<AnyEntry, Partial<EntryValues>>) => void;

/** Saves fields of one entry. */
export type EntryUpdate = (entry: AnyEntry, change: Partial<EntryValues>) => void;

/** Supporting document of an entry or a line. */
export type EntryDocument = TreasuryEntry['documents'][number];

/** Option of a select. */
export interface Choice {
  value: string;
  label: string;
  /** Archived (column filters offer it only while in them). Optional. */
  archived?: boolean;
}

/** What the cells and columns of the treasury tables are named and filled from. */
export interface EntryEnv {
  settings: TreasurySettings | undefined;
  accounts: TreasuryAccount[];
  /** Full names of the categories, by id. */
  paths: Map<string, string>;
  /** Payers and payees ("client:<id>", "tiers:<id>"), grouped. */
  payers: { group: string; items: Choice[] }[];
  /** Names of the payers and payees, by key. */
  payerNames: Map<string, string>;
  /** Projects, in tree order. */
  projects: TreeOption[];
  /** Full names of the projects, by id. */
  projectLabels: Map<string, string>;
  /** Supporting documents ("lib:<id>", "res:<id>"), grouped by place. */
  documents: { group: string; items: Choice[] }[];
  /** Names of the members ("m:"), relations ("r:") and contexts ("c:"). */
  names: Map<string, string>;
}

/**
 * Everything the treasury tables name and offer: categories, payers, projects, supporting documents, people.
 * @param {TreasuryAccount[]} accounts Accounts.
 * @returns {EntryEnv} Env.
 */
export function useEntryEnv(accounts: TreasuryAccount[]): EntryEnv {
  const { data: settings } = useTreasurySettings();
  const { data: workspace } = useProjectTree();
  const { data: documentOptions } = useTreasuryDocumentOptions();
  return useMemo(() => {
    const payers = payerGroups(workspace?.clients ?? [], settings?.treasuryCounterparties ?? []);
    return {
      settings,
      accounts,
      paths: categoryPaths(settings?.treasuryCategories ?? []),
      payers,
      payerNames: new Map(payers.flatMap((group) => group.items.map((item) => [item.value, item.label] as const))),
      projects: projectOptions(workspace, workspace?.projects ?? []),
      projectLabels: new Map((workspace?.projects ?? []).map((project) => [project.id, workspace ? projectFullPath(workspace, project) : project.label])),
      documents: documentGroups(documentOptions ?? []),
      names: new Map([
        ...(settings?.treasuryMembers ?? []).map((member) => [personKey('member', member.id), personName(member)] as const),
        ...(settings?.treasuryRelations ?? []).map((relation) => [personKey('relation', relation.id), relation.name] as const),
        ...(settings?.treasuryContexts ?? []).map((context) => [taggedKey('context', context.id), context.label] as const),
      ]),
    };
  }, [settings, workspace, documentOptions, accounts]);
}

/** Payer or payee offered: a client or a counterparty. */
interface PayerSource {
  id: string;
  name: string;
  archived: boolean;
}

/**
 * Payers and payees of an entry, by group (clients, then counterparties), the archived ones flagged; empty groups left out.
 * @param {readonly PayerSource[]} clients Clients.
 * @param {readonly PayerSource[]} counterparties Counterparties.
 * @returns {{ group: string, items: Choice[] }[]} Groups.
 */
export function payerGroups(clients: readonly PayerSource[], counterparties: readonly PayerSource[]): { group: string; items: Choice[] }[] {
  return [
    { group: 'Clients', items: clients.map((client) => ({ value: taggedKey('client', client.id), label: client.name, archived: client.archived })) },
    { group: 'Tiers', items: counterparties.map((counterparty) => ({ value: taggedKey('tiers', counterparty.id), label: counterparty.name, archived: counterparty.archived })) },
  ].filter((group) => group.items.length);
}

/** Supporting document offered: in the library (`place`: its folder) or in a project (`place`: the project). */
interface DocumentSource {
  source: string;
  id: string;
  label: string;
  place: string;
  projectId?: string | null;
}

/**
 * Supporting documents of an entry, grouped by place: the library, then each project (the given one first); a library
 * document outside « Documents » named with its folder, each document once.
 * @param {readonly DocumentSource[]} documents Documents.
 * @param {string | null} [projectId] Project of the entry, its documents first. Optional.
 * @returns {{ group: string, items: Choice[] }[]} Groups.
 */
export function documentGroups(documents: readonly DocumentSource[], projectId?: string | null): { group: string; items: Choice[] }[] {
  const groups = new Map<string, Choice[]>();
  const sorted = [...documents].sort((a, b) => Number(b.source === 'LIBRARY') - Number(a.source === 'LIBRARY') || Number(b.projectId === projectId) - Number(a.projectId === projectId));
  for (const document of sorted) {
    const group = document.source === 'LIBRARY' ? 'Bibliothèque' : `Projet ${document.place}`;
    const items = groups.get(group) ?? [];
    if (!items.some((item) => item.value === documentKey(document))) {
      items.push({ value: documentKey(document), label: document.source === 'LIBRARY' && document.place !== 'Documents' ? `${document.label} (${document.place})` : document.label });
    }
    groups.set(group, items);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

/**
 * Key of a supporting document in the selects.
 * @param {{ source: string, id: string }} document Document.
 * @returns {string} "lib:<id>" or "res:<id>".
 */
export const documentKey = (document: { source: string; id: string }) => taggedKey(document.source === 'LIBRARY' ? 'lib' : 'res', document.id);

/** Supporting documents of an entry or a line: of the library, and files of a project. */
export interface SupportingDocuments {
  libraryDocumentIds: string[];
  projectResourceIds: string[];
}

/**
 * Keys of the supporting documents, in the selects.
 * @param {SupportingDocuments} documents Documents.
 * @returns {string[]} "lib:<id>" and "res:<id>" keys.
 */
export const supportingKeys = ({ libraryDocumentIds, projectResourceIds }: SupportingDocuments): string[] => [
  ...libraryDocumentIds.map((id) => documentKey({ source: 'LIBRARY', id })),
  ...projectResourceIds.map((id) => documentKey({ source: 'PROJECT', id })),
];

/**
 * Supporting documents chosen in a select, from their keys.
 * @param {readonly string[]} keys "lib:<id>" and "res:<id>" keys.
 * @returns {SupportingDocuments} Documents.
 */
export const supportingOfKeys = (keys: readonly string[]): SupportingDocuments => ({
  libraryDocumentIds: taggedIds(keys, 'lib'),
  projectResourceIds: taggedIds(keys, 'res'),
});

/**
 * Key of the payer or payee of an entry.
 * @param {{ clientId?: string | null, counterpartyId?: string | null }} entry Entry.
 * @returns {string | null} "client:<id>", "tiers:<id>" or null.
 */
export const payerKey = (entry: { clientId?: string | null; counterpartyId?: string | null }) =>
  entry.clientId ? taggedKey('client', entry.clientId) : entry.counterpartyId ? taggedKey('tiers', entry.counterpartyId) : null;

/**
 * Payer or payee chosen in a select, from its key.
 * @param {string | null} key "client:<id>", "tiers:<id>" or null.
 * @returns {{ clientId: string | null, counterpartyId: string | null }} Client or counterparty.
 */
export const payerOfKey = (key: string | null): { clientId: string | null; counterpartyId: string | null } => {
  const parsed = parseTaggedKey(key);
  return { clientId: parsed?.tag === 'client' ? parsed.id : null, counterpartyId: parsed?.tag === 'tiers' ? parsed.id : null };
};

/**
 * Links of an entry, as the links cell shows them.
 * @param {AnyEntry} entry Entry.
 * @returns {LineLink[]} Links.
 */
export const entryLinks = (entry: AnyEntry): LineLink[] =>
  entry.linkedEntries.map((linked) => ({ kind: 'entry', id: linked.id, entryLabel: linked.label, date: linked.date, label: null, amount: linked.amount }));

/**
 * Labels of the movements an entry is linked to: its own links (whole entries) and those of its lines.
 * @param {AnyEntry} entry Entry.
 * @returns {string[]} Labels.
 */
export const linkedLabels = (entry: AnyEntry): string[] => [
  ...entry.linkedEntries.map((linked) => linked.label),
  ...entry.lines.flatMap((line) => [...line.linkedEntries.map((linked) => linked.label), ...line.linkedLines.map((linked) => linked.entryLabel)]),
];

/**
 * Rule of a repeating forecast, told in words.
 * @param {AnyEntry} entry Entry.
 * @returns {string} Rule, empty when it does not repeat.
 */
export function recurrenceText(entry: AnyEntry): string {
  if (entry.recurrence == null) return '';
  const rule = recurrenceSchema.safeParse(entry.recurrence);
  return rule.success ? describeRecurrence(rule.data, entry.date) : '';
}
