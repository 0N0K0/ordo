import { AddItemButton } from '../../../components/actions/AddItemButton';
import { unarchived } from '../../../lib/archive';

import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';

import { listSelectProps } from '../../../components/items/item-look';
import { Divider, Group, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { treasuryEntrySchema, type TreasuryAllocationInput, sumOf } from '@ordo/shared';

import { useState } from 'react';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { useAccountingDocuments, useImportedDocuments } from '../../accounting/api/documents';
import { useWorkspace } from '../../workspace/api';
import { useTreasuryAccounts, useTreasuryDocumentOptions, useTreasuryMutations, useTreasurySettings, type ForecastEntry, type TreasuryEntry } from '../api';
import { categoryOptions } from '../lib/categories';
import { DIRECTION_OPTIONS } from '../lib/direction';
import { LinesEditor } from './LinesEditor';
import type { LineLink } from '../lib/lines';
import { documentGroups, payerGroups, payerKey, payerOfKey } from '../lib/entry-env';
import { SupportingDocumentsSelect } from './SupportingDocumentsSelect';
import { EntryLinkSelect, LinkBadge } from './entry-links';
import { entryPayload, entryValues, type EntryValues } from '../lib/entry-values';
import { useCategoryCreators, useEntryCreators } from '../hooks/use-settings-items';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { useActiveWorkspace } from '../../workspaces/api';
import { projectOptions } from '../../workspace/lib/tree';

import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { RuleField } from '../../../components/recurrence/RuleField';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { Comments } from '../../comments/components/Comments';
import { FormActions } from '../../../components/dialogs/FormActions';
import { RemoveButton } from '../../../components/actions/RemoveButton';

/** Prefixes of the key of a document settled in a choice: made in Ordo, or imported. */
const DOCUMENT_KEY = 'doc:';
const IMPORTED_KEY = 'imp:';

/**
 * Key of a document in the choice of the documents settled: « doc:id » or « imp:id ».
 * @param {string} id Document.
 * @param {boolean} imported Whether it is imported.
 * @returns {string} Key.
 */
const documentKey = (id: string, imported: boolean): string => `${imported ? IMPORTED_KEY : DOCUMENT_KEY}${id}`;

/**
 * Key of a document settled, in the choice of the documents (see documentKey).
 * @param {{ documentId?: string | null, importedDocumentId?: string | null }} allocation Document settled.
 * @returns {string | null} Key, none without a document.
 */
function allocationKey(allocation: { documentId?: string | null; importedDocumentId?: string | null }): string | null {
  if (allocation.documentId) return documentKey(allocation.documentId, false);
  return allocation.importedDocumentId ? documentKey(allocation.importedDocumentId, true) : null;
}

/**
 * Document settled of a key of the choice of the documents (see allocationKey).
 * @param {string | null} key Key.
 * @returns {{ documentId: string | null, importedDocumentId: string | null }} Document settled.
 */
function allocationOfKey(key: string | null): { documentId: string | null; importedDocumentId: string | null } {
  return {
    documentId: key?.startsWith(DOCUMENT_KEY) ? key.slice(DOCUMENT_KEY.length) : null,
    importedDocumentId: key?.startsWith(IMPORTED_KEY) ? key.slice(IMPORTED_KEY.length) : null,
  };
}

/** Entry linked to the edited one, as shown in the form. */
interface LinkedSummary {
  id: string;
  date: string;
  label: string;
  amount: number;
}

/**
 * Linked entry as a link (its badge).
 * @param {LinkedSummary} entry Entry.
 * @returns {LineLink} Link.
 */
const entryLink = (entry: LinkedSummary): LineLink => ({ kind: 'entry', id: entry.id, entryLabel: entry.label, date: entry.date, label: null, amount: entry.amount });

interface EntryFormProps {
  entry?: TreasuryEntry | ForecastEntry;
  /** New entry: actual or forecast. */
  status?: 'ACTUAL' | 'FORECAST';
  /** The entry is copied into a new one (its settlements of documents left out). */
  copy?: boolean;
  onDone: () => void;
}

/**
 * Treasury entry: account, execution and value dates, label, money in or out, payer or payee (client or
 * counterparty), category and method of its direction, project, description and linked entries; a forecast may repeat,
 * an actual entry settles invoices (money in) or refunds credit notes (money out), Ordo or imported.
 * @param {EntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EntryForm({ entry, status = 'ACTUAL', copy = false, onDone }: EntryFormProps) {
  const { data: accounts } = useTreasuryAccounts();
  const { data: settings } = useTreasurySettings();
  const { data: documentOptions } = useTreasuryDocumentOptions();
  const [linked, setLinked] = useState<LinkedSummary[]>(() => (entry?.linkedEntries ?? []).map((item) => ({ ...item, date: item.date })));
  const { data: workspace } = useWorkspace();
  // No invoicing in a personal workspace: no documents to settle.
  const { perso } = useActiveWorkspace();
  const { data: documents } = useAccountingDocuments();
  const { data: imported } = useImportedDocuments();
  const { createEntry, updateEntry } = useTreasuryMutations();
  const open = unarchived(accounts ?? [], entry?.accountId);
  const form = useAppForm<EntryValues>({
    initialValues: entryValues(entry, { status, copy, accountId: open[0]?.id ?? '' }),
    schema: treasuryEntrySchema,
  });
  const values = form.values;
  // Split: the category, project, documents and links are on the lines.
  const split = values.lines.length > 0;
  const incoming = values.direction === 'IN';
  const forecast = values.status === 'FORECAST';
  // Key of the payer select: "client:<id>" or "tiers:<id>".
  const payer = payerKey(values);
  const categories = settings?.treasuryCategories ?? [];
  const createCategory = useCategoryCreators(categories);
  const create = useEntryCreators(values.direction);
  const methods = (settings?.treasuryPaymentMethods ?? []).filter((method) => (incoming ? method.incoming : method.outgoing) || method.id === values.methodId);
  const payers = payerGroups(workspace?.clients ?? [], settings?.treasuryCounterparties ?? [])
    .map((group) => ({ ...group, items: unarchived(group.items, payer, (item) => item.value) }))
    .filter((group) => group.items.length);
  // Supporting documents, grouped by place: the library, then each project (the entry's project first).
  const documentData = documentGroups([...(documentOptions ?? []), ...(entry?.documents ?? []), ...(entry?.lines ?? []).flatMap((line) => line.documents)], values.projectId);
  // Projects of the entry or of its lines, archived ones only when chosen already.
  const chosenProjects = new Set([values.projectId, ...values.lines.map((line) => line.projectId)]);
  // Each project with its full path: client › project › sub-project.
  const projectChoices = projectOptions(workspace, unarchived(workspace?.projects ?? [], [...chosenProjects]));

  /**
   * Option of a document the entry can settle: its name (kept for the label of the entry) and what is left due.
   * @param {string} value Key (« doc:id », « imp:id »).
   * @param {string} name Number and client of the document.
   * @param {{ balance?: number | null, currency: Parameters<typeof fmt.money>[1] }} document Document.
   * @returns {{ value: string, name: string, label: string, balance: number }} Option.
   */
  const settleOption = (value: string, name: string, document: { balance?: number | null; currency: Parameters<typeof fmt.money>[1] }) => ({
    value,
    name,
    label: `${name} (reste ${fmt.money(document.balance ?? 0, document.currency)})`,
    balance: document.balance ?? 0,
  });
  // Documents it can settle: still due and not archived, or already settled by this entry.
  const own = new Set((entry?.allocations ?? []).map((allocation) => allocation.documentId ?? allocation.importedDocumentId));
  const settleable = [
    ...(documents ?? [])
      .filter((document) => document.status === 'FINAL' && document.type !== 'QUOTE' && (document.type === 'CREDIT_NOTE') !== incoming)
      .filter((document) => ((document.balance ?? 0) > 0 && !document.archived) || own.has(document.id))
      .map((document) => settleOption(documentKey(document.id, false), `${document.number} — ${document.clientName}`, document)),
    ...(imported ?? [])
      .filter((document) => document.type !== 'QUOTE' && (document.type === 'CREDIT_NOTE') !== incoming)
      .filter((document) => ((document.balance ?? 0) > 0 && !document.archived) || own.has(document.id))
      .map((document) => settleOption(documentKey(document.id, true), `${document.number} (importé) — ${document.clientName}`, document)),
  ];
  const allocated = sumOf(values.allocations, (allocation) => allocation.amount);
  const keyOf = (allocation: TreasuryAllocationInput) => allocationKey(allocation);

  const handleSubmit = form.onSubmit((input) => {
    const payload = entryPayload(input);
    const callbacks = formCallbacks(form, copy ? 'Mouvement dupliqué.' : entry ? 'Mouvement modifié.' : 'Mouvement ajouté.', onDone);
    if (entry && !copy) updateEntry.mutate({ id: entry.id, input: payload }, callbacks);
    else createEntry.mutate(payload, callbacks);
  });

  return (
    <Stack gap="lg">
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
            <Select label="Compte" required {...listSelectProps(open, undefined, values.accountId)} allowDeselect={false} {...form.getInputProps('accountId')} />
            <DatePickerInput
              label={forecast ? 'Date d’exécution prévue' : 'Date d’exécution'}
              required
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
            {...form.getInputProps('valueDate')}
          />
          <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
          <Group gap="sm" align="flex-end" wrap="nowrap">
            <SegmentedControl
              aria-label="Sens"
              data={DIRECTION_OPTIONS}
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
            <AmountInput label="Montant" required min={0} style={{ flex: 1 }} {...form.getInputProps('amount')} />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {!split && (
              <CreatableSelect
                label="Catégorie"
                clearable
                searchable
                onCreate={createCategory[values.direction]}
                placeholder={categories.some((category) => category.direction === values.direction) ? '—' : 'Aucune : tapez un libellé pour la créer'}
                {...treeSelectProps(categoryOptions(categories, values.direction, undefined, values.categoryId))}
                {...form.getInputProps('categoryId')}
              />
            )}
            <CreatableSelect
              label="Moyen de paiement"
              clearable
              onCreate={create.method}
              placeholder={methods.length ? '—' : 'Aucun : tapez un libellé pour le créer'}
              {...listSelectProps(methods, undefined, values.methodId)}
              {...form.getInputProps('methodId')}
            />
          </SimpleGrid>
          <CreatableSelect
            label={incoming ? 'Émetteur' : 'Destinataire'}
            onCreate={async (name) => {
              const id = await create.counterparty(name);
              return id && `tiers:${id}`;
            }}
            clearable
            searchable
            placeholder="Client ou tiers"
            nothingFoundMessage="Aucun client ni tiers"
            data={payers}
            value={payer}
            onChange={(key) => form.setValues(payerOfKey(key))}
            error={form.errors.clientId ?? form.errors.counterpartyId}
          />
          {!split && <Select label="Projet" clearable searchable {...treeSelectProps(projectChoices)} {...form.getInputProps('projectId')} />}
          <MarkdownEditor label="Description" value={form.values.note ?? ''} onChange={(note) => form.setFieldValue('note', note)} suggestions={NO_SUGGESTIONS} minRows={2} />
          <TextInput label="Lien" placeholder="https://… (une commande en ligne, par exemple)" type="url" {...form.getInputProps('url')} />

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
            projects={projectChoices}
            documentGroups={documentData}
          />

          {split ? (
            <Text size="xs" c="dimmed">
              Décomposé : catégorie, projet, pièces justificatives et liens se précisent sur chaque ligne.
            </Text>
          ) : (
            <>
              <SupportingDocumentsSelect
                data={documentData}
                value={values}
                onChange={(documents) => form.setValues({ ...documents })}
                error={(form.errors.libraryDocumentIds ?? form.errors.projectResourceIds) as string | undefined}
              />

              <Divider label="Mouvements liés" labelPosition="left" />
              <Text size="xs" c="dimmed">
                Une entrée et une sortie liées sur une même période se compensent dans les graphiques d’entrées et de sorties (remboursement de frais, virement entre comptes…).
              </Text>
              {linked.length > 0 && (
                <Group gap={6}>
                  {linked.map((item) => (
                    <LinkBadge
                      key={item.id}
                      link={entryLink(item)}
                      onUnlink={() => {
                        setLinked((current) => current.filter((other) => other.id !== item.id));
                        form.setFieldValue(
                          'linkedEntryIds',
                          values.linkedEntryIds.filter((id) => id !== item.id),
                        );
                      }}
                    />
                  ))}
                </Group>
              )}
              {/* Entries only: a split one is linked through its lines. */}
              <EntryLinkSelect
                aria-label="Lier un mouvement"
                entryId={entry?.id ?? null}
                links={values.linkedEntryIds.map((id) => ({ kind: 'entry' as const, id }))}
                lines={false}
                withAccount
                onLink={(link) => {
                  setLinked((current) => [...current, { id: link.id, date: link.date, label: link.entryLabel, amount: link.amount }]);
                  form.setFieldValue('linkedEntryIds', [...values.linkedEntryIds, link.id]);
                }}
                error={form.errors.linkedEntryIds}
              />
              {(entry?.linkedByLines ?? []).length > 0 && (
                <Group gap={6}>
                  {(entry?.linkedByLines ?? []).map((line) => (
                    <LinkBadge key={line.id} variant="outline" link={{ kind: 'line', id: line.id, entryLabel: line.entryLabel, date: line.date, label: line.label ?? null, amount: line.amount }} />
                  ))}
                </Group>
              )}
            </>
          )}

          {forecast && (
            <>
              <RuleField weekly={false} value={values.recurrence} onChange={(rule) => form.setFieldValue('recurrence', rule)} start={values.date} />
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
                    error={form.errors[`allocations.${index}`]}
                    onChange={(key) => {
                      const option = settleable.find((item) => item.value === key);
                      const amount = option ? Math.min(option.balance, Math.max(0, values.amount - allocated + allocation.amount)) || option.balance : allocation.amount;
                      form.setFieldValue(`allocations.${index}`, {
                        ...allocationOfKey(key),
                        amount,
                      });
                      // An empty entry takes the amount and the name of the document it settles.
                      if (option && !values.amount) form.setFieldValue('amount', allocated - allocation.amount + amount);
                      if (option && !values.label.trim()) form.setFieldValue('label', `${incoming ? 'Règlement' : 'Remboursement'} ${option.name}`);
                    }}
                  />
                  <AmountInput
                    aria-label={`Montant réglé ${index + 1}`}
                    w={130}
                    min={0}
                    value={allocation.amount}
                    onChange={(value) => form.setFieldValue(`allocations.${index}.amount`, typeof value === 'number' ? value : 0)}
                  />
                  <RemoveButton label="Retirer" size="lg" aria-label={`Retirer le document ${index + 1}`} onClick={() => form.removeListItem('allocations', index)} />
                </Group>
              ))}
              {form.errors.allocations && (
                <Text size="xs" c="red">
                  {form.errors.allocations}
                </Text>
              )}
              <Group justify="space-between">
                <AddItemButton disabled={settleable.length === values.allocations.length} onClick={() => form.insertListItem('allocations', { documentId: null, importedDocumentId: null, amount: 0 })}>
                  {incoming ? 'Régler une facture' : 'Rembourser un avoir'}
                </AddItemButton>
                {values.allocations.length > 0 && (
                  <Text size="xs" c="dimmed">
                    {fmt.money(allocated)} affectés sur {fmt.money(values.amount)}
                  </Text>
                )}
              </Group>
            </>
          )}

          <FormActions onCancel={onDone} loading={createEntry.isPending || updateEntry.isPending} />
        </Stack>
      </form>
      {entry && !copy && 'id' in entry && <Comments target="TREASURY_ENTRY" id={entry!.id} readOnly={entry!.archived} />}
    </Stack>
  );
}
