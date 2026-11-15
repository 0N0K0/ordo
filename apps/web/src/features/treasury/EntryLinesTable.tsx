import { Checkbox, Table, Text } from '@mantine/core';
import { EVERYDAY_CONTEXT, splitAmounts, type TreasuryLineMode } from '@ordo/shared';
import { DataTable } from '../../components/data-table/DataTable';
import { EditableDate, EditableNumber, EditableSelect, EditableText } from '../../components/data-table/EditableCells';
import type { DataColumn } from '../../components/data-table/data-table';
import { useDataView } from '../../components/data-table/use-data-view';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import * as fmt from '../../lib/format';
import { categoryOptions } from './categories';
import { DocumentsCell, LinksCell, ProjectCell } from './entry-cells';
import type { AnyEntry, EntryEnv, EntrySave } from './entry-env';
import { entryValues } from './entry-values';
import type { LineValues } from './lines';

/** Line of a split entry, with its place and signed amount. */
interface LineRow {
  index: number;
  line: LineValues;
  /** Signed amount (€). */
  amount: number;
  /** Supporting documents, as stored. */
  documents: AnyEntry['lines'][number]['documents'];
}

/** Key of the line of "me" (no member nor relation). */
const ME = 'me';

/**
 * Key of the person a line is for.
 * @param {LineValues} line Line.
 * @returns {string} "m:<id>", "r:<id>", or ME.
 */
const whomKey = (line: LineValues) => (line.relationId ? `r:${line.relationId}` : line.memberId ? `m:${line.memberId}` : ME);

/**
 * Columns of the lines of an entry.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<LineRow>[]} Columns.
 */
function lineColumns(env: EntryEnv): DataColumn<LineRow>[] {
  const me = env.settings?.treasuryMembers.find((member) => member.isMe);
  const whomName = (row: LineRow) => (whomKey(row.line) === ME ? (me ? `${me.name} (moi)` : 'Moi') : (env.names.get(whomKey(row.line)) ?? ''));
  const contextName = (row: LineRow) => (row.line.contextId ? (env.names.get(`c:${row.line.contextId}`) ?? '') : EVERYDAY_CONTEXT);
  const categoryName = (row: LineRow) => (row.line.categoryId ? (env.paths.get(row.line.categoryId) ?? '') : '');
  const projectName = (row: LineRow) => (row.line.projectId ? (env.projectNames.get(row.line.projectId) ?? '') : '');
  const whomChoices = [
    ...(env.settings?.treasuryMembers ?? []).map((member) => ({ value: member.isMe ? ME : `m:${member.id}`, label: member.isMe ? `${member.name} (moi)` : member.name })),
    ...(env.settings?.treasuryRelations ?? []).map((relation) => ({ value: `r:${relation.id}`, label: relation.name })),
  ];
  return [
    { id: 'label', label: 'Libellé', size: 200, locked: true, sortValue: (row) => row.line.label ?? null, text: (row) => row.line.label ?? '' },
    {
      id: 'whom',
      label: 'Bénéficiaire',
      size: 170,
      sortValue: whomName,
      text: whomName,
      filter: { kind: 'choice', value: (row) => whomKey(row.line), options: whomChoices },
      groupable: true,
    },
    {
      id: 'category',
      label: 'Catégorie',
      size: 180,
      sortValue: (row) => categoryName(row) || null,
      text: categoryName,
      filter: { kind: 'choice', value: (row) => row.line.categoryId, options: [...env.paths].map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'context',
      label: 'Contexte',
      size: 160,
      sortValue: contextName,
      text: contextName,
      filter: {
        kind: 'choice',
        value: (row) => row.line.contextId ?? ME,
        options: [{ value: ME, label: EVERYDAY_CONTEXT }, ...(env.settings?.treasuryContexts ?? []).map((item) => ({ value: item.id, label: item.name }))],
      },
      groupable: true,
    },
    { id: 'mode', label: 'Unité', size: 80, sortValue: (row) => row.line.mode, text: (row) => (row.line.mode === 'PERCENT' ? '%' : '€'), filter: false },
    { id: 'value', label: 'Valeur', size: 110, numeric: true, sortValue: (row) => row.line.value, text: (row) => String(row.line.value).replace('.', ','), filter: false },
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
    { id: 'loan', label: 'Prêt', size: 80, sortValue: (row) => (row.line.loan ? 1 : 0), text: (row) => (row.line.loan ? 'Prêt' : ''), filter: { kind: 'boolean', value: (row) => row.line.loan } },
    { id: 'date', label: 'Date', size: 130, sortValue: (row) => row.line.date, text: (row) => (row.line.date ? fmt.day(row.line.date) : ''), filter: { kind: 'date', value: (row) => row.line.date } },
    {
      id: 'project',
      label: 'Projet',
      size: 180,
      sortValue: (row) => projectName(row) || null,
      text: projectName,
      filter: { kind: 'choice', value: (row) => row.line.projectId, options: [...env.projectNames].map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'documents',
      label: 'Pièces justificatives',
      size: 220,
      text: (row) => row.documents.map((document) => document.title).join(', '),
      filter: { kind: 'boolean', value: (row) => row.documents.length > 0 },
    },
    {
      id: 'links',
      label: 'Relative à un autre mouvement',
      size: 240,
      text: (row) => row.line.links.map((link) => link.entryLabel).join(', '),
      filter: { kind: 'boolean', value: (row) => row.line.links.length > 0 },
    },
  ];
}

/**
 * Lines of a split entry unfolded under it, as a table like every other (views, search, filters, sorts, groups,
 * columns, footer): each field changed in place saves the entry; what the lines leave is "not split".
 * @param {{ entry: AnyEntry, env: EntryEnv, save: EntrySave }} props Component props.
 * @returns {JSX.Element} Table.
 */
export function EntryLinesTable({ entry, env, save }: { entry: AnyEntry; env: EntryEnv; save: EntrySave }) {
  const values = entryValues(entry, { status: entry.status, copy: false, accountId: entry.accountId });
  const { amounts, remainder } = splitAmounts(entry.amount, entry.lines);
  const sign = entry.amount < 0 ? -1 : 1;
  const rows: LineRow[] = values.lines.map((line, index) => ({ index, line, amount: amounts[index] / 100, documents: entry.lines[index]?.documents ?? [] }));
  const view = useDataView({ tableKey: 'treasury-entry-lines', columns: lineColumns(env), rows, title: `Répartition de ${entry.label}` });
  const categories = env.settings?.treasuryCategories ?? [];

  /**
   * Saves fields of a line, the other lines kept.
   * @param {number} index Line.
   * @param {Partial<LineValues>} change Changed fields.
   * @returns {void}
   */
  const saveLine = (index: number, change: Partial<LineValues>) => save(entry, { lines: values.lines.map((line, position) => (position === index ? { ...line, ...change } : line)) });

  return (
    <DataTable
      view={view}
      verticalSpacing={4}
      bar={{ searchLabel: 'Rechercher (libellé, bénéficiaire, catégorie)' }}
      getKey={(row) => row.line.id ?? String(row.index)}
      footer={(shown) =>
        remainder !== 0 && (
          <Table.Tfoot>
            <Table.Tr>
              {shown.map((column) => (
                <Table.Td key={column.id} ta={column.numeric ? 'right' : undefined}>
                  {column.id === 'label' && (
                    <Text size="sm" c="dimmed">
                      Non réparti
                    </Text>
                  )}
                  {column.id === 'amount' && (
                    <Text size="sm" fw={600} ff="monospace">
                      {fmt.moneyCents(remainder)}
                    </Text>
                  )}
                </Table.Td>
              ))}
              <Table.Td />
            </Table.Tr>
          </Table.Tfoot>
        )
      }
      cells={(row) => {
        const { line, index } = row;
        const name = line.label ?? `la ligne ${index + 1}`;
        const relative = row.amount * sign;
        return {
          label: <EditableText value={line.label} label={`Libellé de ${name}`} nullable onSave={(label) => saveLine(index, { label })} />,
          whom: (
            <EditableSelect
              value={whomKey(line) === ME ? null : whomKey(line)}
              label={`Bénéficiaire de ${name}`}
              nullable
              data={[
                { group: 'Membres', items: (env.settings?.treasuryMembers ?? []).filter((member) => !member.isMe).map((member) => ({ value: `m:${member.id}`, label: member.name })) },
                { group: 'Relations', items: (env.settings?.treasuryRelations ?? []).map((relation) => ({ value: `r:${relation.id}`, label: relation.name })) },
              ].filter((group) => group.items.length)}
              // A loan is with a relation only.
              onSave={(key) =>
                saveLine(index, { memberId: key?.startsWith('m:') ? key.slice(2) : null, relationId: key?.startsWith('r:') ? key.slice(2) : null, loan: key?.startsWith('r:') ? line.loan : false })
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
              onSave={(categoryId) => saveLine(index, { categoryId })}
            />
          ),
          context: (
            <EditableSelect
              value={line.contextId}
              label={`Contexte de ${name}`}
              nullable
              data={(env.settings?.treasuryContexts ?? []).map((item) => ({ value: item.id, label: item.name }))}
              onSave={(contextId) => saveLine(index, { contextId })}
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
                saveLine(index, {
                  mode: mode as TreasuryLineMode,
                  value: mode === 'PERCENT' ? (values.amount ? Math.round(((relative * 100) / values.amount) * 100) / 100 : 0) : relative,
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
              onSave={(value) => value !== null && saveLine(index, { value })}
            />
          ),
          amount: (
            <Text span size="sm" ff="monospace" c={row.amount < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }}>
              {row.amount > 0 ? '+' : ''}
              {fmt.money(row.amount)}
            </Text>
          ),
          loan: (
            <Checkbox
              size="xs"
              aria-label={`Prêt (${name})`}
              disabled={!line.relationId}
              title={line.relationId ? undefined : 'Un prêt se fait avec une relation : choisissez-la comme bénéficiaire.'}
              checked={line.loan}
              onChange={(event) => saveLine(index, { loan: event.currentTarget.checked })}
            />
          ),
          date: <EditableDate value={line.date} label={`Date d’achat de ${name}`} nullable onSave={(date) => saveLine(index, { date })} />,
          project: <ProjectCell value={line.projectId} env={env} label={`Projet de ${name}`} onSave={(projectId) => saveLine(index, { projectId })} />,
          documents: <DocumentsCell documents={row.documents} env={env} label={`Pièces justificatives de ${name}`} onSave={(ids) => saveLine(index, ids)} />,
          links: (
            <LinksCell
              links={line.links}
              entryId={entry.id}
              lines
              label={`Lier ${name} à un autre mouvement`}
              onSave={(links) =>
                saveLine(index, {
                  links,
                  linkedLineIds: links.filter((link) => link.kind === 'line').map((link) => link.id),
                  linkedEntryIds: links.filter((link) => link.kind === 'entry').map((link) => link.id),
                })
              }
            />
          ),
        };
      }}
    />
  );
}
