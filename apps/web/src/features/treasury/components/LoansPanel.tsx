import { openFormPanel } from '../../../components/panels/panels';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { Badge, Group, Stack, Text } from '@mantine/core';
import { ChatCircleIcon, HandCoinsIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { useTreasuryLoans, useTreasurySettings } from '../api';
import * as fmt from '../../../lib/format';
import { Comments } from '../../comments/components/Comments';
import { SignedAmount } from '../../../components/money/SignedAmount';

/** Row of the loans: a relation (what it owes or is owed), or one of its loan lines under it. */
type LoanRow =
  | { kind: 'relation'; key: string; relationId: string; name: string; balance: number; out: number; in: number }
  | { kind: 'line'; key: string; relationId: string; name: string; date: string; label: string; amount: number };

/**
 * Balance of a relation, told: soldé, it owes you, you owe it.
 * @param {{ balance: number }} props Component props.
 * @returns {JSX.Element} Badge.
 */
function BalanceBadge({ balance }: { balance: number }) {
  if (balance === 0)
    return (
      <Badge variant="light" color="gray">
        Soldé
      </Badge>
    );
  return balance > 0 ? (
    <Badge variant="light" color="green">
      Vous doit {fmt.money(balance)}
    </Badge>
  ) : (
    <Badge variant="light" color="red">
      Vous lui devez {fmt.money(-balance)}
    </Badge>
  );
}

const COLUMNS: DataColumn<LoanRow>[] = [
  {
    id: 'name',
    label: 'Relation / ligne',
    size: 260,
    locked: true,
    sortValue: (row) => (row.kind === 'relation' ? row.name : row.label),
    text: (row) => (row.kind === 'relation' ? row.name : row.label),
  },
  {
    id: 'balance',
    label: 'Solde',
    size: 170,
    numeric: true,
    sortValue: (row) => (row.kind === 'relation' ? row.balance : null),
    text: (row) => (row.kind === 'relation' ? fmt.money(row.balance) : ''),
    filter: { kind: 'number', value: (row) => (row.kind === 'relation' ? row.balance : null) },
    formatTotal: fmt.money,
  },
  {
    id: 'out',
    label: 'Sorti vers elle',
    size: 140,
    numeric: true,
    sortValue: (row) => (row.kind === 'relation' ? row.out : null),
    text: (row) => (row.kind === 'relation' ? fmt.money(row.out) : ''),
    formatTotal: fmt.money,
  },
  {
    id: 'in',
    label: 'Reçu d’elle',
    size: 140,
    numeric: true,
    sortValue: (row) => (row.kind === 'relation' ? row.in : null),
    text: (row) => (row.kind === 'relation' ? fmt.money(row.in) : ''),
    formatTotal: fmt.money,
  },
  {
    id: 'date',
    label: 'Date',
    size: 120,
    sortValue: (row) => (row.kind === 'line' ? row.date : null),
    text: (row) => (row.kind === 'line' ? fmt.day(row.date) : ''),
    filter: { kind: 'date', value: (row) => (row.kind === 'line' ? row.date : null) },
  },
  {
    id: 'amount',
    label: 'Montant',
    size: 130,
    numeric: true,
    sortValue: (row) => (row.kind === 'line' ? row.amount : null),
    text: (row) => (row.kind === 'line' ? fmt.money(row.amount) : ''),
    filter: { kind: 'number', value: (row) => (row.kind === 'line' ? row.amount : null) },
    formatTotal: fmt.money,
  },
];

/**
 * Loans with the relations, both ways: a row for each relation, who owes whom (what went out to it, lent or debts
 * repaid, against what came in from it, borrowed or loans repaid back), its loan lines under it. A line is a loan when
 * marked so in the split of an entry.
 * @returns {JSX.Element} Panel.
 */
export function LoansPanel() {
  const { data: loans, isPending } = useTreasuryLoans();
  const { data: settings } = useTreasurySettings();
  // Comments of an archived relation are read only.
  const archivedRelations = new Set((settings?.treasuryRelations ?? []).filter((relation) => relation.archived).map((relation) => relation.id));
  const rows = useMemo((): LoanRow[] => {
    const nameOf = new Map((settings?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
    return (loans ?? []).flatMap((item) => {
      const name = nameOf.get(item.relationId) ?? 'Relation supprimée';
      return [
        { kind: 'relation' as const, key: item.relationId, relationId: item.relationId, name, balance: item.balance, out: item.out, in: item.in },
        ...item.items.map((line) => ({
          kind: 'line' as const,
          key: `${item.relationId}:${line.lineId}`,
          relationId: item.relationId,
          name,
          date: line.date,
          label: line.label,
          amount: line.amount,
        })),
      ];
    });
  }, [loans, settings]);
  const view = useDataView({ tableKey: 'treasury-loans', columns: COLUMNS, rows, title: 'Prêts', getKey: (row) => row.key });
  const relations = (loans ?? []).map((item) => item.balance);
  const owedToMe = relations.filter((balance) => balance > 0).reduce((sum, balance) => sum + balance, 0);
  const iOwe = -relations.filter((balance) => balance < 0).reduce((sum, balance) => sum + balance, 0);

  return (
    <Stack gap="md">
      {rows.length > 0 && (
        <Group gap="xl">
          <Text size="sm">
            On vous doit <strong>{fmt.money(owedToMe)}</strong>
          </Text>
          <Text size="sm">
            Vous devez <strong>{fmt.money(iOwe)}</strong>
          </Text>
        </Group>
      )}
      <DataTable
        view={view}
        getKey={(row) => row.key}
        loading={isPending}
        framed
        verticalSpacing={4}
        parentKey={(row) => (row.kind === 'line' ? row.relationId : null)}
        empty={
          <EmptyState
            icon={<HandCoinsIcon aria-hidden />}
            message="Aucun prêt. Dans la répartition d’un mouvement, une ligne pour une relation peut être marquée « Prêt » (bouton trombone) : une sortie lui prête ou lui rembourse, une entrée vous fait prêter par elle ou vous rembourse."
          />
        }
        cells={(row) =>
          row.kind === 'relation'
            ? {
                name: (
                  <Text size="sm" fw={600} truncate>
                    {row.name}
                  </Text>
                ),
                balance: <BalanceBadge balance={row.balance} />,
                out: fmt.money(row.out),
                in: fmt.money(row.in),
              }
            : {
                name: (
                  <Text size="sm" truncate>
                    {row.label}
                  </Text>
                ),
                date: fmt.day(row.date),
                amount: <SignedAmount value={row.amount} />,
              }
        }
        actions={(row) =>
          row.kind === 'relation' && (
            <RowActions
              name={row.name}
              primary={{
                label: 'Commentaires',
                icon: <ChatCircleIcon aria-hidden />,
                onClick: () => openFormPanel(`Commentaires · ${row.name}`, () => <Comments target="RELATION" id={row.relationId} readOnly={archivedRelations.has(row.relationId)} />),
              }}
              items={[]}
            />
          )
        }
      />
    </Stack>
  );
}
