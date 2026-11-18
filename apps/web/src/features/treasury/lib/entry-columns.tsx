import { Text } from '@mantine/core';
import { listSelectProps, itemChoices } from '../../../components/items/item-look';
import type { ReactNode } from 'react';
import { EditableDate, EditableSelect } from '../../../components/data-table/cells/EditableCells';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { applyDiff } from '../../../components/data-table/selection/bulk-edit';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { categoryChoices, categoryOptions } from './categories';
import { DocumentsCell, LinksCell, PayerCell, ProjectCell, RecurrenceCell } from '../components/entry-cells';
import { entryLinks, payerKey, recurrenceText, type AnyEntry, type EntryEnv, type EntrySave } from './entry-env';
import { monthColumn } from '../../../components/data-table/table/month-column';

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
    return entry ? (entry.valueDate ?? entry.date) : null;
  };
  const columns: DataColumn<R>[] = [
    {
      id: 'account',
      bulk: true,
      label: 'Compte',
      size: 150,
      sortValue: (row) => entryOf(row)?.accountName ?? null,
      text: (row) => entryOf(row)?.accountName ?? '',
      filter: {
        kind: 'choice',
        value: (row) => entryOf(row)?.accountId ?? null,
        options: itemChoices(env.accounts),
      },
      groupable: true,
    },
    {
      id: 'valueDate',
      bulk: true,
      label: 'Date de valeur',
      size: 130,
      hiddenByDefault: true,
      sortValue: valueDate,
      text: (row) => (valueDate(row) ? fmt.day(valueDate(row)!) : ''),
      filter: { kind: 'date', value: valueDate },
    },
    monthColumn('valueMonth', 'Mois de valeur', valueDate),
    {
      id: 'payer',
      bulk: true,
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
      bulk: true,
      label: 'Catégories',
      size: 180,
      sortValue: (row) => categoryText(row) || null,
      text: categoryText,
      filter: {
        kind: 'choices',
        value: (row) => entryCategories(entryOf(row)),
        options: categoryChoices(env.settings?.treasuryCategories ?? []),
      },
      groupable: true,
    },
    {
      id: 'method',
      bulk: true,
      label: 'Moyen de paiement',
      size: 150,
      hiddenByDefault: true,
      sortValue: (row) => entryOf(row)?.methodName ?? null,
      text: (row) => entryOf(row)?.methodName ?? '',
      filter: {
        kind: 'choice',
        value: (row) => entryOf(row)?.methodId ?? null,
        options: itemChoices(env.settings?.treasuryPaymentMethods ?? []),
      },
      groupable: true,
    },
    {
      id: 'project',
      bulk: true,
      label: 'Projet',
      size: 180,
      hiddenByDefault: true,
      sortValue: (row) => projectText(row) || null,
      text: projectText,
      filter: { kind: 'choices', value: (row) => entryProjects(entryOf(row)), options: env.projects },
      groupable: true,
    },
    {
      id: 'documents',
      bulk: true,
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
      bulk: true,
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
      bulk: true,
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
 * Cells of the shared columns of an entry, changed in place (and on the bulk selection of their column: the entries a
 * change does not fit, split or of the other direction, are left as they are); split entries have their category,
 * project, documents and links on their lines.
 * @param {AnyEntry} entry Entry.
 * @param {EntryEnv} env Names and options.
 * @param {(column: string) => EntrySave} save Save of a column.
 * @returns {Record<string, ReactNode>} Cells by column id.
 */
export function entryFieldCells(entry: AnyEntry, env: EntryEnv, save: (column: string) => EntrySave): Record<string, ReactNode> {
  const split = entry.lines.length > 0;
  /**
   * Values a split entry has on its lines, one under the other (read only: changed on the lines).
   * @param {string[]} values Names.
   * @returns {JSX.Element} Cell.
   */
  const onLines = (values: string[]) =>
    values.length ? (
      <StackedValues>
        {[...new Set(values)].map((value) => (
          <Text key={value} size="sm" title="Sur les lignes" truncate>
            {value}
          </Text>
        ))}
      </StackedValues>
    ) : (
      <Text size="xs" c="dimmed">
        Sur les lignes
      </Text>
    );
  const valueDate = entry.valueDate ?? entry.date;
  const categories = env.settings?.treasuryCategories ?? [];
  const methods = env.settings?.treasuryPaymentMethods ?? [];
  const direction = (row: AnyEntry) => (row.amount < 0 ? 'OUT' : 'IN');
  return {
    account: (
      <EditableSelect
        value={entry.accountId}
        label={`Compte de ${entry.label}`}
        {...listSelectProps(env.accounts, undefined, entry.accountId)}
        onSave={(accountId) => accountId && save('account')(entry, { accountId })}
      />
    ),
    valueDate: <EditableDate value={valueDate} label={`Date de valeur de ${entry.label}`} nullable onSave={(next) => save('valueDate')(entry, { valueDate: next })} />,
    payer: <PayerCell entry={entry} env={env} save={save('payer')} />,
    category: split ? (
      onLines(entryCategories(entry).map((id) => env.paths.get(id) ?? ''))
    ) : (
      <EditableSelect
        value={entry.categoryId ?? null}
        label={`Catégorie de ${entry.label}`}
        nullable
        {...treeSelectProps(categoryOptions(categories, direction(entry), undefined, entry.categoryId))}
        // A category of money out goes to money out only (and in to in).
        onSave={(categoryId) =>
          save('category')(entry, (row) => (row.lines.length || (categoryId && categories.find((item) => item.id === categoryId)?.direction !== direction(row)) ? {} : { categoryId }))
        }
      />
    ),
    method: (
      <EditableSelect
        value={entry.methodId ?? null}
        label={`Moyen de paiement de ${entry.label}`}
        nullable
        {...listSelectProps(
          methods.filter((method) => (entry.amount < 0 ? method.outgoing : method.incoming) || method.id === entry.methodId),
          undefined,
          entry.methodId,
        )}
        onSave={(methodId) =>
          save('method')(entry, (row) => {
            const method = methods.find((item) => item.id === methodId);
            return method && !(row.amount < 0 ? method.outgoing : method.incoming) ? {} : { methodId };
          })
        }
      />
    ),
    project: split ? (
      onLines(entryProjects(entry).map((id) => env.projectNames.get(id) ?? ''))
    ) : (
      <ProjectCell value={entry.projectId ?? null} env={env} label={`Projet de ${entry.label}`} onSave={(projectId) => save('project')(entry, (row) => (row.lines.length ? {} : { projectId }))} />
    ),
    documents: split ? (
      onLines(entry.lines.flatMap((line) => line.documents.map((document) => document.title)))
    ) : (
      <DocumentsCell
        documents={entry.documents}
        env={env}
        label={`Pièces justificatives de ${entry.label}`}
        onSave={(ids) =>
          save('documents')(entry, (row) => {
            if (row.lines.length) return {};
            const of = (source: string, target: AnyEntry) => target.documents.filter((document) => document.source === source).map((document) => document.id);
            return {
              libraryDocumentIds: applyDiff(of('LIBRARY', row), of('LIBRARY', entry), ids.libraryDocumentIds),
              projectResourceIds: applyDiff(of('PROJECT', row), of('PROJECT', entry), ids.projectResourceIds),
            };
          })
        }
      />
    ),
    links: split ? (
      onLines(entry.lines.flatMap((line) => [...line.linkedEntries.map((linked) => linked.label), ...line.linkedLines.map((linked) => linked.entryLabel)]))
    ) : (
      <LinksCell
        links={entryLinks(entry)}
        entryId={entry.id}
        lines={false}
        label={`Lier ${entry.label} à un mouvement`}
        onSave={(links) =>
          save('links')(entry, (row) =>
            row.lines.length
              ? {}
              : {
                  linkedEntryIds: applyDiff(
                    row.linkedEntries.map((linked) => linked.id),
                    entry.linkedEntries.map((linked) => linked.id),
                    links.map((link) => link.id),
                  ).filter((id) => id !== row.id),
                },
          )
        }
      />
    ),
    recurrence: entry.status === 'FORECAST' ? <RecurrenceCell entry={entry} save={save('recurrence')} /> : null,
  };
}
