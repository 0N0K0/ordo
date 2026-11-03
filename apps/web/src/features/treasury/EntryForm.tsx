import { ActionIcon, Autocomplete, Button, Divider, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { formatMoney, treasuryEntrySchema, type Recurrence, type TreasuryAllocationInput } from '@ordo/shared';
import { PlusIcon, XIcon } from '@phosphor-icons/react';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useAccountingDocuments, useImportedDocuments } from '../accounting/documents-api';
import { useWorkspace } from '../workspace/api';
import { useTreasuryAccounts, useTreasuryMutations, type ForecastEntry, type TreasuryEntry } from './api';

/** Usual categories, completed by the ones already used. */
const DEFAULT_CATEGORIES = ['Ventes', 'Remboursements clients', 'Loyer', 'Charges sociales', 'Impôts et taxes', 'TVA', 'Salaires', 'Logiciels', 'Matériel', 'Frais bancaires', 'Déplacements', 'Divers'];

interface EntryValues extends Record<string, unknown> {
  accountId: string;
  status: 'ACTUAL' | 'FORECAST';
  date: string;
  label: string;
  /** Money in or out. */
  direction: 'IN' | 'OUT';
  /** Positive; signed by the direction when saved. */
  amount: number;
  category: string;
  method: string;
  projectId: string | null;
  note: string;
  recurrence: Recurrence | null;
  allocations: TreasuryAllocationInput[];
}

interface EntryFormProps {
  entry?: TreasuryEntry | ForecastEntry;
  /** New entry: actual or forecast. */
  status?: 'ACTUAL' | 'FORECAST';
  /** Categories already used. */
  categories: string[];
  onDone: () => void;
}

/**
 * Treasury entry: account, date, label, money in or out, category, method, project and note; a forecast may
 * repeat, an actual entry settles invoices (money in) or refunds credit notes (money out), Ordo or imported.
 * @param {EntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EntryForm({ entry, status = 'ACTUAL', categories, onDone }: EntryFormProps) {
  const { data: accounts } = useTreasuryAccounts();
  const { data: workspace } = useWorkspace();
  const { data: documents } = useAccountingDocuments();
  const { data: imported } = useImportedDocuments();
  const { createEntry, updateEntry } = useTreasuryMutations();
  const open = (accounts ?? []).filter((account) => !account.archived || account.id === entry?.accountId);
  const form = useAppForm<EntryValues>({
    initialValues: {
      accountId: entry?.accountId ?? open[0]?.id ?? '',
      status: entry?.status ?? status,
      date: entry ? String(entry.date) : localToday(),
      label: entry?.label ?? '',
      direction: (entry?.amount ?? 0) < 0 ? 'OUT' : 'IN',
      amount: Math.abs(entry?.amount ?? 0),
      category: entry?.category ?? '',
      method: entry?.method ?? '',
      projectId: entry?.projectId ?? null,
      note: entry?.note ?? '',
      recurrence: (entry?.recurrence as Recurrence | null) ?? null,
      allocations: (entry?.allocations ?? []).map((allocation) => ({
        documentId: allocation.documentId ?? null,
        importedDocumentId: allocation.importedDocumentId ?? null,
        amount: allocation.amount,
      })),
    },
    schema: treasuryEntrySchema,
  });
  const values = form.values;
  const incoming = values.direction === 'IN';
  const forecast = values.status === 'FORECAST';

  // Documents it can settle: still due, or already settled by this entry.
  const own = new Set((entry?.allocations ?? []).map((allocation) => allocation.documentId ?? allocation.importedDocumentId));
  const settleable = [
    ...(documents ?? [])
      .filter((document) => document.status === 'FINAL' && document.type !== 'QUOTE' && (document.type === 'CREDIT_NOTE') !== incoming)
      .filter((document) => (document.balance ?? 0) > 0 || own.has(document.id))
      .map((document) => ({
        value: `doc:${document.id}`,
        label: `${document.number} — ${document.clientName} (reste ${formatMoney(Math.round((document.balance ?? 0) * 100), document.currency)})`,
        balance: document.balance ?? 0,
      })),
    ...(imported ?? [])
      .filter((document) => document.type !== 'QUOTE' && (document.type === 'CREDIT_NOTE') !== incoming)
      .filter((document) => (document.balance ?? 0) > 0 || own.has(document.id))
      .map((document) => ({
        value: `imp:${document.id}`,
        label: `${document.number} (importé) — ${document.clientName} (reste ${formatMoney(Math.round((document.balance ?? 0) * 100), document.currency)})`,
        balance: document.balance ?? 0,
      })),
  ];
  const allocated = values.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const keyOf = (allocation: TreasuryAllocationInput) => (allocation.documentId ? `doc:${allocation.documentId}` : allocation.importedDocumentId ? `imp:${allocation.importedDocumentId}` : null);

  const handleSubmit = form.onSubmit((input) => {
    const { direction, ...fields } = input;
    const payload = {
      ...fields,
      amount: direction === 'IN' ? input.amount : -input.amount,
      recurrence: input.status === 'FORECAST' ? input.recurrence : null,
      allocations: input.status === 'ACTUAL' ? input.allocations : [],
    };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(entry ? 'Mouvement modifié.' : 'Mouvement ajouté.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (entry) updateEntry.mutate({ id: entry.id, input: payload }, callbacks);
    else createEntry.mutate(payload, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="sm">
        <SegmentedControl
          data={[
            { value: 'ACTUAL', label: 'Réel' },
            { value: 'FORECAST', label: 'Prévu' },
          ]}
          value={values.status}
          // Only a forecast repeats, only an actual entry settles documents.
          onChange={(value) => form.setValues({ status: value as EntryValues['status'], recurrence: null, allocations: [] })}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select label="Compte" required data={open.map((account) => ({ value: account.id, label: account.name }))} allowDeselect={false} {...form.getInputProps('accountId')} />
          <DatePickerInput label={forecast ? 'Date prévue' : 'Date'} required valueFormat="D MMM YYYY" {...form.getInputProps('date')} />
        </SimpleGrid>
        <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
        <Group gap="sm" align="flex-end" wrap="nowrap">
          <SegmentedControl
            aria-label="Sens"
            data={[
              { value: 'IN', label: 'Entrée' },
              { value: 'OUT', label: 'Sortie' },
            ]}
            value={values.direction}
            // Changing the direction changes which documents can be settled.
            onChange={(direction) => form.setValues({ direction: direction as EntryValues['direction'], allocations: [] })}
          />
          <NumberInput
            label="Montant"
            required
            min={0}
            decimalScale={2}
            decimalSeparator=","
            thousandSeparator=" "
            suffix=" €"
            style={{ flex: 1 }}
            {...form.getInputProps('amount')}
          />
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Autocomplete label="Catégorie" data={[...new Set([...categories, ...DEFAULT_CATEGORIES])].sort((a, b) => a.localeCompare(b, 'fr'))} {...form.getInputProps('category')} />
          <TextInput label="Moyen de paiement" placeholder="Virement, carte…" {...form.getInputProps('method')} />
        </SimpleGrid>
        <Select
          label="Projet"
          clearable
          searchable
          data={(workspace?.projects ?? []).filter((project) => !project.archived || project.id === values.projectId).map((project) => ({ value: project.id, label: project.title }))}
          {...form.getInputProps('projectId')}
        />
        <Textarea label="Note" autosize minRows={1} {...form.getInputProps('note')} />

        {forecast && (
          <>
            <Divider label="Répétition" labelPosition="left" />
            <RecurrenceEditor value={values.recurrence} onChange={(rule) => form.setFieldValue('recurrence', rule)} start={values.date} withinPortal={false} />
          </>
        )}

        {!forecast && (
          <>
            <Divider label={incoming ? 'Factures réglées' : 'Avoirs remboursés'} labelPosition="left" />
            {values.allocations.map((allocation, index) => (
              <Group key={index} gap="xs" align="flex-end" wrap="nowrap">
                <Select
                  aria-label={`Document ${index + 1}`}
                  placeholder="Document"
                  searchable
                  style={{ flex: 1 }}
                  data={settleable.filter((option) => option.value === keyOf(allocation) || !values.allocations.some((other) => keyOf(other) === option.value))}
                  value={keyOf(allocation)}
                  onChange={(key) => {
                    const option = settleable.find((item) => item.value === key);
                    const amount = option ? Math.min(option.balance, Math.max(0, values.amount - allocated + allocation.amount)) || option.balance : allocation.amount;
                    form.setFieldValue(`allocations.${index}`, {
                      documentId: key?.startsWith('doc:') ? key.slice(4) : null,
                      importedDocumentId: key?.startsWith('imp:') ? key.slice(4) : null,
                      amount,
                    });
                    // An empty entry takes the amount and the name of the document it settles.
                    if (option && !values.amount) form.setFieldValue('amount', allocated - allocation.amount + amount);
                    if (option && !values.label.trim()) form.setFieldValue('label', `${incoming ? 'Règlement' : 'Remboursement'} ${option.label.replace(/ \(reste .*\)$/, '')}`);
                  }}
                />
                <NumberInput
                  aria-label={`Montant réglé ${index + 1}`}
                  w={130}
                  min={0}
                  decimalScale={2}
                  decimalSeparator=","
                  suffix=" €"
                  value={allocation.amount}
                  onChange={(value) => form.setFieldValue(`allocations.${index}.amount`, typeof value === 'number' ? value : 0)}
                />
                <Tooltip label="Retirer">
                  <ActionIcon variant="subtle" color="gray" size="lg" aria-label={`Retirer le document ${index + 1}`} onClick={() => form.removeListItem('allocations', index)}>
                    <XIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
            {form.errors.allocations && (
              <Text size="xs" c="red">
                {form.errors.allocations}
              </Text>
            )}
            <Group justify="space-between">
              <Button
                size="xs"
                variant="light"
                leftSection={<PlusIcon aria-hidden />}
                disabled={settleable.length === values.allocations.length}
                onClick={() => form.insertListItem('allocations', { documentId: null, importedDocumentId: null, amount: 0 })}
              >
                {incoming ? 'Régler une facture' : 'Rembourser un avoir'}
              </Button>
              {values.allocations.length > 0 && (
                <Text size="xs" c="dimmed">
                  {formatMoney(Math.round(allocated * 100))} affectés sur {formatMoney(Math.round(values.amount * 100))}
                </Text>
              )}
            </Group>
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createEntry.isPending || updateEntry.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
