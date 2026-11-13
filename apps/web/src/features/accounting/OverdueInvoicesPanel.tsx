import { Alert, Anchor, Badge, Button, Checkbox, Group, Paper, Select, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { modals } from '@mantine/modals';
import { daysBetween, formatMoney, REMINDER_DELAY_DAYS, SENDING_CHANNEL_LABELS, type SendingChannel } from '@ordo/shared';
import { CheckCircleIcon, FileTextIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../components/data-table/DataTable';
import { useDataView } from '../../components/data-table/use-data-view';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
import { localDay, localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useMailAccounts } from '../mail/api';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { useOverdueInvoices, useTrackingMutations, type OverdueInvoice } from './tracking-api';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const instantFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

/** Invoices not reminded for that many days are offered for a new reminder. */
const REMIND_AFTER_DAYS = 7;

/**
 * Days since the last reminder of an invoice (null: never reminded).
 * @param {OverdueInvoice} invoice Invoice.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {number | null} Days.
 */
function daysSinceReminder(invoice: OverdueInvoice, today: string): number | null {
  if (!invoice.lastReminderAt) return null;
  const date = new Date(invoice.lastReminderAt);
  const day = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return daysBetween(day, today);
}

/** Columns of the overdue invoices. */
const OVERDUE_COLUMNS: DataColumn<OverdueInvoice>[] = [
  {
    id: 'invoice',
    label: 'Facture',
    size: 220,
    locked: true,
    sortValue: (invoice) => invoice.number ?? null,
    text: (invoice) => `${invoice.type === 'DEPOSIT_INVOICE' ? `${DOCUMENT_TYPE_LABELS.DEPOSIT_INVOICE} ` : ''}${invoice.number ?? ''}`,
  },
  { id: 'client', label: 'Client', size: 200, hiddenByDefault: true, sortValue: (invoice) => invoice.clientName ?? null, text: (invoice) => invoice.clientName ?? '', groupable: true },
  {
    id: 'sent',
    label: 'Envoi',
    size: 230,
    sortValue: (invoice) => invoice.sentAt ?? null,
    text: (invoice) => (invoice.sentAt ? dayFormat.format(new Date(`${localDay(new Date(invoice.sentAt))}T00:00:00Z`)) : ''),
    filter: { kind: 'date', value: (invoice) => (invoice.sentAt ? localDay(new Date(invoice.sentAt)) : null) },
  },
  {
    id: 'balance',
    label: 'Reste dû',
    size: 130,
    numeric: true,
    sortValue: (invoice) => invoice.balance ?? 0,
    text: (invoice) => formatMoney(Math.round((invoice.balance ?? 0) * 100), invoice.currency),
  },
  {
    id: 'reminder',
    label: 'Dernière relance',
    size: 200,
    sortValue: (invoice) => invoice.lastReminderAt ?? null,
    text: (invoice) => (invoice.lastReminderAt ? instantFormat.format(new Date(invoice.lastReminderAt)) : 'Jamais'),
    filter: { kind: 'date', value: (invoice) => (invoice.lastReminderAt ? localDay(new Date(invoice.lastReminderAt)) : null) },
  },
  { id: 'email', label: 'Destinataire', size: 240, sortValue: (invoice) => invoice.billingEmail ?? null, text: (invoice) => invoice.billingEmail ?? '' },
];

/**
 * Invoices to remind (sent at least 15 days ago, still due): when and how they were sent, what is still due, reminders already made and to whom the reminder goes; the
 * chosen ones are reminded at once, one mail each with the invoice joined.
 * @returns {JSX.Element} Panel.
 */
export function OverdueInvoicesPanel() {
  const today = localToday();
  const { data: invoices, isPending } = useOverdueInvoices(today);
  const { data: accounts } = useMailAccounts();
  const { sendReminders } = useTrackingMutations();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accountId, setAccountId] = useState<string | null>(null);
  const account = accountId ?? accounts?.[0]?.id ?? null;
  const remindable = (invoices ?? []).filter((invoice) => invoice.billingEmail);
  const chosen = remindable.filter((invoice) => selected.has(invoice.id));
  const stale = remindable.filter((invoice) => (daysSinceReminder(invoice, today) ?? Infinity) >= REMIND_AFTER_DAYS);
  const view = useDataView({ tableKey: 'overdue-invoices', columns: OVERDUE_COLUMNS, rows: invoices ?? [], title: 'Factures à relancer' });

  /**
   * Adds or removes an invoice from the selection.
   * @param {string} id Invoice.
   * @returns {void}
   */
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * Asks for confirmation, then sends the reminders of the selection.
   * @returns {void}
   */
  const confirmSend = () => {
    if (!account || chosen.length === 0) return;
    const from = accounts?.find((item) => item.id === account);
    const modalId = 'send-reminders';
    modals.open({
      modalId,
      title: `Relancer ${chosen.length} facture${chosen.length > 1 ? 's' : ''}`,
      children: (
        <Stack gap="md">
          <Text size="sm">
            {chosen.length} mail{chosen.length > 1 ? 's partiront' : ' partira'} depuis {from?.email}, un par facture, avec la facture en PDF et le reste dû. Chaque relance sera notée sur sa facture.
          </Text>
          <Stack gap={2}>
            {chosen.map((invoice) => (
              <Text key={invoice.id} size="xs" c="dimmed">
                {invoice.number} — {invoice.clientName} → {invoice.billingEmail}
              </Text>
            ))}
          </Stack>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => modals.close(modalId)}>
              Annuler
            </Button>
            <Button
              leftSection={<PaperPlaneTiltIcon aria-hidden />}
              onClick={() => {
                modals.close(modalId);
                sendReminders.mutate(
                  { accountId: account, documentIds: chosen.map((invoice) => invoice.id) },
                  {
                    onSuccess: (results) => {
                      const sent = results.filter((result) => !result.error);
                      const failed = results.filter((result) => result.error);
                      if (sent.length) notifySuccess(`${sent.length} relance${sent.length > 1 ? 's envoyées' : ' envoyée'}.`);
                      if (failed.length) notifyError(failed.map((result) => `${result.number} : ${result.error}`).join(' — '));
                      setSelected(new Set(failed.map((result) => result.documentId)));
                    },
                    onError: (error) => notifyError(error.message),
                  },
                );
              }}
            >
              Envoyer
            </Button>
          </Group>
        </Stack>
      ),
    });
  };

  if (isPending) return <Skeleton height={200} />;
  if (!invoices?.length) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" radius="xl" variant="light" color="green">
            <CheckCircleIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed" ta="center">
            Aucune facture à relancer : celles envoyées depuis {REMINDER_DELAY_DAYS} jours ou plus sont réglées.
          </Text>
        </Stack>
      </Paper>
    );
  }

  const total = view.rows.reduce((sum, invoice) => sum + Math.round((invoice.balance ?? 0) * 100), 0);
  return (
    <Stack gap="sm">
      {accounts && accounts.length === 0 && (
        <Alert color="yellow">
          Aucune boîte mail : ajoutez-en une dans{' '}
          <Anchor component={Link} to="/mail?settings=1" size="sm">
            les boîtes mail
          </Anchor>{' '}
          pour envoyer les relances.
        </Alert>
      )}
      <DataTable
        framed
        view={view}
        bar={{
          searchLabel: 'Rechercher une facture',
          tools: (
            <>
              <Text size="sm">
                {view.rows.length} facture{view.rows.length > 1 ? 's' : ''} en retard, <b>{formatMoney(total)}</b> à encaisser.
              </Text>
              <Group gap="sm" ml="auto" wrap="wrap">
                <Button variant="subtle" size="sm" disabled={stale.length === 0} onClick={() => setSelected(new Set(stale.map((invoice) => invoice.id)))}>
                  Non relancées depuis {REMIND_AFTER_DAYS} jours ({stale.length})
                </Button>
                {accounts && accounts.length > 1 && (
                  <Select aria-label="Boîte d’envoi" w={240} allowDeselect={false} data={accounts.map((item) => ({ value: item.id, label: item.email }))} value={account} onChange={setAccountId} />
                )}
                <Button leftSection={<PaperPlaneTiltIcon aria-hidden />} disabled={!account || chosen.length === 0} loading={sendReminders.isPending} onClick={confirmSend}>
                  Relancer{chosen.length ? ` (${chosen.length})` : ''}
                </Button>
              </Group>
            </>
          ),
        }}
        verticalSpacing="xs"
        highlightOnHover
        getKey={(invoice) => invoice.id}
        actions={(invoice) => (
          <RowActions name={invoice.number ?? 'la facture'} primary={{ label: 'Ouvrir la facture', icon: <FileTextIcon aria-hidden />, to: `/accounting/${invoice.id}` }} items={[]} />
        )}
        leading={{
          width: 44,
          header: (
            <Checkbox
              aria-label="Tout sélectionner"
              checked={remindable.length > 0 && chosen.length === remindable.length}
              indeterminate={chosen.length > 0 && chosen.length < remindable.length}
              disabled={remindable.length === 0}
              onChange={() => setSelected(chosen.length === remindable.length ? new Set() : new Set(remindable.map((invoice) => invoice.id)))}
            />
          ),
          cell: (invoice) => (
            <Checkbox
              aria-label={`Relancer ${invoice.number}`}
              checked={selected.has(invoice.id) && Boolean(invoice.billingEmail)}
              disabled={!invoice.billingEmail}
              onChange={() => toggle(invoice.id)}
            />
          ),
        }}
        cells={(invoice) => {
          // Reminders count from the sending.
          const sentDay = invoice.sentAt ? localDay(new Date(invoice.sentAt)) : null;
          const sentSince = sentDay ? daysBetween(sentDay, today) : 0;
          const since = daysSinceReminder(invoice, today);
          return {
            client: invoice.clientName,
            invoice: (
              <>
                <Anchor component={Link} to={`/accounting/${invoice.id}`} size="sm" fw={600}>
                  {invoice.type === 'DEPOSIT_INVOICE' ? `${DOCUMENT_TYPE_LABELS.DEPOSIT_INVOICE} ` : ''}
                  {invoice.number}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {invoice.clientName}
                </Text>
              </>
            ),
            sent: (
              <>
                <Text size="sm">
                  {sentDay ? dayFormat.format(new Date(`${sentDay}T00:00:00Z`)) : '—'}
                  {invoice.sentVia && (
                    <Text span size="xs" c="dimmed">
                      {' '}
                      · {SENDING_CHANNEL_LABELS[invoice.sentVia as SendingChannel] ?? invoice.sentVia}
                    </Text>
                  )}
                </Text>
                <Badge size="xs" variant="light" color={sentSince > 45 ? 'red' : 'orange'}>
                  Envoyée il y a {sentSince} jour{sentSince > 1 ? 's' : ''}
                </Badge>
                {invoice.dueDate && (
                  <Text size="xs" c="dimmed">
                    Échéance {dayFormat.format(new Date(`${invoice.dueDate}T00:00:00Z`))}
                  </Text>
                )}
              </>
            ),
            balance: <>{formatMoney(Math.round((invoice.balance ?? 0) * 100), invoice.currency)}</>,
            reminder: (
              <>
                {invoice.lastReminderAt ? (
                  <>
                    <Text size="sm">{instantFormat.format(new Date(invoice.lastReminderAt))}</Text>
                    <Text size="xs" c="dimmed">
                      {since === 0 ? 'aujourd’hui' : `il y a ${since} jour${since && since > 1 ? 's' : ''}`} · {invoice.reminderCount} relance{invoice.reminderCount > 1 ? 's' : ''}
                    </Text>
                  </>
                ) : (
                  <Text size="sm" c="dimmed">
                    Jamais
                  </Text>
                )}
              </>
            ),
            email: (
              <>
                {invoice.billingEmail ? (
                  <Text size="sm" truncate maw={220}>
                    {invoice.billingEmail}
                  </Text>
                ) : (
                  <Text size="sm" c="red">
                    Aucune adresse
                  </Text>
                )}
              </>
            ),
          };
        }}
      />
      <Text size="xs" c="dimmed">
        Une relance par mail et par facture, avec le PDF, la signature de la boîte d’envoi et le reste dû. Pour personnaliser le texte, relancez depuis la facture (« Relancer par mail »).
      </Text>
    </Stack>
  );
}
