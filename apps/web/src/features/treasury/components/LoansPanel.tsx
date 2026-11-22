import { sumOf, agreed } from '@ordo/shared';
import { openFormPanel } from '../../../components/panels/panels';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { Badge, Group, Stack, Text } from '@mantine/core';
import { ChatCircleIcon, HandCoinsIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { useTreasuryLoans, useTreasurySettings } from '../api';
import * as fmt from '../../../lib/format';
import { Comments } from '../../comments/components/Comments';
import { SignedAmount } from '../../../components/money/SignedAmount';
import { archivedIds } from '../../../lib/archive';
import { relationWords } from '../../../components/people/people-options';
import { useActiveWorkspace } from '../../workspaces/api';
import { loanColumns, type LoanRow } from '../lib/treasury-columns';

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
  const archivedRelations = archivedIds(settings?.treasuryRelations);
  const { perso } = useActiveWorkspace();
  const words = relationWords(perso);
  const columns = useMemo(() => loanColumns(relationWords(perso)), [perso]);
  const rows = useMemo((): LoanRow[] => {
    const nameOf = new Map((settings?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
    return (loans ?? []).flatMap((item) => {
      const name = nameOf.get(item.relationId) ?? `${words.noun} ${agreed('supprimé', words.feminine)}`;
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
  }, [loans, settings, words.noun, words.feminine]);
  const view = useDataView({ tableKey: 'treasury-loans', columns, rows, title: 'Prêts', getKey: (row) => row.key });
  const relations = (loans ?? []).map((item) => item.balance);
  const owedToMe = sumOf(
    relations.filter((balance) => balance > 0),
    (balance) => balance,
  );
  const iOwe = -sumOf(
    relations.filter((balance) => balance < 0),
    (balance) => balance,
  );

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
            message="Aucun prêt. Dans la répartition d’un mouvement, une ligne pour une relation peut être marquée « Prêt » (colonne « Prêt ») : une sortie lui prête ou lui rembourse, une entrée vous fait prêter par elle ou vous rembourse."
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
