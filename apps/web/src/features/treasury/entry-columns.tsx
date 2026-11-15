import { Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { EditableDate, EditableSelect } from '../../components/data-table/EditableCells';
import type { DataColumn } from '../../components/data-table/data-table';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import * as fmt from '../../lib/format';
import { categoryOptions } from './categories';
import { DocumentsCell, LinksCell, PayerCell, ProjectCell, RecurrenceCell } from './entry-cells';
import { entryLinks, payerKey, recurrenceText, type AnyEntry, type EntryEnv, type EntrySave } from './entry-env';

/** Value of the rows without a value in a choice filter. */
const NONE = 'none';

/**
 * Categories of an entry: its own, or those of its lines.
 * @param {AnyEntry | undefined} entry Entry (none: no category).
 * @returns {string[]} Category ids.
 */
const entryCategories = (entry: AnyEntry | undefined): string[] =>
  !entry ? [] : entry.lines.length ? [...new Set(entry.lines.flatMap((line) => (line.categoryId ? [line.categoryId] : [])))] : entry.categoryId ? [entry.categoryId] : [];

/**
 * Projects of an entry: its own, or those of its lines.
 * @param {AnyEntry | undefined} entry Entry (none: no project).
 * @returns {string[]} Project ids.
 */
const entryProjects = (entry: AnyEntry | undefined): string[] =>
  !entry ? [] : entry.lines.length ? [...new Set(entry.lines.flatMap((line) => (line.projectId ? [line.projectId] : [])))] : entry.projectId ? [entry.projectId] : [];

/**
 * Supporting documents of an entry and of its lines.
 * @param {AnyEntry} entry Entry.
 * @returns {AnyEntry['documents']} Documents.
 */
const allDocuments = (entry: AnyEntry) => [...entry.documents, ...entry.lines.flatMap((line) => line.documents)];

/**
 * Columns a table of entries (actual or expected) shares: account, value date, categories, payment method, payer or
 * payee, project, supporting documents, linked entries, and the repetition of a forecast.
 * @param {(row: R) => AnyEntry | undefined} entryOf Entry of a row (none: an invoice due…).
 * @param {EntryEnv} env Names.
 * @param {{ payerName: (row: R) => string, recurrence?: boolean }} options Name of the payer of a row (with or without entry), and a repetition column.
 * @returns {DataColumn<R>[]} Columns.
 */
export function entryFieldColumns<R>(entryOf: (row: R) => AnyEntry | undefined, env: EntryEnv, options: { payerName: (row: R) => string; recurrence?: boolean }): DataColumn<R>[] {
  const categoryText = (row: R) => {
    return entryCategories(entryOf(row))
      .map((id) => env.paths.get(id) ?? '')
      .join(', ');
  };
  const projectText = (row: R) => {
    return entryProjects(entryOf(row))
      .map((id) => env.projectNames.get(id) ?? '')
      .join(', ');
  };
  const valueDate = (row: R) => {
    const entry = entryOf(row);
    return entry ? String(entry.valueDate ?? entry.date).slice(0, 10) : null;
  };
  const columns: DataColumn<R>[] = [
    {
      id: 'account',
      label: 'Compte',
      size: 150,
      sortValue: (row) => entryOf(row)?.accountName ?? null,
      text: (row) => entryOf(row)?.accountName ?? '',
      filter: { kind: 'choice', value: (row) => entryOf(row)?.accountId ?? null, options: env.accounts.map((account) => ({ value: account.id, label: account.name })) },
      groupable: true,
    },
    {
      id: 'valueDate',
      label: 'Date de valeur',
      size: 130,
      hiddenByDefault: true,
      sortValue: valueDate,
      text: (row) => (valueDate(row) ? fmt.day(valueDate(row)!) : ''),
      filter: { kind: 'date', value: valueDate },
    },
    {
      id: 'valueMonth',
      label: 'Mois de valeur',
      size: 150,
      hiddenByDefault: true,
      sortValue: (row) => valueDate(row)?.slice(0, 7) ?? null,
      text: (row) => (valueDate(row) ? fmt.capitalize(fmt.month(valueDate(row)!.slice(0, 7))) : ''),
      filter: false,
      groupable: true,
    },
    {
      id: 'payer',
      label: 'Émetteur / destinataire',
      size: 200,
      sortValue: (row) => options.payerName(row) || null,
      text: options.payerName,
      filter: {
        kind: 'choice',
        value: (row) => {
          const entry = entryOf(row);
          return entry ? (payerKey(entry) ?? NONE) : null;
        },
        options: [{ value: NONE, label: 'Aucun' }, ...env.payers.flatMap((group) => group.items)],
      },
      groupable: true,
    },
    {
      id: 'category',
      label: 'Catégories',
      size: 180,
      sortValue: (row) => categoryText(row) || null,
      text: categoryText,
      filter: { kind: 'choices', value: (row) => entryCategories(entryOf(row)), options: [...env.paths].map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'method',
      label: 'Moyen de paiement',
      size: 150,
      hiddenByDefault: true,
      sortValue: (row) => entryOf(row)?.methodName ?? null,
      text: (row) => entryOf(row)?.methodName ?? '',
      filter: {
        kind: 'choice',
        value: (row) => entryOf(row)?.methodId ?? null,
        options: (env.settings?.treasuryPaymentMethods ?? []).map((method) => ({ value: method.id, label: method.name })),
      },
      groupable: true,
    },
    {
      id: 'project',
      label: 'Projet',
      size: 180,
      hiddenByDefault: true,
      sortValue: (row) => projectText(row) || null,
      text: projectText,
      filter: { kind: 'choices', value: (row) => entryProjects(entryOf(row)), options: [...env.projectNames].map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'documents',
      label: 'Pièces justificatives',
      size: 220,
      hiddenByDefault: true,
      text: (row) => {
        const entry = entryOf(row);
        return entry
          ? allDocuments(entry)
              .map((document) => document.title)
              .join(', ')
          : '';
      },
      filter: { kind: 'boolean', value: (row) => Boolean(entryOf(row) && allDocuments(entryOf(row)!).length) },
    },
    {
      id: 'links',
      label: 'Mouvements liés',
      size: 220,
      hiddenByDefault: true,
      text: (row) => (entryOf(row)?.linkedEntries ?? []).map((linked) => linked.label).join(', '),
      filter: { kind: 'boolean', value: (row) => Boolean(entryOf(row)?.linkedEntries.length || entryOf(row)?.linkedByLines.length) },
    },
  ];
  if (options.recurrence) {
    columns.push({
      id: 'recurrence',
      label: 'Répétition',
      size: 220,
      sortValue: (row) => {
        const entry = entryOf(row);
        return entry ? recurrenceText(entry) || null : null;
      },
      text: (row) => {
        const entry = entryOf(row);
        return entry ? recurrenceText(entry) : '';
      },
      filter: { kind: 'boolean', value: (row) => entryOf(row)?.recurrence != null },
    });
  }
  return columns;
}

/**
 * Cells of the shared columns of an entry, changed in place; split entries have their category, project, documents
 * and links on their lines.
 * @param {AnyEntry} entry Entry.
 * @param {EntryEnv} env Names and options.
 * @param {EntrySave} save Save.
 * @returns {Record<string, ReactNode>} Cells by column id.
 */
export function entryFieldCells(entry: AnyEntry, env: EntryEnv, save: EntrySave): Record<string, ReactNode> {
  const split = entry.lines.length > 0;
  const onLines = (
    <Text size="xs" c="dimmed">
      Sur les lignes
    </Text>
  );
  const valueDate = String(entry.valueDate ?? entry.date).slice(0, 10);
  return {
    account: (
      <EditableSelect
        value={entry.accountId}
        label={`Compte de ${entry.label}`}
        data={env.accounts.filter((account) => !account.archived || account.id === entry.accountId).map((account) => ({ value: account.id, label: account.name }))}
        onSave={(accountId) => accountId && save(entry, { accountId })}
      />
    ),
    valueDate: <EditableDate value={valueDate} label={`Date de valeur de ${entry.label}`} nullable onSave={(next) => save(entry, { valueDate: next })} />,
    payer: <PayerCell entry={entry} env={env} save={save} />,
    category: split ? (
      onLines
    ) : (
      <EditableSelect
        value={entry.categoryId ?? null}
        label={`Catégorie de ${entry.label}`}
        nullable
        {...treeSelectProps(categoryOptions(env.settings?.treasuryCategories ?? [], entry.amount < 0 ? 'OUT' : 'IN'))}
        onSave={(categoryId) => save(entry, { categoryId })}
      />
    ),
    method: (
      <EditableSelect
        value={entry.methodId ?? null}
        label={`Moyen de paiement de ${entry.label}`}
        nullable
        data={(env.settings?.treasuryPaymentMethods ?? [])
          .filter((method) => (entry.amount < 0 ? method.outgoing : method.incoming) || method.id === entry.methodId)
          .map((method) => ({ value: method.id, label: method.name }))}
        onSave={(methodId) => save(entry, { methodId })}
      />
    ),
    project: split ? onLines : <ProjectCell value={entry.projectId ?? null} env={env} label={`Projet de ${entry.label}`} onSave={(projectId) => save(entry, { projectId })} />,
    documents: split ? onLines : <DocumentsCell documents={entry.documents} env={env} label={`Pièces justificatives de ${entry.label}`} onSave={(ids) => save(entry, ids)} />,
    links: split ? (
      onLines
    ) : (
      <LinksCell
        links={entryLinks(entry)}
        entryId={entry.id}
        lines={false}
        label={`Lier ${entry.label} à un mouvement`}
        onSave={(links) => save(entry, { linkedEntryIds: links.map((link) => link.id) })}
      />
    ),
    recurrence: entry.status === 'FORECAST' ? <RecurrenceCell entry={entry} save={save} /> : null,
  };
}
