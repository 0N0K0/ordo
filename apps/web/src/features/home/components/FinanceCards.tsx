import { LateBadge } from '../../../components/feedback/LateBadge';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SubSection } from '../../../components/page/SubSection';
import { parisDay } from '../../../lib/dates';
import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Sparkline } from '@mantine/charts';
import { addDays, daysBetween } from '@ordo/shared';
import { BankIcon, CheckCircleIcon, FileTextIcon, ReceiptIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';

import { useOverdueInvoices } from '../../accounting/api/tracking';
import type { TreasuryProjection } from '../../treasury/api';
import { CardFigure, HomeCard } from './HomeCard';
import { HOME_ROWS, HomeList, HomeRow } from './HomeList';
import { balanceIn30Days, IN_30_DAYS, dayLabel, type BillingSummary } from '../lib/home-data';
import * as fmt from '../../../lib/format';
import { countOf } from '../../../lib/text';
import { documentPath, OVERDUE_INVOICES_PATH, PAGES } from '../../../app/pages';
import { unarchived } from '../../../lib/archive';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';
import { SignedAmount } from '../../../components/money/SignedAmount';

/**
 * Revenue of the month and of the year, drafts to finish, and the overdue invoices to follow up.
 * @param {{ summary: BillingSummary | null, today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function BillingCard({ summary, today }: { summary: BillingSummary | null; today: string }) {
  const overdue = useOverdueInvoices(today);
  return (
    <HomeCard title="Facturation" icon={<ReceiptIcon aria-hidden />} to={OVERDUE_INVOICES_PATH} linkLabel="Relancer" loading={!summary || !overdue.data}>
      {summary && overdue.data && (
        <Stack gap="sm">
          <SimpleGrid cols={3}>
            <CardFigure label="CA HT du mois" value={fmt.money(summary.monthNet)} />
            <CardFigure label="CA HT de l’année" value={fmt.money(summary.yearNet)} />
            <CardFigure label="Brouillons" value={summary.drafts} />
          </SimpleGrid>
          {overdue.data.length === 0 ? (
            <EmptyState compact icon={<CheckCircleIcon aria-hidden />} message="Aucune facture en retard." />
          ) : (
            <SubSection title="En retard" gap={0}>
              <HomeList
                items={overdue.data}
                render={(invoice) => (
                  <HomeRow
                    key={invoice.id}
                    to={documentPath(invoice.id)}
                    label={invoice.clientName ?? 'Client inconnu'}
                    subtitle={`${invoice.number}${invoice.reminderCount > 0 ? ` · ${countOf(invoice.reminderCount, 'relance')}` : ''}`}
                    value={
                      <Group gap="xs" wrap="nowrap">
                        {invoice.dueDate && <LateBadge due={invoice.dueDate} today={today} />}
                        <Text size="sm" fw={600} c={LATE_COLOR}>
                          {fmt.money(invoice.balance ?? 0)}
                        </Text>
                      </Group>
                    }
                  />
                )}
              />
            </SubSection>
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
    <HomeCard title="Devis en attente" icon={<FileTextIcon aria-hidden />} to={PAGES.accounting.path} loading={!summary}>
      {summary && summary.pendingQuotes.length === 0 && <EmptyState compact icon={<CheckCircleIcon aria-hidden />} message="Aucun devis en attente de réponse." />}
      {summary && summary.pendingQuotes.length > 0 && (
        <HomeList
          items={summary.pendingQuotes}
          render={(quote) => {
            const sent = quote.sentAt ? parisDay(quote.sentAt) : quote.issueDate;
            return (
              <HomeRow
                key={quote.id}
                to={documentPath(quote.id)}
                label={`${quote.clientName ?? 'Client inconnu'}${quote.label ? ` · ${quote.label}` : ''}`}
                subtitle={`${quote.number} · envoyé ${fmt.daysAgo(daysBetween(sent, today))}`}
                value={
                  <Text size="sm" fw={600}>
                    {fmt.money(quote.totalNet)}
                  </Text>
                }
              />
            );
          }}
        />
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
    const at30 = balanceIn30Days(forecast, today);
    const lowest = forecast.reduce<(typeof forecast)[number] | null>((low, point) => (!low || point.balance < low.balance ? point : low), null);
    const coming = unarchived(projection.items)
      // Archived ones still count in the balances, their rows are hidden.
      .filter((item) => item.kind !== 'ACTUAL' && item.date <= in30)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, HOME_ROWS);
    return { forecast, at30, lowest, coming };
  }, [projection, today]);

  return (
    <HomeCard title="Trésorerie" icon={<BankIcon aria-hidden />} to={PAGES.treasury.path} loading={!data || !projection}>
      {data && projection && (
        <Stack gap="sm">
          <SimpleGrid cols={3}>
            <CardFigure label="Aujourd’hui" value={fmt.money(projection.balance)} />
            <CardFigure label={IN_30_DAYS} value={data.at30 ? fmt.money(data.at30.balance) : '—'} />
            <CardFigure label="Point bas (3 mois)" value={data.lowest ? fmt.money(data.lowest.balance) : '—'} color={data.lowest && data.lowest.balance < 0 ? 'red' : undefined} />
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
            <EmptyState compact icon={<BankIcon aria-hidden />} message="Aucun mouvement attendu dans les 30 jours." />
          ) : (
            <SubSection title="À venir" gap={2}>
              {data.coming.map((item, index) => (
                <Group key={`${item.date}-${item.label}-${index}`} justify="space-between" wrap="nowrap" gap="xs">
                  <Group gap="xs" wrap="nowrap" miw={0}>
                    <Text size="sm" c={item.overdue ? LATE_COLOR : 'dimmed'} w={88} style={{ flexShrink: 0 }}>
                      {item.overdue ? 'En retard' : dayLabel(item.date, today)}
                    </Text>
                    <Text size="sm" truncate>
                      {item.label}
                    </Text>
                  </Group>
                  <SignedAmount value={item.amount} fw={600} style={{ flexShrink: 0, whiteSpace: 'nowrap' }} />
                </Group>
              ))}
            </SubSection>
          )}
        </Stack>
      )}
    </HomeCard>
  );
}
