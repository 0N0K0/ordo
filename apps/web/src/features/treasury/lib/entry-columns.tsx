import { Text } from '@mantine/core';
import { itemChoices, itemSelectProps } from '../../../components/items/item-look';
import type { ReactNode } from 'react';
import { EditableDate, EditableSelect } from '../../../components/data-table/cells/EditableCells';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { applyDiff } from '../../../components/data-table/selection/bulk-edit';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { categoryChoices, categoryOptions } from './categories';
import { DocumentsCell, LinksCell, PayerCell, ProjectCell, RecurrenceCell } from '../components/entry-cells';
import { entryLinks, linkedLabels, payerKey, recurrenceText, type AnyEntry, type EntryEnv, type EntrySave } from './entry-env';
import { monthColumn } from '../../../components/data-table/table/month-column';
import { directionOf } from '@ordo/shared';

/** Value of the rows without a value in a choice filter. */
const NONE = 'none';

/**
 * Categories or projects of an entry: its own, or those of its lines.
 * @param {AnyEntry | undefined} entry Entry (none: none).
 * @param {'categoryId' | 'projectId'} field Field read.
 * @returns {string[]} Ids.
 */
const entryRefs = (entry: AnyEntry | undefined, field: 'categoryId' | 'projectId'): string[] => {
  if (!entry) return [];
  if (!entry.lines.length) return entry[field] ? [entry[field]] : [];
  return [...new Set(entry.lines.flatMap((line) => (line[field] ? [line[field]] : [])))];
};

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
 * @param {{ payerName: (row: R) => string, recurrence?: boolean, allEntries?: boolean }} options Name of the payer of a row (with or without entry), a
 *   repetition column, and whether every row is an entry (its account and value date are then never empty).
 * @returns {DataColumn<R>[]} Columns.
 */
export function entryFieldColumns<R>(
  entryOf: (row: R) => AnyEntry | undefined,
  env: EntryEnv,
  options: { payerName: (row: R) => string; recurrence?: boolean; allEntries?: boolean },
): DataColumn<R>[] {
  const categoryText = (row: R) => {
    return entryRefs(entryOf(row), 'categoryId')
      .map((id) => env.paths.get(id) ?? '')
      .join(', ');
  };
  const projectText = (row: R) => {
    return entryRefs(entryOf(row), 'projectId')
      .map((id) => env.projectLabels.get(id) ?? '')
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
      required: options.allEntries,
      label: 'Compte',
      size: 150,
      sortValue: (row) => entryOf(row)?.accountLabel ?? null,
      text: (row) => entryOf(row)?.accountLabel ?? '',
      filter: {
        kind: 'choice',
        value: (row) => entryOf(row)?.accountId ?? null,
        options: itemChoices(env.accounts),
      },
      groupable: true,
    },
    {
      id: 'valueDate',
      required: options.allEntries,
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
        none: NONE,
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
        value: (row) => entryRefs(entryOf(row), 'categoryId'),
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
      sortValue: (row) => entryOf(row)?.methodLabel ?? null,
      text: (row) => entryOf(row)?.methodLabel ?? '',
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
      filter: { kind: 'choices', value: (row) => entryRefs(entryOf(row), 'projectId'), options: env.projects },
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
              .map((document) => document.label)
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
      // Its links and those of its lines, as the cell.
      text: (row) => {
        const entry = entryOf(row);
        return entry ? linkedLabels(entry).join(', ') : '';
      },
      filter: { kind: 'boolean', value: (row) => Boolean(entryOf(row) && (linkedLabels(entryOf(row)!).length || entryOf(row)!.linkedByLines.length)) },
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
 * @param {(column: string, field: string) => string} labelOf Accessible label of the cell of a column (bulkCellLabels).
 * @returns {Record<string, ReactNode>} Cells by column id.
 */
export function entryFieldCells(entry: AnyEntry, env: EntryEnv, save: (column: string) => EntrySave, labelOf: (column: string, field: string) => string): Record<string, ReactNode> {
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
  const direction = (row: AnyEntry) => directionOf(row.amount);
  return {
    account: (
      <EditableSelect
        value={entry.accountId}
        label={labelOf('account', 'Compte')}
        {...itemSelectProps(env.accounts, entry.accountId)}
        onSave={(accountId) => accountId && save('account')(entry, { accountId })}
      />
    ),
    valueDate: <EditableDate value={valueDate} label={labelOf('valueDate', 'Date de valeur')} nullable onSave={(next) => save('valueDate')(entry, { valueDate: next })} />,
    payer: <PayerCell entry={entry} env={env} label={labelOf('payer', entry.amount < 0 ? 'Destinataire' : 'Émetteur')} save={save('payer')} />,
    category: split ? (
      onLines(entryRefs(entry, 'categoryId').map((id) => env.paths.get(id) ?? ''))
    ) : (
      <EditableSelect
        value={entry.categoryId ?? null}
        label={labelOf('category', 'Catégorie')}
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
        label={labelOf('method', 'Moyen de paiement')}
        nullable
        {...itemSelectProps(
          methods.filter((method) => (entry.amount < 0 ? method.outgoing : method.incoming) || method.id === entry.methodId),
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
      onLines(entryRefs(entry, 'projectId').map((id) => env.projectLabels.get(id) ?? ''))
    ) : (
      <ProjectCell value={entry.projectId ?? null} env={env} label={labelOf('project', 'Projet')} onSave={(projectId) => save('project')(entry, (row) => (row.lines.length ? {} : { projectId }))} />
    ),
    documents: split ? (
      onLines(entry.lines.flatMap((line) => line.documents.map((document) => document.label)))
    ) : (
      <DocumentsCell
        documents={entry.documents}
        env={env}
        label={labelOf('documents', 'Pièces justificatives')}
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
      onLines(linkedLabels(entry))
    ) : (
      <LinksCell
        links={entryLinks(entry)}
        entryId={entry.id}
        lines={false}
        label={labelOf('links', 'Mouvements liés')}
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
