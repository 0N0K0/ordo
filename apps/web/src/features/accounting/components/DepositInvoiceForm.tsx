import { NumberInput, Paper, Select, Stack, Text } from '@mantine/core';
import { ClientSelect } from '../../projects/components/ClientSelect';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { parisToday } from '../../../lib/dates';
import { useAsyncAction } from '../../../lib/use-async-action';

import { useAccountingDocuments, useDocumentMutations, useImportedDocuments } from '../api/documents';
import * as fmt from '../../../lib/format';
import { FormActions } from '../../../components/dialogs/FormActions';
import { documentPath } from '../../../app/pages';
import { unarchived } from '../../../lib/archive';
import { optionalNumber } from '../../../components/inputs/number-format';
import { taggedKey, parseTaggedKey } from '../../../lib/tagged-key';

/** Quote a deposit can be made from, of Ordo or imported. */
interface QuoteChoice {
  /** "ordo:<id>" or "imported:<id>". */
  value: string;
  label: string;
  clientId: string | null;
  number: string;
  issueDate: string;
  /** Total excluding VAT, in currency units. */
  totalNet: number;
  currency: string;
  /** Deposit agreed on the quote, in percent. */
  percent: number | null;
}

interface DepositInvoiceFormProps {
  /** Quote preselected: of Ordo, or imported. */
  quoteId?: string;
  importedQuoteId?: string;
  /** Client whose quotes are offered. */
  clientId?: string | null;
  onDone: () => void;
}

/**
 * New deposit invoice: from a final quote of Ordo or an imported one, a percentage of its total excluding VAT
 * (the deposit agreed on the quote, or 30 %), shown as the line it will create. The draft then opens.
 * @param {DepositInvoiceFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function DepositInvoiceForm({ quoteId, importedQuoteId, clientId: initialClient = null, onDone }: DepositInvoiceFormProps) {
  const documents = useAccountingDocuments();
  const imported = useImportedDocuments();
  const { createDeposit } = useDocumentMutations();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(initialClient);
  const [choice, setChoice] = useState<string | null>(quoteId ? taggedKey('ordo', quoteId) : importedQuoteId ? taggedKey('imported', importedQuoteId) : null);
  const [percent, setPercent] = useState<number | null>(null);

  // An archived quote is read only: no deposit invoiced from it.
  const quotes: QuoteChoice[] = [
    ...unarchived(documents.data ?? [])
      .filter((document) => document.type === 'QUOTE' && document.status === 'FINAL')
      .map((document) => ({
        value: taggedKey('ordo', document.id),
        label: `${document.number} — ${document.clientName}${document.label ? ` — ${document.label}` : ''}`,
        clientId: document.clientId,
        number: document.number ?? '',
        issueDate: document.issueDate,
        totalNet: document.totalNet,
        currency: document.currency,
        percent: document.depositType === 'PERCENT' ? (document.depositValue ?? null) : null,
      })),
    ...unarchived(imported.data ?? [])
      .filter((document) => document.type === 'QUOTE' && document.clientId)
      .map((document) => ({
        value: taggedKey('imported', document.id),
        label: `${document.number} (importé) — ${document.clientName}${document.label ? ` — ${document.label}` : ''}`,
        clientId: document.clientId,
        number: document.number,
        issueDate: document.issueDate,
        totalNet: document.totalNet,
        currency: document.currency,
        percent: null,
      })),
  ];
  const selected = quotes.find((quote) => quote.value === choice) ?? null;
  const offered = quotes.filter((quote) => !clientId || quote.clientId === clientId || quote.value === choice);
  const rate = percent ?? selected?.percent ?? 30;
  const amount = selected ? Math.round(selected.totalNet * rate) : 0;

  const { run: submit, loading } = useAsyncAction(
    async () => {
      if (!selected) throw new Error('Choisissez un devis.');
      const { tag: kind, id } = parseTaggedKey(selected.value) ?? { tag: '', id: '' };
      return createDeposit.mutateAsync({ quoteId: kind === 'ordo' ? id : null, importedQuoteId: kind === 'imported' ? id : null, percent: rate, issueDate: parisToday() });
    },
    {
      fallback: 'Création impossible.',
      onDone: (created) => {
        onDone();
        void navigate(documentPath(created));
      },
    },
  );

  return (
    <Stack gap="md">
      {!quoteId && !importedQuoteId && (
        <ClientSelect
          clearable
          placeholder="Tous"
          value={clientId}
          onChange={(value) => {
            setClientId(value);
            if (value && selected && selected.clientId !== value) setChoice(null);
          }}
          nothingFoundMessage="Aucun client"
        />
      )}
      <Select
        label="Devis"
        required
        searchable
        data-autofocus
        disabled={Boolean(quoteId || importedQuoteId)}
        data={offered.map((quote) => ({ value: quote.value, label: quote.label }))}
        value={choice}
        onChange={(value) => {
          setChoice(value);
          setPercent(null);
        }}
        placeholder={documents.isPending || imported.isPending ? 'Chargement…' : 'Choisissez un devis validé ou importé'}
        nothingFoundMessage="Aucun devis"
      />
      <NumberInput
        label="Montant de l’acompte"
        description="En pourcentage du total HT du devis."
        required
        suffix=" %"
        min={0.01}
        max={100}
        decimalScale={2}
        value={rate}
        onChange={(value) => setPercent(optionalNumber(value))}
      />
      {selected && (
        <Paper withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">
            Article de la facture
          </Text>
          <Text size="sm">
            Acompte de {fmt.percent(rate)} pour le devis {selected.number} de {fmt.money(selected.totalNet, selected.currency)} HT du {fmt.day(selected.issueDate)}
          </Text>
          <Text size="sm" fw={600}>
            {fmt.moneyCents(amount, selected.currency)} HT
          </Text>
        </Paper>
      )}
      <Text size="xs" c="dimmed">
        La facture d’acompte est créée en brouillon, sans numéro, avec les conditions du devis.
      </Text>
      <FormActions onCancel={onDone} submitLabel="Créer" onSubmit={() => void submit()} disabled={!selected || !(rate > 0 && rate <= 100)} loading={loading} />
    </Stack>
  );
}
