import { personKey } from '../../../components/people/people-keys';
import { recurrenceSchema } from '@ordo/shared';
import type { BulkChange } from '../../../components/data-table/selection/bulk-edit';
import { useMemo } from 'react';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';
import type { TreeOption } from '../../../components/tree/tree-select';
import { useWorkspace } from '../../workspace/api';
import { projectFullPath, projectOptions } from '../../workspace/lib/tree';
import { useTreasuryDocumentOptions, useTreasurySettings, type ForecastEntry, type TreasuryAccount, type TreasuryEntry, type TreasurySettings } from '../api';
import { categoryPaths } from './categories';
import type { EntryValues } from './entry-values';
import type { LineLink } from './lines';
import { personName } from '../../../components/people/people-options';

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
  projectNames: Map<string, string>;
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
  const { data: workspace } = useWorkspace();
  const { data: documentOptions } = useTreasuryDocumentOptions();
  return useMemo(() => {
    const payers = [
      { group: 'Clients', items: (workspace?.clients ?? []).map((client) => ({ value: `client:${client.id}`, label: client.name, archived: client.archived })) },
      { group: 'Tiers', items: (settings?.treasuryCounterparties ?? []).map((counterparty) => ({ value: `tiers:${counterparty.id}`, label: counterparty.name, archived: counterparty.archived })) },
    ].filter((group) => group.items.length);
    const groups = new Map<string, Choice[]>();
    for (const document of [...(documentOptions ?? [])].sort((a, b) => Number(b.source === 'LIBRARY') - Number(a.source === 'LIBRARY'))) {
      const group = document.source === 'LIBRARY' ? 'Bibliothèque' : `Projet ${document.place}`;
      groups.set(group, [...(groups.get(group) ?? []), { value: documentKey(document), label: document.title }]);
    }
    return {
      settings,
      accounts,
      paths: categoryPaths(settings?.treasuryCategories ?? []),
      payers,
      payerNames: new Map(payers.flatMap((group) => group.items.map((item) => [item.value, item.label] as const))),
      projects: projectOptions(workspace, workspace?.projects ?? []),
      projectNames: new Map((workspace?.projects ?? []).map((project) => [project.id, workspace ? projectFullPath(workspace, project) : project.title])),
      documents: [...groups].map(([group, items]) => ({ group, items })),
      names: new Map([
        ...(settings?.treasuryMembers ?? []).map((member) => [personKey('member', member.id), personName(member)] as const),
        ...(settings?.treasuryRelations ?? []).map((relation) => [personKey('relation', relation.id), relation.name] as const),
        ...(settings?.treasuryContexts ?? []).map((context) => [`context:${context.id}`, context.name] as const),
      ]),
    };
  }, [settings, workspace, documentOptions, accounts]);
}

/**
 * Key of a supporting document in the selects.
 * @param {{ source: string, id: string }} document Document.
 * @returns {string} "lib:<id>" or "res:<id>".
 */
export const documentKey = (document: { source: string; id: string }) => `${document.source === 'LIBRARY' ? 'lib' : 'res'}:${document.id}`;

/**
 * Key of the payer or payee of an entry.
 * @param {{ clientId?: string | null, counterpartyId?: string | null }} entry Entry.
 * @returns {string | null} "client:<id>", "tiers:<id>" or null.
 */
export const payerKey = (entry: { clientId?: string | null; counterpartyId?: string | null }) =>
  entry.clientId ? `client:${entry.clientId}` : entry.counterpartyId ? `tiers:${entry.counterpartyId}` : null;

/**
 * Links of an entry, as the links cell shows them.
 * @param {AnyEntry} entry Entry.
 * @returns {LineLink[]} Links.
 */
export const entryLinks = (entry: AnyEntry): LineLink[] =>
  entry.linkedEntries.map((linked) => ({ kind: 'entry', id: linked.id, entryLabel: linked.label, date: linked.date, label: null, amount: linked.amount }));

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
