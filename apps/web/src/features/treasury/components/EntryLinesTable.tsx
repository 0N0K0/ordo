import { useActiveWorkspace } from '../../workspaces/api';
import { memberOrRelation, memberOrRelationKey, memberRelationOptions, parsePersonKey, ME_KEY } from '../../../components/people/people-keys';
import { unarchived } from '../../../lib/archive';
import { Checkbox, Group, Text } from '@mantine/core';
import { TrashIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { itemSelectProps } from '../../../components/items/item-look';
import { splitAmounts, type TreasuryLineMode, fromCents, directionOf } from '@ordo/shared';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { EditableDate, EditableNumber, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { categoryOptions } from '../lib/categories';
import { DocumentsCell, LinksCell, ProjectCell } from './entry-cells';
import type { AnyEntry, EntryEnv, EntryUpdate } from '../lib/entry-env';
import { applyDiff, bulkCellLabels, type BulkChange, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { entryValues, linesChange } from '../lib/entry-values';
import { categoryForDirection, equalShares, linkKey, newSplitLine, plannedLineContext, valueInMode, type LineLink, type LineValues } from '../lib/lines';
import { SignedAmount } from '../../../components/money/SignedAmount';
import { relationWords } from '../../../components/people/people-options';
import { ActionButton } from '../../../components/actions/ActionButton';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { AddRowButton } from '../../../components/data-table/cells/AddRowField';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { createInPanel } from '../../../components/settings/create-settings-item';
import { useCategoryCreators } from '../hooks/use-settings-items';
import { ContextForm, RelationForm } from './TeamPanel';
import { lineColumns, whomKey, type LineRow } from '../lib/treasury-columns';

/** Line of a split entry, with its place and signed amount. */
const lineKey = (row: LineRow) => row.line.id ?? String(row.index);

/** Key of the line of "me" (no member nor relation). */
const ME = ME_KEY;

/**
 * Split of an entry unfolded under it, as a table like every other (views, search, filters, sorts, groups, columns,
 * footer): its lines are added, changed in place and removed here, each change saving the entry; what the lines leave
 * (« Non réparti ») is told in its toolbar. An entry that is not split yet shows how to start.
 * @param {{ entry: AnyEntry, env: EntryEnv, save: EntryUpdate }} props Component props.
 * @returns {JSX.Element} Table.
 */
export function EntryLinesTable({ entry, env, save }: { entry: AnyEntry; env: EntryEnv; save: EntryUpdate }) {
  const values = entryValues(entry, { status: entry.status, copy: false, accountId: entry.accountId });
  const { amounts, remainder } = splitAmounts(entry.amount, entry.lines);
  const sign = entry.amount < 0 ? -1 : 1;
  const { perso } = useActiveWorkspace();
  const rows: LineRow[] = values.lines.map((line, index) => ({ index, line, amount: fromCents(amounts[index]), documents: entry.lines[index]?.documents ?? [] }));
  const view = useDataView({ tableKey: 'treasury-entry-lines', getKey: lineKey, columns: lineColumns(env), rows, title: `Répartition de ${entry.label}` });
  const members = env.settings?.treasuryMembers ?? [];
  const createCategory = useCategoryCreators(env.settings?.treasuryCategories ?? []);
  // What is left to split, in the direction of the entry (cents): what a new line takes.
  const left = remainder * sign;

  /**
   * Replaces the lines of the entry (its first lines split it: see `linesChange`).
   * @param {LineValues[]} lines New lines.
   * @returns {void}
   */
  const setLines = (lines: LineValues[]) => {
    const linked: LineLink[] = entry.linkedEntries.map((item) => ({ kind: 'entry', id: item.id, entryLabel: item.label, date: item.date, label: null, amount: item.amount }));
    save(entry, linesChange(values, lines, linked));
  };

  /**
   * Adds a line: what is not split yet, for me, in the context planned that day.
   * @returns {void}
   */
  const addLine = () =>
    setLines([...values.lines, newSplitLine({ value: fromCents(left), memberId: members.find((member) => member.isMe)?.id ?? null, contextId: plannedLineContext(env.settings, entry.date) })]);

  /**
   * Removes a line, once confirmed: its amount is not split any more, its documents and links go with it.
   * @param {LineRow} row Line.
   * @returns {void}
   */
  const removeLine = (row: LineRow) =>
    confirmDestructive({
      title: 'Retirer la ligne',
      risks: `${row.line.label ? `La ligne « ${row.line.label} »` : `La ligne ${row.index + 1}`} est retirée de la répartition de « ${entry.label} » : son montant redevient non réparti, ses pièces justificatives et ses liens sont détachés.`,
      confirmLabel: 'Retirer',
      onConfirm: () => setLines(values.lines.filter((_, position) => position !== row.index)),
    });

  /**
   * Replaces the lines by an equal share for every member (confirmed when lines are replaced).
   * @returns {void}
   */
  const splitEqually = () => {
    const shares = () => setLines(equalShares(members, plannedLineContext(env.settings, entry.date)));
    if (values.lines.length === 0) return shares();
    confirmDestructive({
      title: 'Répartir à parts égales',
      risks: `Les lignes de la répartition de « ${entry.label} » sont remplacées par une ligne par membre : leurs catégories, pièces justificatives et liens sont perdus.`,
      confirmLabel: 'Remplacer',
      confirmIcon: <UsersThreeIcon aria-hidden />,
      onConfirm: shares,
    });
  };

  // A line takes what is left: nothing left, nothing to add (a line of no value is refused).
  const addHint = left > 0 ? undefined : 'Tout le montant est réparti : réduisez une ligne pour en ajouter une.';
  const equalSharesButton = members.length > 1 && (
    <ActionButton priority="tertiary" icon={<UsersThreeIcon aria-hidden />} onClick={splitEqually}>
      Parts égales entre les membres
    </ActionButton>
  );
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
  const cellLabelOf = bulkCellLabels(view, (row) => row.line.label ?? `Ligne ${row.index + 1}`);
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
        tools: (
          <>
            {equalSharesButton}
            {remainder !== 0 && (
              <Text size="sm" c="dimmed">
                Non réparti :{' '}
                <Text span inherit fw={600} ff="monospace" c="var(--mantine-color-text)">
                  {fmt.moneyCents(remainder)}
                </Text>
              </Text>
            )}
          </>
        ),
      }}
      getKey={lineKey}
      empty={
        <EmptyState
          compact
          message="Ce mouvement n’est pas réparti. Répartissez-le par membre, catégorie et contexte, en euros ou en pourcentage : une valeur positive va dans son sens, une négative en sens inverse (remboursement inclus dans un achat…). Ce qui reste est « non réparti »."
          action={
            <Group gap="xs">
              <AddItemButton onClick={addLine} disabled={left <= 0}>
                Ajouter une ligne
              </AddItemButton>
              {equalSharesButton}
            </Group>
          }
        />
      }
      addRow={(group) => (group === null ? <AddRowButton label="Ajouter une ligne" onClick={addLine} disabled={left <= 0} title={addHint} /> : null)}
      actions={(row) => (
        <RowActions
          name={row.line.label ?? `Ligne ${row.index + 1}`}
          items={[{ label: 'Retirer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => removeLine(row) }]}
        />
      )}
      cells={(row) => {
        const { line, index } = row;
        const name = line.label ? `« ${line.label} »` : `la ligne ${index + 1}`;
        return {
          label: <EditableText value={line.label} label={cellLabelOf('label', row, 'Libellé')} nullable onSave={(label) => saveLine('label', row, { label })} />,
          whom: (
            <EditableSelect
              value={whomKey(line) === ME ? null : whomKey(line)}
              label={cellLabelOf('whom', row, 'Bénéficiaire')}
              nullable
              data={memberRelationOptions(env.settings?.treasuryMembers ?? [], unarchived(env.settings?.treasuryRelations ?? [], line.relationId), { perso, withMe: false })}
              onCreate={async (relationName) => {
                const id = await createInPanel(relationWords(perso).new, (done) => <RelationForm name={relationName} onDone={done} />);
                return id && memberOrRelationKey({ relationId: id });
              }}
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
              label={cellLabelOf('category', row, 'Catégorie')}
              nullable
              // A line going the other way (a refund in a purchase…) takes a category of that way.
              {...treeSelectProps(categoryOptions(categories, directionOf(row.amount), undefined, line.categoryId))}
              onCreate={createCategory[directionOf(row.amount)]}
              // A category of money out goes to the lines of money out only (and in to in).
              onSave={(categoryId) => saveLine('category', row, (target) => (categoryId && !categoryForDirection(categories, categoryId, directionOf(target.amount)) ? {} : { categoryId }))}
            />
          ),
          context: (
            <EditableSelect
              value={line.contextId}
              label={cellLabelOf('context', row, 'Contexte')}
              nullable
              {...itemSelectProps(env.settings?.treasuryContexts ?? [], line.contextId)}
              onCreate={(contextLabel) => createInPanel('Nouveau contexte', (done) => <ContextForm label={contextLabel} onDone={done} />)}
              onSave={(contextId) => saveLine('context', row, { contextId })}
            />
          ),
          mode: (
            <EditableSelect
              value={line.mode}
              label={cellLabelOf('mode', row, 'Unité')}
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
              label={cellLabelOf('value', row, 'Valeur')}
              suffix={line.mode === 'PERCENT' ? '%' : undefined}
              signed
              // A line that changes direction loses a category of the other direction.
              onSave={(value) => value !== null && saveLine('value', row, (target) => ({ value, categoryId: categoryForDirection(categories, target.line.categoryId, directionOf(value * sign)) }))}
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
          date: <EditableDate value={line.date} label={cellLabelOf('date', row, 'Date d’achat')} nullable onSave={(date) => saveLine('date', row, { date })} />,
          project: <ProjectCell value={line.projectId} env={env} label={cellLabelOf('project', row, 'Projet')} onSave={(projectId) => saveLine('project', row, { projectId })} />,
          documents: (
            <DocumentsCell
              documents={row.documents}
              env={env}
              label={cellLabelOf('documents', row, 'Pièces justificatives')}
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
              label={cellLabelOf('links', row, 'Mouvements liés')}
              onSave={(links) =>
                saveLine('links', row, (target) => {
                  // Those added here added, those removed here removed, the others of the line kept.
                  const kept = applyDiff(target.line.links.map(linkKey), line.links.map(linkKey), links.map(linkKey));
                  const all = new Map([...target.line.links, ...links].map((link) => [linkKey(link), link]));
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
