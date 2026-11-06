import { Button, Group, NumberInput, Paper, Select, Stack, Text } from '@mantine/core';
import { formatMoney } from '@ordo/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { localToday } from '../../lib/dates';
import { notifyError } from '../../lib/notify';
import { useWorkspace } from '../workspace/api';
import { useAccountingDocuments, useDocumentMutations, useImportedDocuments } from './documents-api';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

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
  const { data: workspace } = useWorkspace();
  const documents = useAccountingDocuments();
  const imported = useImportedDocuments();
  const { createDeposit } = useDocumentMutations();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(initialClient);
  const [choice, setChoice] = useState<string | null>(quoteId ? `ordo:${quoteId}` : importedQuoteId ? `imported:${importedQuoteId}` : null);
  const [percent, setPercent] = useState<number | null>(null);

  const quotes: QuoteChoice[] = [
    ...(documents.data ?? [])
      .filter((document) => document.type === 'QUOTE' && document.status === 'FINAL')
      .map((document) => ({
        value: `ordo:${document.id}`,
        label: `${document.number} — ${document.clientName}${document.title ? ` — ${document.title}` : ''}`,
        clientId: document.clientId,
        number: document.number ?? '',
        issueDate: document.issueDate,
        totalNet: document.totalNet,
        currency: document.currency,
        percent: document.depositType === 'PERCENT' ? (document.depositValue ?? null) : null,
      })),
    ...(imported.data ?? [])
      .filter((document) => document.type === 'QUOTE' && document.clientId)
      .map((document) => ({
        value: `imported:${document.id}`,
        label: `${document.number} (importé) — ${document.clientName}${document.title ? ` — ${document.title}` : ''}`,
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

  /**
   * Creates the draft and opens it.
   * @returns {Promise<void>}
   */
  const submit = async () => {
    if (!selected) return;
    const [kind, id] = selected.value.split(':');
    try {
      const created = await createDeposit.mutateAsync({ quoteId: kind === 'ordo' ? id : null, importedQuoteId: kind === 'imported' ? id : null, percent: rate, issueDate: localToday() });
      onDone();
      void navigate(`/accounting/${created}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Création impossible.');
    }
  };

  return (
    <Stack gap="md">
      {!quoteId && !importedQuoteId && (
        <Select
          label="Client"
          clearable
          searchable
          placeholder="Tous"
          data={(workspace?.clients ?? []).filter((client) => !client.archived).map((client) => ({ value: client.id, label: client.name }))}
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
        onChange={(value) => setPercent(typeof value === 'number' ? value : null)}
      />
      {selected && (
        <Paper withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">
            Article de la facture
          </Text>
          <Text size="sm">
            Acompte de {rate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % pour le devis {selected.number} de {formatMoney(Math.round(selected.totalNet * 100), selected.currency)} HT du{' '}
            {dateFormat.format(new Date(`${selected.issueDate}T00:00:00Z`))}
          </Text>
          <Text size="sm" fw={600}>
            {formatMoney(amount, selected.currency)} HT
          </Text>
        </Paper>
      )}
      <Text size="xs" c="dimmed">
        La facture d’acompte est créée en brouillon, sans numéro, avec les conditions du devis.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button onClick={() => void submit()} disabled={!selected || !(rate > 0 && rate <= 100)} loading={createDeposit.isPending}>
          Créer
        </Button>
      </Group>
    </Stack>
  );
}
