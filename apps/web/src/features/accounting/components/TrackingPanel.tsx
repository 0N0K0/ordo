import { openFile } from '../../files/lib/open-file';
import { FileBadge } from '../../../components/items/FileBadge';
import { SubSection } from '../../../components/page/SubSection';
import { formCallbacks } from '../../../lib/form';
import { openFormPanel } from '../../../components/panels/panels';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { itemSelectProps } from '../../../components/items/item-look';

import { FileInput, Group, Select, Stack, Table, Text, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { PLAIN_TEXT_MAX, SENT_VIA_LABELS, type SendingChannel } from '@ordo/shared';
import { BellRingingIcon, CheckIcon, CoinsIcon, FileArrowUpIcon, NotePencilIcon, PaperPlaneTiltIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localToday } from '../../../lib/dates';
import { ON_ERROR } from '../../../lib/notify';
import type { AccountingDocument } from '../api/documents';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { PaymentForm } from './PaymentForm';
import { SentForm } from './SentForm';
import { useDocumentStatuses, useTrackingMutations } from '../api/tracking';
import * as fmt from '../../../lib/format';
import { FormActions } from '../../../components/dialogs/FormActions';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Acceptance of a quote: date, and its signed copy.
 * @param {{ document: AccountingDocument, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function AcceptForm({ document, onDone }: { document: AccountingDocument; onDone: () => void }) {
  const { accept } = useTrackingMutations();
  const [date, setDate] = useState<string | null>(document.acceptedAt ? document.acceptedAt : localToday());
  const [file, setFile] = useState<File | null>(null);
  return (
    <Stack gap="sm">
      <DatePickerInput label="Date d’acceptation" required value={date} onChange={(value) => setDate(value)} />
      <FileInput
        label="Devis signé"
        description={document.signedFilename ? `Remplace « ${document.signedFilename} ».` : 'PDF ou image du devis signé « Bon pour accord ».'}
        placeholder="Choisir un fichier"
        accept="application/pdf,image/*"
        leftSection={<FileArrowUpIcon aria-hidden />}
        clearable
        value={file}
        onChange={setFile}
      />
      <FormActions
        onCancel={onDone}
        loading={accept.isPending}
        disabled={!date}
        onSubmit={() => date && accept.mutate({ id: document.id, date, file }, formCallbacks(null, 'Devis accepté.', onDone))}
      />
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
      <Textarea label="Note" placeholder="Appel, courrier…" autosize minRows={2} maxLength={PLAIN_TEXT_MAX} value={note} onChange={(event) => setNote(event.currentTarget.value)} data-autofocus />
      <FormActions
        onCancel={onDone}
        submitLabel="Noter"
        submitIcon={<NotePencilIcon aria-hidden />}
        loading={addReminder.isPending}
        onSubmit={() => addReminder.mutate({ id: documentId, note: note.trim() || null }, formCallbacks(null, 'Relance notée.', onDone))}
      />
    </Stack>
  );
}

type Dialog = 'payment' | 'accept' | 'reminder' | 'sent';

/**
 * Tracking of a final document: configurable status, sending, acceptance with the signed quote (quotes),
 * payments and reminders (invoices), refunds (credit notes). Archived: shown only (no change).
 * @param {{ document: AccountingDocument, onRemind: () => void, remindPending: boolean }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TrackingPanel({ document, onRemind, remindPending }: { document: AccountingDocument; onRemind: () => void; remindPending: boolean }) {
  const { data: statuses } = useDocumentStatuses();
  const mutations = useTrackingMutations();
  const isQuote = document.type === 'QUOTE';
  const isCredit = document.type === 'CREDIT_NOTE';
  const scoped = (statuses ?? []).filter((status) => status.scope === (isQuote ? 'QUOTE' : 'INVOICE'));
  const money = (amount: number) => fmt.money(amount, document.currency);
  const balance = document.balance ?? 0;
  const locked = document.archived;

  /**
   * Opens a form of the follow-up: payment (or refund), acceptance of the quote, reminder, sending.
   * @param {Dialog} dialog Form.
   * @param {string | null} [sentStatusId] "Sent" status chosen in the list, given with the sending. Optional.
   * @returns {void}
   */
  const openDialog = (dialog: Dialog, sentStatusId: string | null = null) =>
    openFormPanel(dialog === 'accept' ? 'Acceptation du devis' : dialog === 'reminder' ? 'Noter une relance' : dialog === 'sent' ? 'Envoi' : isCredit ? 'Remboursement' : 'Paiement', (close) =>
      dialog === 'payment' ? (
        <PaymentForm document={document} onDone={close} />
      ) : dialog === 'accept' ? (
        <AcceptForm document={document} onDone={close} />
      ) : dialog === 'reminder' ? (
        <ReminderForm documentId={document.id} onDone={close} />
      ) : (
        <SentForm
          sentAt={document.sentAt}
          sentVia={document.sentVia}
          onSubmit={({ date, via }) => mutations.markSent.mutateAsync({ id: document.id, date, via, statusId: sentStatusId })}
          onDone={close}
        />
      ),
    );

  return (
    <SettingsSection title="Suivi">
      <Select
        label="Statut"
        {...itemSelectProps(scoped, document.trackingStatus?.id)}
        value={document.trackingStatus?.id ?? null}
        allowDeselect={false}
        readOnly={locked}
        onChange={(statusId) => {
          if (!statusId) return;
          // A "sent" status asks when and how it was sent.
          if (scoped.find((status) => status.id === statusId)?.category === 'SENT') {
            openDialog('sent', statusId);
          } else mutations.setStatus.mutate({ id: document.id, statusId }, ON_ERROR);
        }}
      />
      {document.overdue && <ErrorAlert p="xs">{isQuote ? 'Date de validité dépassée sans réponse.' : `Échéance dépassée : ${money(balance)} restent dus.`}</ErrorAlert>}
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {document.sentAt ? `${SENT_VIA_LABELS[document.sentVia as SendingChannel] ?? 'Envoyé'} le ${fmt.day(document.sentAt)}` : 'Pas encore envoyé.'}
        </Text>
        {!locked && (
          <ActionButton priority="tertiary" icon={document.sentAt ? <PencilSimpleIcon aria-hidden /> : <PaperPlaneTiltIcon aria-hidden />} onClick={() => openDialog('sent')}>
            {document.sentAt ? 'Modifier' : 'Marquer envoyé'}
          </ActionButton>
        )}
      </Group>

      {isQuote && (
        <Stack gap={6}>
          {document.acceptedAt && <Text size="sm">Accepté le {fmt.day(document.acceptedAt)}</Text>}
          {document.signedFileUrl && (
            <div>
              <FileBadge
                filename={document.signedFilename ?? 'Devis signé'}
                max={48}
                onClick={() => openFile({ url: document.signedFileUrl!, filename: document.signedFilename ?? 'Devis signé' })}
                onRemove={locked ? undefined : () => mutations.removeSigned.mutate(document.id, ON_ERROR)}
              />
            </div>
          )}
          {!locked && (
            <ActionButton priority="secondary" icon={<CheckIcon aria-hidden />} onClick={() => openDialog('accept')}>
              {document.acceptedAt ? (document.signedFileUrl ? 'Remplacer le devis signé' : 'Joindre le devis signé') : 'Enregistrer l’acceptation'}
            </ActionButton>
          )}
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
                {fmt.day(payment.entry.date)} · {payment.entry.accountLabel}
                {payment.entry.methodLabel ? ` · ${payment.entry.methodLabel}` : ''}
              </Text>
              <Text size="xs" ff="monospace">
                {money(payment.amount)}
              </Text>
            </Group>
          ))}
          {balance > 0 && !locked && (
            <ActionButton priority="secondary" icon={<CoinsIcon aria-hidden />} onClick={() => openDialog('payment')}>
              {isCredit ? 'Enregistrer un remboursement' : 'Enregistrer un paiement'}
            </ActionButton>
          )}
        </Stack>
      )}

      {!isQuote && !isCredit && (balance > 0 || document.reminders.length > 0) && (
        <SubSection
          title="Relances"
          gap={6}
          action={
            balance > 0 &&
            !locked && (
              <Group gap={4}>
                <ActionButton priority="secondary" size="compact-xs" icon={<BellRingingIcon aria-hidden />} loading={remindPending} onClick={onRemind}>
                  Relancer par mail
                </ActionButton>
                <ActionButton priority="tertiary" icon={<NotePencilIcon aria-hidden />} onClick={() => openDialog('reminder')}>
                  Noter
                </ActionButton>
              </Group>
            )
          }
        >
          {document.reminders.length === 0 ? (
            <EmptyState compact message="Aucune relance." />
          ) : (
            document.reminders.map((reminder) => (
              <Group key={reminder.id} justify="space-between" wrap="nowrap">
                <Text size="xs" truncate>
                  {fmt.day(reminder.date)}
                  {reminder.note ? ` · ${reminder.note}` : ''}
                </Text>
                {!locked && <RemoveButton label="Supprimer" aria-label="Supprimer la relance" size="sm" onClick={() => mutations.deleteReminder.mutate(reminder.id, ON_ERROR)} />}
              </Group>
            ))
          )}
        </SubSection>
      )}
    </SettingsSection>
  );
}
