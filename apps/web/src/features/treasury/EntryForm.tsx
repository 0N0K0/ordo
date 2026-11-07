import { ActionIcon, Badge, Button, Divider, Group, Modal, MultiSelect, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { formatMoney, treasuryEntrySchema, type Recurrence, type TreasuryAllocationInput } from '@ordo/shared';
import { LinkIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useAccountingDocuments, useImportedDocuments } from '../accounting/documents-api';
import { useWorkspace } from '../workspace/api';
import { useTreasuryAccounts, useTreasuryDocumentOptions, useTreasuryEntrySearch, useTreasuryMutations, useTreasurySettings, type ForecastEntry, type TreasuryEntry } from './api';
import { categoryOptions } from './categories';
import { LinesEditor } from './LinesEditor';
import { describeLink, newLine, type LineValues } from './lines';
import { CategoryForm, CounterpartyForm, MethodForm } from './SettingsPanel';
import { ContextForm } from './TeamPanel';
import { useActiveWorkspace } from '../workspaces/api';

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

/**
 * A select with a button creating a new option next to it.
 * @param {{ label: string, onCreate: () => void, children: ReactNode }} props Component props: what the button creates, the action, the select.
 * @returns {JSX.Element} Field.
 */
function WithCreate({ label, onCreate, children }: { label: string; onCreate: () => void; children: ReactNode }) {
  return (
    <Group gap={4} align="flex-end" wrap="nowrap">
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <Tooltip label={label}>
        <ActionIcon variant="default" size="input-sm" aria-label={label} onClick={onCreate}>
          <PlusIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

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
  /** Payer or payee: a client or a counterparty (fields of the schema, so that they are validated). */
  clientId: string | null;
  counterpartyId: string | null;
  projectId: string | null;
  note: string;
  recurrence: Recurrence | null;
  allocations: TreasuryAllocationInput[];
  linkedEntryIds: string[];
  libraryDocumentIds: string[];
  projectResourceIds: string[];
  /** Split of the amount: values relative to the direction (signed when saved). */
  lines: LineValues[];
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
  // Category, method or counterparty created from the form.
  const [creating, setCreating] = useState<'category' | 'method' | 'counterparty' | 'context' | null>(null);
  // Line a context is created for.
  const [contextLine, setContextLine] = useState<number | null>(null);
  const { data: found } = useTreasuryEntrySearch(search);
  const { data: documentOptions } = useTreasuryDocumentOptions();
  const [linked, setLinked] = useState<LinkedSummary[]>(() => (entry?.linkedEntries ?? []).map((item) => ({ ...item, date: String(item.date) })));
  const { data: workspace } = useWorkspace();
  // No invoicing in a personal workspace: no documents to settle.
  const { perso } = useActiveWorkspace();
  const { data: documents } = useAccountingDocuments();
  const { data: imported } = useImportedDocuments();
  const { createEntry, updateEntry } = useTreasuryMutations();
  const open = (accounts ?? []).filter((account) => !account.archived || account.id === entry?.accountId);
  const form = useAppForm<EntryValues>({
    initialValues: {
      accountId: entry?.accountId ?? open[0]?.id ?? '',
      status: entry?.status ?? status,
      date: entry ? String(entry.date) : localToday(),
      valueDate: entry ? String(entry.valueDate) : localToday(),
      label: entry?.label ?? '',
      direction: (entry?.amount ?? 0) < 0 ? 'OUT' : 'IN',
      amount: Math.abs(entry?.amount ?? 0),
      categoryId: entry?.categoryId ?? null,
      methodId: entry?.methodId ?? null,
      clientId: entry?.clientId ?? null,
      counterpartyId: entry?.counterpartyId ?? null,
      projectId: entry?.projectId ?? null,
      note: entry?.note ?? '',
      recurrence: (entry?.recurrence as Recurrence | null) ?? null,
      allocations: (entry?.allocations ?? []).map((allocation) => ({
        documentId: allocation.documentId ?? null,
        importedDocumentId: allocation.importedDocumentId ?? null,
        amount: allocation.amount,
      })),
      linkedEntryIds: (entry?.linkedEntries ?? []).map((item) => item.id),
      libraryDocumentIds: (entry?.documents ?? []).filter((document) => document.source === 'LIBRARY').map((document) => document.id),
      projectResourceIds: (entry?.documents ?? []).filter((document) => document.source === 'PROJECT').map((document) => document.id),
      // A stored amount is signed; edited, it is relative to the direction of the entry.
      lines: (entry?.lines ?? []).map((line) =>
        newLine({
          id: line.id,
          label: line.label ?? null,
          mode: line.mode,
          value: line.mode === 'AMOUNT' && (entry?.amount ?? 0) < 0 ? -line.value : line.value,
          memberId: line.memberId ?? null,
          categoryId: line.categoryId ?? null,
          contextId: line.contextId ?? null,
          projectId: line.projectId ?? null,
          libraryDocumentIds: line.documents.filter((document) => document.source === 'LIBRARY').map((document) => document.id),
          projectResourceIds: line.documents.filter((document) => document.source === 'PROJECT').map((document) => document.id),
          linkedLineIds: line.linkedLines.map((linked) => linked.id),
          linkedEntryIds: line.linkedEntries.map((linked) => linked.id),
          links: [
            ...line.linkedLines.map((linked) => ({
              kind: 'line' as const,
              id: linked.id,
              entryLabel: linked.entryLabel,
              date: String(linked.date),
              label: linked.label ?? null,
              amount: linked.amount,
            })),
            ...line.linkedEntries.map((linked) => ({ kind: 'entry' as const, id: linked.id, entryLabel: linked.label, date: String(linked.date), label: null, amount: linked.amount })),
          ],
        }),
      ),
    },
    schema: treasuryEntrySchema,
  });
  const values = form.values;
  // Split: the category, project, documents and links are on the lines.
  const split = values.lines.length > 0;
  const incoming = values.direction === 'IN';
  const forecast = values.status === 'FORECAST';
  // Key of the payer select: "client:<id>" or "tiers:<id>".
  const payer = values.clientId ? `client:${values.clientId}` : values.counterpartyId ? `tiers:${values.counterpartyId}` : null;
  const categories = settings?.treasuryCategories ?? [];
  const methods = (settings?.treasuryPaymentMethods ?? []).filter((method) => (incoming ? method.incoming : method.outgoing) || method.id === values.methodId);
  const payers = [
    {
      group: 'Clients',
      items: (workspace?.clients ?? []).filter((client) => !client.archived || `client:${client.id}` === payer).map((client) => ({ value: `client:${client.id}`, label: client.name })),
    },
    {
      group: 'Tiers',
      items: (settings?.treasuryCounterparties ?? [])
        .filter((counterparty) => !counterparty.archived || `tiers:${counterparty.id}` === payer)
        .map((counterparty) => ({ value: `tiers:${counterparty.id}`, label: counterparty.name })),
    },
  ].filter((group) => group.items.length);
  // Supporting documents, grouped by place: the library, then each project (the entry's project first).
  const documentGroups = new Map<string, { value: string; label: string }[]>();
  const documentKey = (document: { source: string; id: string }) => `${document.source === 'LIBRARY' ? 'lib' : 'res'}:${document.id}`;
  for (const document of [...(documentOptions ?? []), ...(entry?.documents ?? []), ...(entry?.lines ?? []).flatMap((line) => line.documents)].sort(
    (a, b) => Number(b.source === 'LIBRARY') - Number(a.source === 'LIBRARY') || Number(b.projectId === values.projectId) - Number(a.projectId === values.projectId),
  )) {
    const group = document.source === 'LIBRARY' ? `Bibliothèque` : `Projet ${document.place}`;
    const items = documentGroups.get(group) ?? [];
    if (!items.some((item) => item.value === documentKey(document))) {
      items.push({ value: documentKey(document), label: document.source === 'LIBRARY' && document.place !== 'Documents' ? `${document.title} (${document.place})` : document.title });
    }
    documentGroups.set(group, items);
  }
  const selectedDocuments = [...values.libraryDocumentIds.map((id) => `lib:${id}`), ...values.projectResourceIds.map((id) => `res:${id}`)];
  const documentData = [...documentGroups].map(([group, items]) => ({ group, items }));
  // Projects of the entry or of its lines, archived ones only when chosen already.
  const chosenProjects = new Set([values.projectId, ...values.lines.map((line) => line.projectId)]);
  const projectOptions = (workspace?.projects ?? []).filter((project) => !project.archived || chosenProjects.has(project.id)).map((project) => ({ value: project.id, label: project.title }));
  // Entries found to link: not this one, nor those already linked, nor split ones (linked through their lines).
  const linkable = (found ?? [])
    .filter((item) => item.id !== entry?.id && !values.linkedEntryIds.includes(item.id) && item.lines.length === 0)
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
    const { direction, ...fields } = input;
    const payload = {
      ...fields,
      amount: direction === 'IN' ? input.amount : -input.amount,
      recurrence: input.status === 'FORECAST' ? input.recurrence : null,
      allocations: input.status === 'ACTUAL' ? input.allocations : [],
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      lines: input.lines.map(({ links: _links, ...line }) => ({ ...line, value: line.mode === 'AMOUNT' && direction === 'OUT' ? -line.value : line.value })),
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
          <DatePickerInput
            label={forecast ? 'Date d’exécution prévue' : 'Date d’exécution'}
            required
            valueFormat="D MMM YYYY"
            {...form.getInputProps('date')}
            // The value date follows the execution date until it is changed apart (or when it is empty).
            onChange={(date) => form.setValues({ date: date ?? '', ...(!values.valueDate || values.valueDate === values.date ? { valueDate: date } : {}) })}
          />
        </SimpleGrid>
        <DatePickerInput
          label="Date de valeur"
          description="Celle du relevé bancaire, pour information : le solde suit la date d’exécution. Vide, c’est la date d’exécution."
          clearable
          placeholder={values.date ? 'Date d’exécution' : '—'}
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
                lines: values.lines.map((line) => ({ ...line, categoryId: null })),
                methodId: method && (direction === 'IN' ? method.incoming : method.outgoing) ? method.id : null,
              });
            }}
          />
          <NumberInput label="Montant" required min={0} decimalScale={2} decimalSeparator="," thousandSeparator=" " suffix=" €" style={{ flex: 1 }} {...form.getInputProps('amount')} />
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {!split && (
            <WithCreate label="Nouvelle catégorie" onCreate={() => setCreating('category')}>
              <Select
                label="Catégorie"
                clearable
                searchable
                placeholder={categories.some((category) => category.direction === values.direction) ? '—' : 'Aucune : créez-en une avec +'}
                data={categoryOptions(categories, values.direction)}
                {...form.getInputProps('categoryId')}
              />
            </WithCreate>
          )}
          <WithCreate label="Nouveau moyen de paiement" onCreate={() => setCreating('method')}>
            <Select
              label="Moyen de paiement"
              clearable
              placeholder={methods.length ? '—' : 'Aucun : créez-en un avec +'}
              data={methods.map((method) => ({ value: method.id, label: method.name }))}
              {...form.getInputProps('methodId')}
            />
          </WithCreate>
        </SimpleGrid>
        <WithCreate label="Nouveau tiers" onCreate={() => setCreating('counterparty')}>
          <Select
            label={incoming ? 'Émetteur' : 'Destinataire'}
            clearable
            searchable
            placeholder="Client ou tiers"
            nothingFoundMessage="Aucun client ni tiers"
            data={payers}
            value={payer}
            onChange={(key) =>
              form.setValues({
                clientId: key?.startsWith('client:') ? key.slice(7) : null,
                counterpartyId: key?.startsWith('tiers:') ? key.slice(6) : null,
              })
            }
            error={form.errors.clientId ?? form.errors.counterpartyId}
          />
        </WithCreate>
        {!split && <Select label="Projet" clearable searchable data={projectOptions} {...form.getInputProps('projectId')} />}
        <Textarea label="Note" autosize minRows={1} {...form.getInputProps('note')} />

        <Divider label="Répartition" labelPosition="left" />
        <LinesEditor
          lines={values.lines}
          onChange={(lines) => {
            if (split || !lines.length) {
              form.setFieldValue('lines', lines);
              return;
            }
            // Split now: the category and project of the entry go to its lines, its documents and links to the first.
            const seeded = lines.map((line, index) => ({
              ...line,
              categoryId: line.categoryId ?? values.categoryId,
              projectId: line.projectId ?? values.projectId,
              ...(index === 0
                ? {
                    libraryDocumentIds: values.libraryDocumentIds,
                    projectResourceIds: values.projectResourceIds,
                    linkedEntryIds: values.linkedEntryIds,
                    links: linked.map((item) => ({ kind: 'entry' as const, id: item.id, entryLabel: item.label, date: item.date, label: null, amount: item.amount })),
                  }
                : {}),
            }));
            form.setValues({ lines: seeded, categoryId: null, projectId: null, libraryDocumentIds: [], projectResourceIds: [], linkedEntryIds: [] });
            setLinked([]);
          }}
          amount={values.amount}
          direction={values.direction}
          date={values.date}
          settings={settings}
          errors={form.errors}
          entryId={entry?.id ?? null}
          projects={projectOptions}
          documentGroups={documentData}
          onCreateContext={(index) => {
            setContextLine(index);
            setCreating('context');
          }}
        />

        {split ? (
          <Text size="xs" c="dimmed">
            Décomposé : catégorie, projet, pièces justificatives et liens se précisent sur chaque ligne.
          </Text>
        ) : (
          <>
            <MultiSelect
              label="Pièces justificatives"
              description="Documents de la bibliothèque ou des projets."
              placeholder={selectedDocuments.length ? undefined : 'Rechercher un document…'}
              searchable
              clearable
              nothingFoundMessage="Aucun document"
              data={documentData}
              value={selectedDocuments}
              onChange={(keys) =>
                form.setValues({
                  libraryDocumentIds: keys.filter((key) => key.startsWith('lib:')).map((key) => key.slice(4)),
                  projectResourceIds: keys.filter((key) => key.startsWith('res:')).map((key) => key.slice(4)),
                })
              }
              error={form.errors.libraryDocumentIds ?? form.errors.projectResourceIds}
            />

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
            {(entry?.linkedByLines ?? []).length > 0 && (
              <Group gap={6}>
                {(entry?.linkedByLines ?? []).map((line) => (
                  <Badge key={line.id} variant="outline" color={line.amount < 0 ? 'red' : 'green'} leftSection={<LinkIcon aria-hidden />} tt="none">
                    {describeLink({ kind: 'line', id: line.id, entryLabel: line.entryLabel, date: String(line.date), label: line.label ?? null, amount: line.amount })}
                  </Badge>
                ))}
              </Group>
            )}
          </>
        )}

        {forecast && (
          <>
            <Divider label="Répétition" labelPosition="left" />
            <RecurrenceEditor value={values.recurrence} onChange={(rule) => form.setFieldValue('recurrence', rule)} start={values.date} withinPortal={false} />
          </>
        )}

        {!forecast && !perso && (
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
      <Modal
        opened={creating !== null}
        onClose={() => setCreating(null)}
        title={creating === 'category' ? 'Nouvelle catégorie' : creating === 'method' ? 'Nouveau moyen de paiement' : creating === 'context' ? 'Nouveau contexte' : 'Nouveau tiers'}
      >
        {/* Rendered in a portal, but React events still bubble to the entry form: its submit stays apart. */}
        <div onSubmit={(event) => event.stopPropagation()}>
          {creating === 'category' && (
            <CategoryForm
              direction={values.direction}
              categories={categories}
              onDone={(id) => {
                if (id) form.setFieldValue('categoryId', id);
                setCreating(null);
              }}
            />
          )}
          {creating === 'context' && (
            <ContextForm
              onDone={(id) => {
                if (id && contextLine !== null) form.setFieldValue(`lines.${contextLine}.contextId`, id);
                setContextLine(null);
                setCreating(null);
              }}
            />
          )}
          {creating === 'method' && (
            <MethodForm
              direction={values.direction}
              onDone={(id) => {
                if (id) form.setFieldValue('methodId', id);
                setCreating(null);
              }}
            />
          )}
          {creating === 'counterparty' && (
            <CounterpartyForm
              onDone={(id) => {
                if (id) form.setValues({ clientId: null, counterpartyId: id });
                setCreating(null);
              }}
            />
          )}
        </div>
      </Modal>
    </form>
  );
}
