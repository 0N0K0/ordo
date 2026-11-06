import { ActionIcon, Badge, Button, Divider, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { formatMoney, treasuryEntrySchema, type Recurrence, type TreasuryAllocationInput } from '@ordo/shared';
import { LinkIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useAccountingDocuments, useImportedDocuments } from '../accounting/documents-api';
import { useWorkspace } from '../workspace/api';
import { useTreasuryAccounts, useTreasuryEntrySearch, useTreasuryMutations, useTreasurySettings, type ForecastEntry, type TreasuryEntry } from './api';
import { categoryOptions } from './categories';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/** Entry linked to the edited one, as shown in the form. */
interface LinkedSummary {
  id: string;
  date: string;
  label: string;
  amount: number;
}

/**
 * Short description of a linked entry.
 * @param {LinkedSummary} entry Entry.
 * @returns {string} "12 mars 2026 · Libellé · -86,20 €".
 */
const describeLinked = (entry: LinkedSummary) => `${dateFormat.format(new Date(`${entry.date}T00:00:00Z`))} · ${entry.label} · ${formatMoney(Math.round(entry.amount * 100))}`;

interface EntryValues extends Record<string, unknown> {
  accountId: string;
  status: 'ACTUAL' | 'FORECAST';
  /** Execution date. */
  date: string;
  valueDate: string | null;
  label: string;
  /** Money in or out. */
  direction: 'IN' | 'OUT';
  /** Positive; signed by the direction when saved. */
  amount: number;
  categoryId: string | null;
  methodId: string | null;
  /** "client:<id>" or "tiers:<id>". */
  payer: string | null;
  projectId: string | null;
  note: string;
  recurrence: Recurrence | null;
  allocations: TreasuryAllocationInput[];
  linkedEntryIds: string[];
}

interface EntryFormProps {
  entry?: TreasuryEntry | ForecastEntry;
  /** New entry: actual or forecast. */
  status?: 'ACTUAL' | 'FORECAST';
  onDone: () => void;
}

/**
 * Treasury entry: account, execution and value dates, label, money in or out, payer or payee (client or
 * counterparty), category and method of its direction, project, note and linked entries; a forecast may repeat,
 * an actual entry settles invoices (money in) or refunds credit notes (money out), Ordo or imported.
 * @param {EntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EntryForm({ entry, status = 'ACTUAL', onDone }: EntryFormProps) {
  const { data: accounts } = useTreasuryAccounts();
  const { data: settings } = useTreasurySettings();
  const [search, setSearch] = useState('');
  const { data: found } = useTreasuryEntrySearch(search);
  const [linked, setLinked] = useState<LinkedSummary[]>(() => (entry?.linkedEntries ?? []).map((item) => ({ ...item, date: String(item.date) })));
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
      valueDate: entry?.valueDate ? String(entry.valueDate) : null,
      label: entry?.label ?? '',
      direction: (entry?.amount ?? 0) < 0 ? 'OUT' : 'IN',
      amount: Math.abs(entry?.amount ?? 0),
      categoryId: entry?.categoryId ?? null,
      methodId: entry?.methodId ?? null,
      payer: entry?.clientId ? `client:${entry.clientId}` : entry?.counterpartyId ? `tiers:${entry.counterpartyId}` : null,
      projectId: entry?.projectId ?? null,
      note: entry?.note ?? '',
      recurrence: (entry?.recurrence as Recurrence | null) ?? null,
      allocations: (entry?.allocations ?? []).map((allocation) => ({
        documentId: allocation.documentId ?? null,
        importedDocumentId: allocation.importedDocumentId ?? null,
        amount: allocation.amount,
      })),
      linkedEntryIds: (entry?.linkedEntries ?? []).map((item) => item.id),
    },
    schema: treasuryEntrySchema,
  });
  const values = form.values;
  const incoming = values.direction === 'IN';
  const forecast = values.status === 'FORECAST';
  const categories = settings?.treasuryCategories ?? [];
  const methods = (settings?.treasuryPaymentMethods ?? []).filter((method) => (incoming ? method.incoming : method.outgoing) || method.id === values.methodId);
  const payers = [
    {
      group: 'Clients',
      items: (workspace?.clients ?? []).filter((client) => !client.archived || `client:${client.id}` === values.payer).map((client) => ({ value: `client:${client.id}`, label: client.name })),
    },
    {
      group: 'Tiers',
      items: (settings?.treasuryCounterparties ?? [])
        .filter((counterparty) => !counterparty.archived || `tiers:${counterparty.id}` === values.payer)
        .map((counterparty) => ({ value: `tiers:${counterparty.id}`, label: counterparty.name })),
    },
  ].filter((group) => group.items.length);
  // Entries found to link: not this one, nor those already linked.
  const linkable = (found ?? [])
    .filter((item) => item.id !== entry?.id && !values.linkedEntryIds.includes(item.id))
    .map((item) => ({ value: item.id, label: `${describeLinked({ ...item, date: String(item.date) })} · ${item.accountName}` }));

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
    const { direction, payer, ...fields } = input;
    const payload = {
      ...fields,
      clientId: payer?.startsWith('client:') ? payer.slice(7) : null,
      counterpartyId: payer?.startsWith('tiers:') ? payer.slice(6) : null,
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
          <DatePickerInput label={forecast ? 'Date d’exécution prévue' : 'Date d’exécution'} required valueFormat="D MMM YYYY" {...form.getInputProps('date')} />
        </SimpleGrid>
        <DatePickerInput
          label="Date de valeur"
          description="Celle du relevé bancaire, pour information : le solde suit la date d’exécution."
          clearable
          placeholder="—"
          valueFormat="D MMM YYYY"
          {...form.getInputProps('valueDate')}
        />
        <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
        <Group gap="sm" align="flex-end" wrap="nowrap">
          <SegmentedControl
            aria-label="Sens"
            data={[
              { value: 'IN', label: 'Entrée' },
              { value: 'OUT', label: 'Sortie' },
            ]}
            value={values.direction}
            // Changing the direction changes which documents can be settled, and the categories and methods.
            onChange={(direction) => {
              const method = settings?.treasuryPaymentMethods.find((item) => item.id === values.methodId);
              form.setValues({
                direction: direction as EntryValues['direction'],
                allocations: [],
                categoryId: null,
                methodId: method && (direction === 'IN' ? method.incoming : method.outgoing) ? method.id : null,
              });
            }}
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
          <Select
            label="Catégorie"
            clearable
            searchable
            placeholder={categories.some((category) => category.direction === values.direction) ? '—' : 'Aucune : ajoutez-en dans les paramètres'}
            data={categoryOptions(categories, values.direction)}
            {...form.getInputProps('categoryId')}
          />
          <Select
            label="Moyen de paiement"
            clearable
            placeholder={methods.length ? '—' : 'Aucun : ajoutez-en dans les paramètres'}
            data={methods.map((method) => ({ value: method.id, label: method.name }))}
            {...form.getInputProps('methodId')}
          />
        </SimpleGrid>
        <Select
          label={incoming ? 'Émetteur' : 'Destinataire'}
          clearable
          searchable
          placeholder="Client ou tiers"
          nothingFoundMessage="Aucun client ni tiers"
          data={payers}
          {...form.getInputProps('payer')}
        />
        <Select
          label="Projet"
          clearable
          searchable
          data={(workspace?.projects ?? []).filter((project) => !project.archived || project.id === values.projectId).map((project) => ({ value: project.id, label: project.title }))}
          {...form.getInputProps('projectId')}
        />
        <Textarea label="Note" autosize minRows={1} {...form.getInputProps('note')} />

        <Divider label="Mouvements liés" labelPosition="left" />
        <Text size="xs" c="dimmed">
          Une entrée et une sortie liées sur une même période se compensent dans les graphiques d’entrées et de sorties (remboursement de frais, virement entre comptes…).
        </Text>
        {linked.length > 0 && (
          <Group gap={6}>
            {linked.map((item) => (
              <Badge
                key={item.id}
                variant="light"
                color={item.amount < 0 ? 'red' : 'green'}
                leftSection={<LinkIcon aria-hidden />}
                rightSection={
                  <ActionIcon
                    size="xs"
                    variant="transparent"
                    color="gray"
                    aria-label={`Délier ${item.label}`}
                    onClick={() => {
                      setLinked((current) => current.filter((other) => other.id !== item.id));
                      form.setFieldValue(
                        'linkedEntryIds',
                        values.linkedEntryIds.filter((id) => id !== item.id),
                      );
                    }}
                  >
                    <XIcon aria-hidden />
                  </ActionIcon>
                }
                tt="none"
              >
                {describeLinked(item)}
              </Badge>
            ))}
          </Group>
        )}
        <Select
          aria-label="Lier un mouvement"
          placeholder="Rechercher un mouvement par son libellé…"
          searchable
          clearable={false}
          leftSection={<LinkIcon aria-hidden />}
          searchValue={search}
          onSearchChange={setSearch}
          // Filtered by the server.
          filter={({ options }) => options}
          nothingFoundMessage={search.trim().length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun mouvement'}
          data={linkable}
          value={null}
          onChange={(id) => {
            const item = found?.find((other) => other.id === id);
            if (!item) return;
            setLinked((current) => [...current, { id: item.id, date: String(item.date), label: item.label, amount: item.amount }]);
            form.setFieldValue('linkedEntryIds', [...values.linkedEntryIds, item.id]);
            setSearch('');
          }}
          error={form.errors.linkedEntryIds}
        />

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
