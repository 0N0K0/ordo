import { Table, Text, UnstyledButton } from '@mantine/core';
import { ActionsMenu } from '../../actions/ActionsMenu';
import { aggregateValues, type TableAggregate } from '@ordo/shared';
import { CaretDownIcon } from '@phosphor-icons/react';
import * as fmt from '../../../lib/format';
import type { ShownColumn } from './data-table';

const LABELS: Record<TableAggregate, string> = { count: 'Compte', sum: 'Somme', avg: 'Moyenne', median: 'Médiane' };

interface TableFooterProps<R> {
  shown: ShownColumn<R>[];
  rows: R[];
  /** Total chosen under each column. */
  totals: Record<string, TableAggregate>;
  onChange: (totals: Record<string, TableAggregate>) => void;
  /** Cells before and after the columns. */
  before: number;
  after: number;
}

/**
 * Numbers of a column, from its sort values.
 * @param {ShownColumn<R>} column Column.
 * @param {R[]} rows Rows.
 * @returns {(number | string | null)[]} Values.
 */
function valuesOf<R>(column: ShownColumn<R>, rows: R[]): (number | string | null)[] {
  return rows.map((row) => column.sortValue?.(row) ?? column.text?.(row) ?? null);
}

/**
 * Total of a column over rows, as its cells write their values.
 * @param {ShownColumn<R>} column Column.
 * @param {R[]} rows Rows.
 * @param {TableAggregate | undefined} chosen Total chosen.
 * @returns {{ numeric: boolean, text: string }} Whether the column has numbers, and the total written ("—" for none).
 */
function totalOf<R>(column: ShownColumn<R>, rows: R[], chosen: TableAggregate | undefined): { numeric: boolean; text: string } {
  const values = valuesOf(column, rows);
  const numeric = values.some((value) => typeof value === 'number');
  const total = chosen ? aggregateValues(chosen, values) : null;
  // Amounts (their cells show euros) as money, by default.
  const money = rows.some((row) => column.text?.(row).includes('€'));
  const format = column.formatTotal ?? ((value: number) => (money ? fmt.money(value) : fmt.number(value, 2)));
  return { numeric, text: total === null ? '—' : chosen === 'count' ? fmt.number(total, 0) : format(total) };
}

/**
 * Footer of a table: under each column, the total chosen in place (count of the rows with a value; sum, average or
 * median of its numbers when it has some), over the rows kept by the filters. The groups repeat it over their rows
 * (GroupFooter).
 * @param {TableFooterProps<R>} props Component props.
 * @returns {JSX.Element} Footer.
 */
export function TableFooter<R>({ shown, rows, totals, onChange, before, after }: TableFooterProps<R>) {
  return (
    <Table.Tfoot>
      <Table.Tr style={{ borderTop: '1px solid var(--mantine-color-default-border)' }} bg="var(--mantine-color-default-hover)">
        {before > 0 && <Table.Th colSpan={before} />}
        {shown.map((column) => {
          // A column without values (selection, handles…): nothing under it.
          if (!column.sortValue && !column.text) return <Table.Th key={column.id} />;
          const chosen = totals[column.id];
          const { numeric, text } = totalOf(column, rows, chosen);
          const options = (['count', ...(numeric ? (['sum', 'avg', 'median'] as const) : [])] as TableAggregate[]).map((value) => ({ value, label: LABELS[value] }));
          return (
            <Table.Th key={column.id} ta={column.numeric ? 'right' : undefined} fw={500}>
              <ActionsMenu
                about={`total de « ${column.label} »`}
                position="bottom-start"
                target={
                  <UnstyledButton aria-label={`Total de « ${column.label} »`} style={{ whiteSpace: 'nowrap' }}>
                    {chosen ? (
                      <Text span size="sm" ff={column.numeric ? 'monospace' : undefined}>
                        <Text span size="xs" c="dimmed">
                          {LABELS[chosen]}{' '}
                        </Text>
                        {text}
                      </Text>
                    ) : (
                      <Text span size="xs" c="dimmed">
                        Total <CaretDownIcon aria-hidden style={{ verticalAlign: 'middle' }} />
                      </Text>
                    )}
                  </UnstyledButton>
                }
                items={[
                  ...options.map((option) => ({ label: option.label, checked: chosen === option.value, onClick: () => onChange({ ...totals, [column.id]: option.value }) })),
                  chosen && {
                    label: 'Aucun',
                    checked: false,
                    onClick: () => {
                      const next = { ...totals };
                      delete next[column.id];
                      onChange(next);
                    },
                  },
                ]}
              />
            </Table.Th>
          );
        })}
        {after > 0 && <Table.Th colSpan={after} />}
      </Table.Tr>
    </Table.Tfoot>
  );
}

/**
 * Footer of a group of rows: the totals chosen in the footer of the table, over the rows of the group.
 * @param {Omit<TableFooterProps<R>, 'onChange'> & { label: string, trProps?: Record<string, unknown> }} props Columns, rows of the group, totals, cells around, name of the group, props of its row.
 * @returns {JSX.Element | null} Row (none while no total is chosen).
 */
export function GroupFooter<R>({ shown, rows, totals, before, after, label, trProps }: Omit<TableFooterProps<R>, 'onChange'> & { label: string; trProps?: Record<string, unknown> }) {
  if (!shown.some((column) => totals[column.id])) return null;
  return (
    <Table.Tr {...trProps} bg="var(--mantine-color-default-hover)" aria-label={`Totaux de ${label}`}>
      {before > 0 && <Table.Td colSpan={before} />}
      {shown.map((column) => {
        const chosen = totals[column.id];
        if (!chosen || (!column.sortValue && !column.text)) return <Table.Td key={column.id} />;
        return (
          <Table.Td key={column.id} ta={column.numeric ? 'right' : undefined} style={{ whiteSpace: 'nowrap' }}>
            <Text span size="xs" ff={column.numeric ? 'monospace' : undefined}>
              <Text span size="xs" c="dimmed">
                {LABELS[chosen]}{' '}
              </Text>
              {totalOf(column, rows, chosen).text}
            </Text>
          </Table.Td>
        );
      })}
      {after > 0 && <Table.Td colSpan={after} />}
    </Table.Tr>
  );
}
