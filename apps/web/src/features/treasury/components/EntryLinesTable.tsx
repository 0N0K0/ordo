import { memberOrRelation, memberOrRelationKey, memberRelationOptions, parsePersonKey, personKey } from '../../../components/people/people-keys';
import { Checkbox, Text } from '@mantine/core';
import { listSelectProps, itemOptions } from '../../../components/settings/item-look';
import { EVERYDAY_CONTEXT, splitAmounts, type TreasuryLineMode } from '@ordo/shared';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { EditableDate, EditableNumber, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { categoryOptions } from '../lib/categories';
import { DocumentsCell, LinksCell, ProjectCell } from './entry-cells';
import type { AnyEntry, EntryEnv, EntryUpdate } from '../lib/entry-env';
import { applyDiff, bulkSaver, type BulkChange } from '../../../components/data-table/selection/bulk-edit';
import { entryValues } from '../lib/entry-values';
import { categoryForDirection, valueInMode, type LineLink, type LineValues } from '../lib/lines';
import { SignedAmount } from '../../../components/money/SignedAmount';

/** Line of a split entry, with its place and signed amount. */
interface LineRow {
  index: number;
  line: LineValues;
  /** Signed amount (€). */
  amount: number;
  /** Supporting documents, as stored. */
  documents: AnyEntry['lines'][number]['documents'];
}

/**
 * Key of a line in the table.
 * @param {LineRow} row Line.
 * @returns {string} Key.
 */
const lineKey = (row: LineRow) => row.line.id ?? String(row.index);

/** Key of the line of "me" (no member nor relation). */
const ME = 'me';

/**
 * Key of the person a line is for.
 * @param {LineValues} line Line.
 * @returns {string} "m:<id>", "r:<id>", or ME.
 */
const whomKey = (line: LineValues) => memberOrRelationKey(line) ?? ME;

/**
 * Columns of the lines of an entry.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<LineRow>[]} Columns.
 */
function lineColumns(env: EntryEnv): DataColumn<LineRow>[] {
  const me = env.settings?.treasuryMembers.find((member) => member.isMe);
  const whomName = (row: LineRow) => (whomKey(row.line) === ME ? (me ? `${me.name} (moi)` : 'Moi') : (env.names.get(whomKey(row.line)) ?? ''));
  const contextName = (row: LineRow) => (row.line.contextId ? (env.names.get(`context:${row.line.contextId}`) ?? '') : EVERYDAY_CONTEXT);
  const categoryName = (row: LineRow) => (row.line.categoryId ? (env.paths.get(row.line.categoryId) ?? '') : '');
  const projectName = (row: LineRow) => (row.line.projectId ? (env.projectNames.get(row.line.projectId) ?? '') : '');
  const whomChoices = [
    ...(env.settings?.treasuryMembers ?? []).map((member) => ({ value: member.isMe ? ME : personKey('member', member.id), label: member.isMe ? `${member.name} (moi)` : member.name })),
    ...(env.settings?.treasuryRelations ?? []).map((relation) => ({ value: personKey('relation', relation.id), label: relation.name })),
  ];
  return [
    { id: 'label', bulk: true, label: 'Libellé', size: 200, locked: true, sortValue: (row) => row.line.label ?? null, text: (row) => row.line.label ?? '' },
    {
      id: 'whom',
      bulk: true,
      label: 'Bénéficiaire',
      size: 170,
      sortValue: whomName,
      text: whomName,
      filter: { kind: 'choice', value: (row) => whomKey(row.line), options: whomChoices },
      groupable: true,
    },
    {
      id: 'category',
      bulk: true,
      label: 'Catégorie',
      size: 180,
      sortValue: (row) => categoryName(row) || null,
      text: categoryName,
      filter: {
        kind: 'choice',
        value: (row) => row.line.categoryId,
        options: [...categoryOptions(env.settings?.treasuryCategories ?? [], 'OUT'), ...categoryOptions(env.settings?.treasuryCategories ?? [], 'IN')],
      },
      groupable: true,
    },
    {
      id: 'context',
      bulk: true,
      label: 'Contexte',
      size: 160,
      sortValue: contextName,
      text: contextName,
      filter: {
        kind: 'choice',
        value: (row) => row.line.contextId ?? ME,
        options: [{ value: ME, label: EVERYDAY_CONTEXT }, ...itemOptions(env.settings?.treasuryContexts ?? [])],
      },
      groupable: true,
    },
    { id: 'mode', bulk: true, label: 'Unité', size: 80, sortValue: (row) => row.line.mode, text: (row) => (row.line.mode === 'PERCENT' ? '%' : '€'), filter: false },
    { id: 'value', bulk: true, label: 'Valeur', size: 110, numeric: true, sortValue: (row) => row.line.value, text: (row) => String(row.line.value).replace('.', ','), filter: false },
    {
      id: 'amount',
      label: 'Montant',
      size: 120,
      numeric: true,
      sortValue: (row) => row.amount,
      formatTotal: fmt.money,
      text: (row) => `${row.amount > 0 ? '+' : ''}${fmt.money(row.amount)}`,
      filter: { kind: 'number', value: (row) => row.amount },
    },
    {
      id: 'loan',
      bulk: true,
      label: 'Prêt',
      size: 80,
      sortValue: (row) => (row.line.loan ? 1 : 0),
      text: (row) => (row.line.loan ? 'Prêt' : ''),
      filter: { kind: 'boolean', value: (row) => row.line.loan },
    },
    {
      id: 'date',
      bulk: true,
      label: 'Date',
      size: 130,
      sortValue: (row) => row.line.date,
      text: (row) => (row.line.date ? fmt.day(row.line.date) : ''),
      filter: { kind: 'date', value: (row) => row.line.date },
    },
    {
      id: 'project',
      bulk: true,
      label: 'Projet',
      size: 180,
      sortValue: (row) => projectName(row) || null,
      text: projectName,
      filter: { kind: 'choice', value: (row) => row.line.projectId, options: env.projects },
      groupable: true,
    },
    {
      id: 'documents',
      bulk: true,
      label: 'Pièces justificatives',
      size: 220,
      text: (row) => row.documents.map((document) => document.title).join(', '),
      filter: { kind: 'boolean', value: (row) => row.documents.length > 0 },
    },
    {
      id: 'links',
      bulk: true,
      label: 'Relative à un autre mouvement',
      size: 240,
      text: (row) => row.line.links.map((link) => link.entryLabel).join(', '),
      filter: { kind: 'boolean', value: (row) => row.line.links.length > 0 },
    },
  ];
}

/**
 * Lines of a split entry unfolded under it, as a table like every other (views, search, filters, sorts, groups,
 * columns, footer): each field changed in place saves the entry; what the lines leave (« Non réparti ») is told in
 * its toolbar.
 * @param {{ entry: AnyEntry, env: EntryEnv, save: EntryUpdate }} props Component props.
 * @returns {JSX.Element} Table.
 */
export function EntryLinesTable({ entry, env, save }: { entry: AnyEntry; env: EntryEnv; save: EntryUpdate }) {
  const values = entryValues(entry, { status: entry.status, copy: false, accountId: entry.accountId });
  const { amounts, remainder } = splitAmounts(entry.amount, entry.lines);
  const sign = entry.amount < 0 ? -1 : 1;
  const rows: LineRow[] = values.lines.map((line, index) => ({ index, line, amount: amounts[index] / 100, documents: entry.lines[index]?.documents ?? [] }));
  const view = useDataView({ tableKey: 'treasury-entry-lines', getKey: lineKey, columns: lineColumns(env), rows, title: `Répartition de ${entry.label}` });
  const categories = env.settings?.treasuryCategories ?? [];

  /**
   * Saves fields of lines, the other lines kept: one save of the entry.
   * @param {LineRow[]} changed Lines changed.
   * @param {(row: LineRow) => Partial<LineValues>} changeFor Change of each.
   * @returns {void}
   */
  const saveLines = (changed: LineRow[], changeFor: (row: LineRow) => Partial<LineValues>) => {
    const byIndex = new Map(changed.map((row) => [row.index, changeFor(row)]));
    save(entry, { lines: values.lines.map((line, position) => (byIndex.has(position) ? { ...line, ...byIndex.get(position) } : line)) });
  };
  const bulk = bulkSaver<LineRow, Partial<LineValues>>(view, (row, change) => saveLines([row], () => change), saveLines);

  /**
   * Saves a cell of a line (and the bulk selection of its column).
   * @param {string} column Column.
   * @param {LineRow} row Line.
   * @param {BulkChange<LineRow, Partial<LineValues>>} change Change.
   * @returns {void}
   */
  const saveLine = (column: string, row: LineRow, change: BulkChange<LineRow, Partial<LineValues>>) => bulk(column)(row, change);

  return (
    <DataTable
      view={view}
      verticalSpacing={4}
      bar={{
        searchLabel: 'Rechercher (libellé, bénéficiaire, catégorie)',
        tools:
          remainder !== 0 ? (
            <Text size="sm" c="dimmed">
              Non réparti :{' '}
              <Text span inherit fw={600} ff="monospace" c="var(--mantine-color-text)">
                {fmt.moneyCents(remainder)}
              </Text>
            </Text>
          ) : undefined,
      }}
      getKey={lineKey}
      cells={(row) => {
        const { line, index } = row;
        const name = line.label ?? `la ligne ${index + 1}`;
        return {
          label: <EditableText value={line.label} label={`Libellé de ${name}`} nullable onSave={(label) => saveLine('label', row, { label })} />,
          whom: (
            <EditableSelect
              value={whomKey(line) === ME ? null : whomKey(line)}
              label={`Bénéficiaire de ${name}`}
              nullable
              data={memberRelationOptions(env.settings?.treasuryMembers ?? [], env.settings?.treasuryRelations ?? [], { withMe: false })}
              // A loan is with a relation only.
              onSave={(key) =>
                saveLine('whom', row, (target) => ({
                  ...memberOrRelation(key),
                  loan: parsePersonKey(key)?.kind === 'relation' ? target.line.loan : false,
                }))
              }
            />
          ),
          category: (
            <EditableSelect
              value={line.categoryId}
              label={`Catégorie de ${name}`}
              nullable
              // A line going the other way (a refund in a purchase…) takes a category of that way.
              {...treeSelectProps(categoryOptions(categories, row.amount < 0 ? 'OUT' : 'IN'))}
              // A category of money out goes to the lines of money out only (and in to in).
              onSave={(categoryId) => saveLine('category', row, (target) => (categoryId && !categoryForDirection(categories, categoryId, target.amount < 0 ? 'OUT' : 'IN') ? {} : { categoryId }))}
            />
          ),
          context: (
            <EditableSelect
              value={line.contextId}
              label={`Contexte de ${name}`}
              nullable
              {...listSelectProps(env.settings?.treasuryContexts ?? [])}
              onSave={(contextId) => saveLine('context', row, { contextId })}
            />
          ),
          mode: (
            <EditableSelect
              value={line.mode}
              label={`Unité de ${name}`}
              data={[
                { value: 'AMOUNT', label: '€' },
                { value: 'PERCENT', label: '%' },
              ]}
              // The share stays the same when the unit changes.
              onSave={(mode) =>
                mode &&
                saveLine('mode', row, (target) => {
                  if (target.line.mode === mode) return {};
                  return { mode: mode as TreasuryLineMode, value: valueInMode(mode as TreasuryLineMode, target.amount * sign, values.amount) };
                })
              }
            />
          ),
          value: (
            <EditableNumber
              amount={line.mode === 'AMOUNT'}
              value={line.value}
              label={`Valeur de ${name}`}
              suffix={line.mode === 'PERCENT' ? '%' : '€'}
              signed
              onSave={(value) => value !== null && saveLine('value', row, { value })}
            />
          ),
          amount: <SignedAmount value={row.amount} />,
          loan: (
            <Checkbox
              size="xs"
              aria-label={`Prêt (${name})`}
              disabled={!line.relationId}
              title={line.relationId ? undefined : 'Un prêt se fait avec une relation : choisissez-la comme bénéficiaire.'}
              checked={line.loan}
              onChange={(event) => {
                const loan = event.currentTarget.checked;
                // A loan is with a relation only.
                saveLine('loan', row, (target) => (target.line.relationId ? { loan } : {}));
              }}
            />
          ),
          date: <EditableDate value={line.date} label={`Date d’achat de ${name}`} nullable onSave={(date) => saveLine('date', row, { date })} />,
          project: <ProjectCell value={line.projectId} env={env} label={`Projet de ${name}`} onSave={(projectId) => saveLine('project', row, { projectId })} />,
          documents: (
            <DocumentsCell
              documents={row.documents}
              env={env}
              label={`Pièces justificatives de ${name}`}
              onSave={(ids) =>
                saveLine('documents', row, (target) => ({
                  libraryDocumentIds: applyDiff(target.line.libraryDocumentIds, line.libraryDocumentIds, ids.libraryDocumentIds),
                  projectResourceIds: applyDiff(target.line.projectResourceIds, line.projectResourceIds, ids.projectResourceIds),
                }))
              }
            />
          ),
          links: (
            <LinksCell
              links={line.links}
              entryId={entry.id}
              lines
              label={`Lier ${name} à un autre mouvement`}
              onSave={(links) =>
                saveLine('links', row, (target) => {
                  // Those added here added, those removed here removed, the others of the line kept.
                  const keyOf = (link: LineLink) => `${link.kind}:${link.id}`;
                  const kept = applyDiff(target.line.links.map(keyOf), line.links.map(keyOf), links.map(keyOf));
                  const all = new Map([...target.line.links, ...links].map((link) => [keyOf(link), link]));
                  const next = kept.flatMap((key) => (all.get(key) ? [all.get(key)!] : []));
                  return {
                    links: next,
                    linkedLineIds: next.filter((link) => link.kind === 'line').map((link) => link.id),
                    linkedEntryIds: next.filter((link) => link.kind === 'entry').map((link) => link.id),
                  };
                })
              }
            />
          ),
        };
      }}
    />
  );
}
