import { Accordion, Badge, Group, Paper, Skeleton, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import { formatMoney } from '@ordo/shared';
import { HandCoinsIcon } from '@phosphor-icons/react';
import { useTreasuryLoans, useTreasurySettings } from './api';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * Amount in euros.
 * @param {number} amount Amount.
 * @returns {string} "1 234,56 €".
 */
const money = (amount: number) => formatMoney(Math.round(amount * 100));

/**
 * Loans with the relations, both ways: for each relation, who owes whom (what went out to it, lent or debts repaid,
 * against what came in from it, borrowed or loans repaid back), and the history of its loan lines. A line is a
 * loan when marked so in the split of an entry.
 * @returns {JSX.Element} Panel.
 */
export function LoansPanel() {
  const { data: loans, isPending } = useTreasuryLoans();
  const { data: settings } = useTreasurySettings();
  const nameOf = new Map((settings?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  const owedToMe = (loans ?? []).filter((item) => item.balance > 0).reduce((sum, item) => sum + item.balance, 0);
  const iOwe = -(loans ?? []).filter((item) => item.balance < 0).reduce((sum, item) => sum + item.balance, 0);

  if (isPending) return <Skeleton height={160} />;
  if (!loans?.length) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="xs">
          <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
            <HandCoinsIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed" ta="center" maw={520}>
            Aucun prêt. Dans la répartition d’un mouvement, une ligne pour une relation peut être marquée « Prêt » (bouton trombone) : une sortie lui prête ou lui rembourse, une entrée vous fait
            prêter par elle ou vous rembourse.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Group gap="xl">
        <Text size="sm">
          On vous doit <strong>{money(owedToMe)}</strong>
        </Text>
        <Text size="sm">
          Vous devez <strong>{money(iOwe)}</strong>
        </Text>
      </Group>
      <Accordion variant="separated" multiple>
        {loans.map((item) => (
          <Accordion.Item key={item.relationId} value={item.relationId}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap" pr="sm">
                <Text fw={600}>{nameOf.get(item.relationId) ?? 'Relation supprimée'}</Text>
                {item.balance === 0 ? (
                  <Badge variant="light" color="gray">
                    Soldé
                  </Badge>
                ) : item.balance > 0 ? (
                  <Badge variant="light" color="green">
                    Vous doit {money(item.balance)}
                  </Badge>
                ) : (
                  <Badge variant="light" color="red">
                    Vous lui devez {money(-item.balance)}
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                Sorti vers elle {money(item.out)} · Reçu d’elle {money(item.in)}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Table verticalSpacing={4}>
                <Table.Tbody>
                  {item.items.map((line) => (
                    <Table.Tr key={line.lineId}>
                      <Table.Td w={120}>
                        <Text size="sm">{dateFormat.format(new Date(`${line.date}T00:00:00Z`))}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{line.label}</Text>
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace" c={line.amount < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }}>
                        {line.amount > 0 ? '+' : ''}
                        {money(line.amount)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
