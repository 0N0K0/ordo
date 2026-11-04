import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Sparkline } from '@mantine/charts';
import { addDays } from '@ordo/shared';
import { BankIcon, CheckCircleIcon, FileTextIcon, ReceiptIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useOverdueInvoices } from '../accounting/tracking-api';
import type { TreasuryProjection } from '../treasury/api';
import classes from './Home.module.css';
import { Figure, HomeCard, HomeEmpty } from './HomeCard';
import { dayLabel, daysBetween, localDayOf, money, type BillingSummary } from './home-data';

const MAX_ROWS = 5;

/**
 * Revenue of the month and of the year, drafts to finish, and the overdue invoices to follow up.
 * @param {{ summary: BillingSummary | null, today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function BillingCard({ summary, today }: { summary: BillingSummary | null; today: string }) {
  const overdue = useOverdueInvoices(today);
  return (
    <HomeCard title="Facturation" icon={<ReceiptIcon aria-hidden />} to="/accounting?tab=overdue" linkLabel="Relancer" loading={!summary || !overdue.data}>
      {summary && overdue.data && (
        <Stack gap="sm">
          <SimpleGrid cols={3}>
            <Figure label="CA HT du mois" value={money(summary.monthNet)} />
            <Figure label="CA HT de l’année" value={money(summary.yearNet)} />
            <Figure label="Brouillons" value={summary.drafts} />
          </SimpleGrid>
          {overdue.data.length === 0 ? (
            <HomeEmpty icon={<CheckCircleIcon aria-hidden />}>Aucune facture en retard.</HomeEmpty>
          ) : (
            <Stack gap={0}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                En retard
              </Text>
              {overdue.data.slice(0, MAX_ROWS).map((invoice) => (
                <Link key={invoice.id} to={`/accounting/${invoice.id}`} className={classes.row}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Stack gap={0} miw={0}>
                      <Text size="sm" truncate>
                        {invoice.clientName ?? 'Client inconnu'}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {invoice.number} · {daysBetween(invoice.dueDate ?? today, today)} j de retard
                        {invoice.reminderCount > 0 && ` · ${invoice.reminderCount} relance${invoice.reminderCount > 1 ? 's' : ''}`}
                      </Text>
                    </Stack>
                    <Text size="sm" fw={600} c="red" style={{ flexShrink: 0 }}>
                      {money(invoice.balance ?? 0)}
                    </Text>
                  </Group>
                </Link>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </HomeCard>
  );
}

/**
 * Quotes sent and waiting for an answer, oldest first.
 * @param {{ summary: BillingSummary | null, today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function QuotesCard({ summary, today }: { summary: BillingSummary | null; today: string }) {
  return (
    <HomeCard title="Devis en attente" icon={<FileTextIcon aria-hidden />} to="/accounting" loading={!summary}>
      {summary && summary.pendingQuotes.length === 0 && <HomeEmpty icon={<CheckCircleIcon aria-hidden />}>Aucun devis en attente de réponse.</HomeEmpty>}
      {summary && summary.pendingQuotes.length > 0 && (
        <Stack gap={0}>
          {summary.pendingQuotes.slice(0, MAX_ROWS).map((quote) => {
            const sent = quote.sentAt ? localDayOf(quote.sentAt) : quote.issueDate;
            return (
              <Link key={quote.id} to={`/accounting/${quote.id}`} className={classes.row}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Stack gap={0} miw={0}>
                    <Text size="sm" truncate>
                      {quote.clientName ?? 'Client inconnu'}
                      {quote.title ? ` · ${quote.title}` : ''}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {quote.number} · envoyé il y a {daysBetween(sent, today)} j
                    </Text>
                  </Stack>
                  <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                    {money(quote.totalNet)}
                  </Text>
                </Group>
              </Link>
            );
          })}
          {summary.pendingQuotes.length > MAX_ROWS && (
            <Text size="xs" c="dimmed" pt={4}>
              + {summary.pendingQuotes.length - MAX_ROWS} autre{summary.pendingQuotes.length - MAX_ROWS > 1 ? 's' : ''}
            </Text>
          )}
        </Stack>
      )}
    </HomeCard>
  );
}

/**
 * Balance today and coming three months (curve, low point), and the movements expected within 30 days.
 * @param {{ projection: TreasuryProjection | undefined, today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function TreasuryCard({ projection, today }: { projection: TreasuryProjection | undefined; today: string }) {
  const data = useMemo(() => {
    if (!projection) return null;
    const forecast = projection.series.filter((point) => point.date >= today);
    const in30 = addDays(today, 30);
    const at30 = [...forecast].reverse().find((point) => point.date <= in30);
    const lowest = forecast.reduce<(typeof forecast)[number] | null>((low, point) => (!low || point.balance < low.balance ? point : low), null);
    const coming = projection.items
      .filter((item) => item.kind !== 'ACTUAL' && item.date <= in30)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, MAX_ROWS);
    return { forecast, at30, lowest, coming };
  }, [projection, today]);

  return (
    <HomeCard title="Trésorerie" icon={<BankIcon aria-hidden />} to="/treasury" loading={!data || !projection}>
      {data && projection && (
        <Stack gap="sm">
          <SimpleGrid cols={3}>
            <Figure label="Aujourd’hui" value={money(projection.balance)} />
            <Figure label="Dans 30 jours" value={data.at30 ? money(data.at30.balance) : '—'} />
            <Figure label="Point bas (3 mois)" value={data.lowest ? money(data.lowest.balance) : '—'} color={data.lowest && data.lowest.balance < 0 ? 'red' : undefined} />
          </SimpleGrid>
          {data.forecast.length > 1 && (
            <Sparkline
              h={48}
              data={data.forecast.map((point) => point.balance)}
              curveType="linear"
              color={data.lowest && data.lowest.balance < 0 ? 'red' : 'blue'}
              fillOpacity={0.2}
              aria-label="Solde prévu sur trois mois"
            />
          )}
          {data.coming.length === 0 ? (
            <HomeEmpty icon={<BankIcon aria-hidden />}>Aucun mouvement attendu dans les 30 jours.</HomeEmpty>
          ) : (
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                À venir
              </Text>
              {data.coming.map((item, index) => (
                <Group key={`${item.date}-${item.label}-${index}`} justify="space-between" wrap="nowrap" gap="xs">
                  <Group gap="xs" wrap="nowrap" miw={0}>
                    <Text size="sm" c={item.overdue ? 'red' : 'dimmed'} w={88} style={{ flexShrink: 0 }}>
                      {item.overdue ? 'En retard' : dayLabel(item.date, today)}
                    </Text>
                    <Text size="sm" truncate>
                      {item.label}
                    </Text>
                  </Group>
                  <Text size="sm" fw={600} c={item.amount < 0 ? 'red' : 'teal'} style={{ flexShrink: 0 }}>
                    {item.amount > 0 ? '+' : ''}
                    {money(item.amount)}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </HomeCard>
  );
}
