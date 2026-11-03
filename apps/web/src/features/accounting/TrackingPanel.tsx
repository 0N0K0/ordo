import { ActionIcon, Alert, Anchor, Button, ColorSwatch, FileInput, Group, Modal, NumberInput, Select, Skeleton, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { documentPaymentSchema, formatMoney } from '@ordo/shared';
import { BellRingingIcon, CheckIcon, CoinsIcon, FileArrowUpIcon, PaperclipIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryAccounts, type TreasuryAccount } from '../treasury/api';
import type { AccountingDocument } from './documents-api';
import { Section } from './EditorSection';
import { useDocumentStatuses, useTrackingMutations } from './tracking-api';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

/**
 * Printed calendar date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Date.
 */
const printedDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

interface PaymentValues extends Record<string, unknown> {
  accountId: string;
  date: string;
  amount: number;
  method: string;
}

/**
 * Payment of an invoice, or refund of a credit note: an actual treasury entry settling it.
 * @param {{ document: AccountingDocument, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function PaymentForm({ document, onDone }: { document: AccountingDocument; onDone: () => void }) {
  const { data: accounts } = useTreasuryAccounts();
  // The form starts once the accounts are known, so that the first one is chosen.
  if (!accounts) return <Skeleton height={240} />;
  return <PaymentFields document={document} accounts={accounts} onDone={onDone} />;
}

/**
 * Fields of a payment, the accounts loaded.
 * @param {{ document: AccountingDocument, accounts: TreasuryAccount[], onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function PaymentFields({ document, accounts, onDone }: { document: AccountingDocument; accounts: TreasuryAccount[]; onDone: () => void }) {
  const { recordPayment } = useTrackingMutations();
  const open = accounts.filter((account) => !account.archived);
  const form = useAppForm<PaymentValues>({
    initialValues: { accountId: open[0]?.id ?? '', date: localToday(), amount: document.balance ?? 0, method: document.paymentMethods ?? '' },
    schema: documentPaymentSchema,
  });
  if (open.length === 0) {
    return (
      <Alert color="blue">
        Créez d’abord un compte dans la{' '}
        <Anchor component={Link} to="/treasury" onClick={onDone}>
          trésorerie
        </Anchor>
        .
      </Alert>
    );
  }
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        recordPayment.mutate(
          { id: document.id, input: { ...input, method: input.method || null } },
          {
            onSuccess: () => {
              notifySuccess(document.type === 'CREDIT_NOTE' ? 'Remboursement enregistré.' : 'Paiement enregistré.');
              onDone();
            },
            onError: (error) => showFormError(form, error),
          },
        ),
      )}
    >
      <Stack gap="sm">
        <Select label="Compte" required data={open.map((account) => ({ value: account.id, label: account.name }))} allowDeselect={false} {...form.getInputProps('accountId')} />
        <DatePickerInput label="Date" required valueFormat="D MMM YYYY" {...form.getInputProps('date')} />
        <NumberInput label="Montant" required min={0} decimalScale={2} decimalSeparator="," thousandSeparator=" " suffix=" €" {...form.getInputProps('amount')} />
        <TextInput label="Moyen de paiement" placeholder="Virement, chèque…" {...form.getInputProps('method')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={recordPayment.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Acceptance of a quote: date, and its signed copy.
 * @param {{ document: AccountingDocument, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function AcceptForm({ document, onDone }: { document: AccountingDocument; onDone: () => void }) {
  const { accept } = useTrackingMutations();
  const [date, setDate] = useState<string | null>(document.acceptedAt ? String(document.acceptedAt) : localToday());
  const [file, setFile] = useState<File | null>(null);
  return (
    <Stack gap="sm">
      <DatePickerInput label="Date d’acceptation" required valueFormat="D MMM YYYY" value={date} onChange={(value) => setDate(value)} />
      <FileInput
        label="Devis signé"
        description={document.signedFileName ? `Remplace « ${document.signedFileName} ».` : 'PDF ou image du devis signé « Bon pour accord ».'}
        placeholder="Choisir un fichier"
        accept="application/pdf,image/*"
        leftSection={<FileArrowUpIcon aria-hidden />}
        clearable
        value={file}
        onChange={setFile}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={accept.isPending}
          disabled={!date}
          onClick={() =>
            date &&
            accept.mutate(
              { id: document.id, date, file },
              {
                onSuccess: () => {
                  notifySuccess('Devis accepté.');
                  onDone();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Note of a reminder made outside Ordo (call, letter…).
 * @param {{ documentId: string, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ReminderForm({ documentId, onDone }: { documentId: string; onDone: () => void }) {
  const { addReminder } = useTrackingMutations();
  const [note, setNote] = useState('');
  return (
    <Stack gap="sm">
      <TextInput label="Note" placeholder="Appel, courrier…" maxLength={500} value={note} onChange={(event) => setNote(event.currentTarget.value)} data-autofocus />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={addReminder.isPending}
          onClick={() =>
            addReminder.mutate(
              { id: documentId, note: note.trim() || null },
              {
                onSuccess: () => {
                  notifySuccess('Relance notée.');
                  onDone();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          Noter
        </Button>
      </Group>
    </Stack>
  );
}

type Dialog = 'payment' | 'accept' | 'reminder' | null;

/**
 * Tracking of a final document: configurable status, sending, acceptance with the signed quote (quotes),
 * payments and reminders (invoices), refunds (credit notes).
 * @param {{ document: AccountingDocument, onRemind: () => void, remindPending: boolean }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TrackingPanel({ document, onRemind, remindPending }: { document: AccountingDocument; onRemind: () => void; remindPending: boolean }) {
  const { data: statuses } = useDocumentStatuses();
  const mutations = useTrackingMutations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const isQuote = document.type === 'QUOTE';
  const isCredit = document.type === 'CREDIT_NOTE';
  const scoped = (statuses ?? []).filter((status) => status.scope === (isQuote ? 'QUOTE' : 'INVOICE'));
  const money = (amount: number) => formatMoney(Math.round(amount * 100), document.currency);
  const balance = document.balance ?? 0;
  const onError = (error: Error) => notifyError(error.message);

  return (
    <Section title="Suivi">
      <Select
        label="Statut"
        data={scoped.map((status) => ({ value: status.id, label: status.name }))}
        value={document.trackingStatus?.id ?? null}
        allowDeselect={false}
        leftSection={document.trackingStatus ? <ColorSwatch color={document.trackingStatus.color} size={12} /> : undefined}
        renderOption={({ option }) => (
          <Group gap="xs" wrap="nowrap">
            <ColorSwatch color={scoped.find((status) => status.id === option.value)?.color ?? 'gray'} size={12} />
            {option.label}
          </Group>
        )}
        onChange={(statusId) => statusId && mutations.setStatus.mutate({ id: document.id, statusId }, { onError })}
      />
      {document.overdue && (
        <Alert color="red" p="xs">
          {isQuote ? 'Date de validité dépassée sans réponse.' : `Échéance dépassée : ${money(balance)} restent dus.`}
        </Alert>
      )}
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {document.sentAt ? `Envoyé le ${dateTimeFormat.format(new Date(document.sentAt))}` : 'Pas encore envoyé.'}
        </Text>
        {!document.sentAt && (
          <Button size="compact-xs" variant="subtle" onClick={() => mutations.markSent.mutate(document.id, { onError })}>
            Marquer envoyé
          </Button>
        )}
      </Group>

      {isQuote && (
        <Stack gap={6}>
          {document.acceptedAt && <Text size="sm">Accepté le {printedDate(String(document.acceptedAt))}</Text>}
          {document.signedFileUrl && (
            <Group justify="space-between" wrap="nowrap">
              <Anchor href={document.signedFileUrl} target="_blank" rel="noopener" size="sm" truncate>
                <Group gap={4} wrap="nowrap">
                  <PaperclipIcon aria-hidden /> {document.signedFileName}
                </Group>
              </Anchor>
              <Tooltip label="Retirer le devis signé">
                <ActionIcon variant="subtle" color="gray" aria-label="Retirer le devis signé" onClick={() => mutations.removeSigned.mutate(document.id, { onError })}>
                  <XIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
          <Button variant="light" color="green" leftSection={<CheckIcon aria-hidden />} onClick={() => setDialog('accept')}>
            {document.acceptedAt ? (document.signedFileUrl ? 'Remplacer le devis signé' : 'Joindre le devis signé') : 'Enregistrer l’acceptation'}
          </Button>
        </Stack>
      )}

      {!isQuote && (
        <Stack gap={6}>
          <Table withRowBorders={false} verticalSpacing={2}>
            <Table.Tbody>
              {(document.credited ?? 0) > 0 && (
                <Table.Tr>
                  <Table.Td>Avoirs</Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    −{money(document.credited ?? 0)}
                  </Table.Td>
                </Table.Tr>
              )}
              <Table.Tr>
                <Table.Td>{isCredit ? 'Remboursé' : 'Payé'}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {money(document.paid ?? 0)}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>{isCredit ? 'À rembourser' : balance < 0 ? 'Trop-perçu' : 'Reste dû'}</Table.Td>
                <Table.Td ta="right" ff="monospace" fw={600}>
                  {money(Math.abs(balance))}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          {document.payments.map((payment) => (
            <Group key={payment.id} justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed" truncate>
                {printedDate(String(payment.entry.date))} · {payment.entry.accountName}
                {payment.entry.method ? ` · ${payment.entry.method}` : ''}
              </Text>
              <Text size="xs" ff="monospace">
                {money(payment.amount)}
              </Text>
            </Group>
          ))}
          {balance > 0 && (
            <Button variant="light" leftSection={<CoinsIcon aria-hidden />} onClick={() => setDialog('payment')}>
              {isCredit ? 'Enregistrer un remboursement' : 'Enregistrer un paiement'}
            </Button>
          )}
        </Stack>
      )}

      {!isQuote && !isCredit && (balance > 0 || document.reminders.length > 0) && (
        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Relances
            </Text>
            {balance > 0 && (
              <Group gap={4}>
                <Button size="compact-xs" variant="light" color="orange" leftSection={<BellRingingIcon aria-hidden />} loading={remindPending} onClick={onRemind}>
                  Relancer par mail
                </Button>
                <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setDialog('reminder')}>
                  Noter
                </Button>
              </Group>
            )}
          </Group>
          {document.reminders.length === 0 ? (
            <Text size="xs" c="dimmed">
              Aucune relance.
            </Text>
          ) : (
            document.reminders.map((reminder) => (
              <Group key={reminder.id} justify="space-between" wrap="nowrap">
                <Text size="xs" truncate>
                  {dateTimeFormat.format(new Date(reminder.date))}
                  {reminder.note ? ` · ${reminder.note}` : ''}
                </Text>
                <Tooltip label="Supprimer la relance">
                  <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Supprimer la relance" onClick={() => mutations.deleteReminder.mutate(reminder.id, { onError })}>
                    <XIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))
          )}
        </Stack>
      )}

      <Modal opened={dialog !== null} onClose={() => setDialog(null)} title={dialog === 'accept' ? 'Acceptation du devis' : dialog === 'reminder' ? 'Noter une relance' : isCredit ? 'Remboursement' : 'Paiement'}>
        {dialog === 'payment' && <PaymentForm document={document} onDone={() => setDialog(null)} />}
        {dialog === 'accept' && <AcceptForm document={document} onDone={() => setDialog(null)} />}
        {dialog === 'reminder' && <ReminderForm documentId={document.id} onDone={() => setDialog(null)} />}
      </Modal>
    </Section>
  );
}
