import { openFile } from '../../files/lib/open-file';
import { FileBadge } from '../../../components/items/FileBadge';
import { IconAction } from '../../../components/actions/IconAction';
import { DuplicateButton } from '../../../components/actions/DuplicateButton';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { ArchivedNotice } from '../../../components/feedback/ArchivedNotice';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';

import { EmptyState } from '../../../components/feedback/EmptyState';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { ClientSelect } from '../../projects/components/ClientSelect';
import { openModal } from '../../../components/panels/open-modal';
import { DetailSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { Anchor, Autocomplete, Badge, Divider, FileButton, Grid, Group, Paper, SegmentedControl, Select, SimpleGrid, Stack, Switch, Table, Text, Textarea, TextInput } from '@mantine/core';
import { FormActions } from '../../../components/dialogs/FormActions';
import { DateField } from '../../../components/inputs/DateField';

import {
  contactName,
  type AccountingDocumentInput,
  accountingDocumentInputSchema,
  type AccountingLineInput,
  BILLING_SCHEDULE_PRESETS,
  computeTotals,
  depositAmount,
  dueDateForTerms,
  formatDuration,
  LATE_INTEREST_PRESETS,
  PAYMENT_METHOD_PRESETS,
  PAYMENT_TERMS_PRESETS,
  toCents,
  sumOf,
  isInvoice,
  withoutBlankLines,
} from '@ordo/shared';

import {
  ArrowsClockwiseIcon,
  ClockIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileArrowDownIcon,
  HandCoinsIcon,
  LinkBreakIcon,
  PaperPlaneTiltIcon,
  ReceiptIcon,
  ReceiptXIcon,
  SealCheckIcon,
  TrashIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { parisToday } from '../../../lib/dates';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { notifySuccess, onMutationError, toastCallbacks, ON_ERROR } from '../../../lib/notify';
import { confirmRemoveAttachment } from '../lib/remove-attachment';
import { useMailComposer } from '../../mail/hooks/use-mail-composer';

import { useProjectTree } from '../../projects/api';
import { useClientBilling, useCompanyProfile } from '../api';
import { documentMailOptions, openPdfPreview, pdfUrl } from '../lib/document-pdf';
import { useAccountingDocument, useDocumentMutations, useLatestDocumentDate, useRecurringInvoices, type AccountingDocument } from '../api/documents';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, unarchived, useSetArchived } from '../../../lib/archive';
import { accountingQueryKey } from '../api';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { DOCUMENT_TYPE_LABELS, documentName, documentTitle, DRAFT_NAME, isFeminineDocumentType } from '../lib/labels';
import { DeductDepositMenu } from './DeductDepositMenu';
import { DocumentLinesEditor } from './DocumentLinesEditor';
import { openDepositForm } from '../lib/new-document';
import { useTrackingMutations } from '../api/tracking';
import { TimeBillingForm } from './TimeBillingForm';
import { TrackingPanel } from './TrackingPanel';
import { openRecurringForm } from '../lib/recurring-form';
import { FilePreview, PAGE_PREVIEW_HEIGHT } from '../../files/components/FilePreview';
import { clientProjectOptions } from '../../projects/lib/tree';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { Comments } from '../../comments/components/Comments';
import { countOf, plural } from '../../../lib/text';
import { DiscountInput } from './DiscountInput';
import { formRange } from '../../../components/inputs/date-range';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { DetailHeader } from '../../../components/page/DetailHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { documentPath, PAGES } from '../../../app/pages';

type FormValues = AccountingDocumentInput & Record<string, unknown>;

/**
 * Form values of a stored document.
 * @param {AccountingDocument} document Document.
 * @returns {FormValues} Values.
 */
function documentValues(document: AccountingDocument): FormValues {
  return {
    clientId: document.clientId,
    serviceId: document.serviceId ?? null,
    contactId: document.contactId ?? null,
    projectId: document.projectId ?? null,
    issueDate: document.issueDate,
    dueDate: document.dueDate || null,
    serviceStart: document.serviceStart || null,
    serviceEnd: document.serviceEnd || null,
    label: document.label ?? '',
    introduction: document.introduction ?? '',
    referenceLabel: document.referenceLabel ?? '',
    referenceValue: document.referenceValue ?? '',
    conclusion: document.conclusion ?? '',
    paymentTerms: document.paymentTerms ?? '',
    paymentMethods: document.paymentMethods ?? '',
    depositType: document.depositType ?? null,
    depositValue: document.depositValue ?? null,
    lateInterest: document.lateInterest ?? '',
    billingSchedule: document.billingSchedule ?? '',
    otherMentions: document.otherMentions ?? '',
    showBankDetails: document.showBankDetails,
    vatApplicable: document.vatApplicable,
    globalDiscountType: document.globalDiscountType ?? null,
    globalDiscountValue: document.globalDiscountValue ?? null,
    lines: document.lines.map((line) => ({
      kind: line.kind,
      label: line.label,
      description: line.description ?? null,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
      discountType: line.discountType ?? null,
      discountValue: line.discountValue ?? null,
      deductedDocumentId: line.deductedDocumentId ?? null,
    })),
    timeEntryIds: document.timeEntries.map((entry) => entry.id),
  };
}

/**
 * Fields of a document saved on leaving them: texts, the lines, the discount and the deposit (the
 * others are saved as soon as they change).
 */
const ON_BLUR = [
  'label',
  'referenceLabel',
  'referenceValue',
  'introduction',
  'conclusion',
  'billingSchedule',
  'paymentTerms',
  'paymentMethods',
  'lateInterest',
  'otherMentions',
  'lines',
  'depositType',
  'depositValue',
  'globalDiscountType',
  'globalDiscountValue',
] as const;

/**
 * Editor of a loaded document. A draft or a model saves each field as soon as it changes (texts, lines, discount and
 * deposit on leaving them, `useFieldSave`): the whole document each time, its totals recomputed by the
 * API. A final or archived document is read only.
 * @param {{ document: AccountingDocument }} props Component props.
 * @returns {JSX.Element} Editor.
 */
function Editor({ document }: { document: AccountingDocument }) {
  const navigate = useNavigate();
  const { data: workspace } = useProjectTree();
  const mutations = useDocumentMutations();
  const base = useAppForm<FormValues>({ initialValues: documentValues(document), schema: accountingDocumentInputSchema });
  const [finalView, setFinalView] = useState<'preview' | 'details'>('preview');
  const { data: latestDate } = useLatestDocumentDate(document.type, document.id, document.status === 'DRAFT');
  const { data: company } = useCompanyProfile();
  const openComposer = useMailComposer();
  const [preparingMail, setPreparingMail] = useState(false);
  const tracking = useTrackingMutations();
  // Duration of the time billed on the invoice, saved or just added.
  const [timeSeconds, setTimeSeconds] = useState(() => new Map(document.timeEntries.map((entry) => [entry.id, entry.duration ?? 0])));
  const readOnly = document.status === 'FINAL';
  const isTemplate = document.status === 'TEMPLATE';
  // Archived (or the model of an archived recurring invoice): read only, nothing made from it; its PDF stays.
  const { data: recurringInvoices } = useRecurringInvoices();
  const archivedRecurring = isTemplate && Boolean(recurringInvoices?.find((item) => item.templateId === document.id)?.archived);
  const archived = document.archived || archivedRecurring;
  const locked = readOnly || archived;
  // The whole document each time (its lines are all replaced, its totals recomputed by the API).
  const { form, saving, commit, settled } = useFieldSave(base, {
    save: (_changes, input) => mutations.update.mutateAsync({ id: document.id, input }),
    schema: accountingDocumentInputSchema,
    saved: documentValues(document),
    onBlur: ON_BLUR,
    readOnly: locked,
    // A blank line is ignored: not saved, it blocks nothing (a started line in error holds the lines).
    toSaved: (input) => ({ ...input, lines: withoutBlankLines(input.lines) }),
  });
  const values = form.values;
  const { data: client } = useClientBilling(values.clientId);
  const setArchived = useSetArchived('ACCOUNTING_DOCUMENT', [accountingQueryKey]);
  const isQuote = document.type === 'QUOTE';
  // Fully paid final invoice: it can be printed receipted.
  const invoice = isInvoice(document.type);
  const receiptable = readOnly && invoice && (document.paid ?? 0) > 0 && (document.balance ?? 1) <= 0;
  const totals = computeTotals({
    lines: values.lines,
    globalDiscountType: values.globalDiscountType ?? null,
    globalDiscountValue: values.globalDiscountValue ?? null,
    vatApplicable: values.vatApplicable,
  });
  const currency = document.currency;
  /**
   * Asks for confirmation, then makes the draft final (once its saves are done).
   * @returns {void}
   */
  const confirmFinalize = () => {
    openModal(`Valider ${isQuote ? 'le devis' : document.type === 'CREDIT_NOTE' ? 'l’avoir' : 'la facture'}`, (close) => (
      <Stack gap="md">
        <Text size="sm">
          Le document reçoit son numéro définitif et ne pourra plus être modifié ni supprimé : une erreur se corrigera par un avoir. Vérifiez la date ({fmt.day(values.issueDate)}) : les numéros se
          suivent dans l’ordre de validation.
        </Text>
        <FormActions
          onCancel={close}
          submitLabel="Valider"
          submitIcon={<SealCheckIcon aria-hidden />}
          onSubmit={() => {
            close();
            void settled()
              .then(() => mutations.finalize.mutateAsync(document.id))
              .then((number) => notifySuccess(`Document validé : ${number}.`))
              .catch(onMutationError);
          }}
        />
      </Stack>
    ));
  };

  /**
   * Asks for confirmation before deleting the draft.
   * @returns {void}
   */
  const confirmDelete = () => {
    confirmDestructive({
      title: 'Supprimer le brouillon',
      risks: 'Ce brouillon sera supprimé définitivement avec ses pièces jointes.',
      run: () => mutations.remove.mutateAsync(document.id).then(() => navigate(PAGES.accounting.path)),
      done: 'Brouillon supprimé.',
    });
  };

  /**
   * Shows the PDF, once the saves of a draft are done (the preview shows them).
   * @returns {void}
   */
  const preview = () => void settled().then(() => openPdfPreview(document.id, documentTitle(document)));

  /**
   * Opens a mail to the client (contact, else service, else client address) with the PDF: the document and
   * its attachments (then marked sent), or a reminder of what is still due (then noted).
   * @param {boolean} [reminder] Reminder of an unpaid invoice. Optional.
   * @returns {void}
   */
  const openDocumentMail = (reminder = false) => {
    if (!document.number) return;
    const contact = client?.contacts.find((item) => item.id === document.contactId) ?? null;
    const service = client?.services.find((item) => item.id === document.serviceId) ?? null;
    setPreparingMail(true);
    documentMailOptions({
      id: document.id,
      type: document.type,
      number: document.number,
      totalGross: toCents(document.totalGross),
      currency: document.currency,
      dueDate: document.dueDate ?? null,
      paymentTerms: document.paymentTerms ?? null,
      projectId: document.projectId ?? null,
      attachments: document.attachments,
      companyName: company?.name ?? '',
      recipient: { email: contact?.email || service?.email || client?.email || null, firstName: contact?.firstName ?? null },
      reminder: reminder ? { balance: toCents(document.balance ?? 0) } : null,
      onSent: () => (reminder ? tracking.addReminder.mutate({ id: document.id, note: 'Relance par mail' }, ON_ERROR) : tracking.markSent.mutate({ id: document.id, via: 'MAIL' }, ON_ERROR)),
    })
      .then(openComposer)
      .catch(onMutationError)
      .finally(() => setPreparingMail(false));
  };

  /**
   * Creates a document from this one and opens it.
   * @param {'INVOICE' | 'DEPOSIT_INVOICE' | 'CREDIT_NOTE'} type Type.
   * @param {number | null} [depositPercent] Deposit percentage. Optional.
   * @returns {void}
   */
  const createFrom = (type: 'INVOICE' | 'CREDIT_NOTE') =>
    mutations.createFrom.mutate({ sourceId: document.id, type, issueDate: parisToday() }, { onSuccess: (id) => void navigate(documentPath(id)), onError: onMutationError });

  const canBillTime = document.type === 'INVOICE' && document.status === 'DRAFT' && !archived;
  const billedIds = values.timeEntryIds ?? [];

  /**
   * Opens the tracked time of the project, to bill it as lines.
   * @returns {void}
   */
  const openTimeBilling = () => {
    openFormPanel(
      'Facturer le temps passé',
      (close) => (
        <TimeBillingForm
          projectId={values.projectId}
          projects={clientProjectOptions(workspace, values.clientId, { archived: true, keepId: values.projectId })}
          excludeIds={billedIds}
          start={values.serviceStart}
          end={values.serviceEnd}
          vatApplicable={values.vatApplicable}
          onCancel={close}
          onAdd={(lines: AccountingLineInput[], time, period) => {
            close();
            setTimeSeconds((current) => new Map([...current, ...time.map((entry) => [entry.id, entry.seconds] as const)]));
            // Saved together: the lines with the time they bill.
            base.setValues({
              lines: [...values.lines, ...lines],
              timeEntryIds: [...billedIds, ...time.map((entry) => entry.id)],
              serviceStart: values.serviceStart ?? period.start,
              serviceEnd: values.serviceEnd ?? period.end,
            });
            commit(['lines', 'timeEntryIds', 'serviceStart', 'serviceEnd']);
            notifySuccess(`${countOf(lines.length, 'ligne')} ${plural(lines.length, 'ajoutée')}.`);
          }}
        />
      ),
      { size: 'lg', panelId: `time-billing-${document.id}` },
    );
  };

  // Quoted by the menu (« Actions de « F-2026-001 » »).
  const label = documentName(document.number, document.label);

  return (
    <Stack gap="md">
      <DetailHeader
        back={{ to: PAGES.accounting.path, label: PAGES.accounting.label }}
        order={1}
        title={isTemplate ? 'Modèle de facture récurrente' : documentTitle(document)}
        badges={
          <>
            <Badge variant="light" color={readOnly ? 'green' : isTemplate ? 'grape' : 'gray'}>
              {readOnly ? 'Définitif' : isTemplate ? 'Modèle' : DRAFT_NAME}
            </Badge>
            {archived && <ArchivedBadge feminine={archivedRecurring} />}
          </>
        }
        subtitle={
          <>
            {document.sourceId && (
              <Text size="sm" c="dimmed">
                Établi à partir de{' '}
                <Anchor component={Link} to={documentPath(document.sourceId)} size="sm">
                  {document.sourceNumber ?? 'un document'}
                </Anchor>
              </Text>
            )}
            {document.importedSourceId && (
              <Text size="sm" c="dimmed">
                Établi à partir du devis importé {document.importedSourceNumber ?? ''}
              </Text>
            )}
          </>
        }
        // The model of a recurring invoice is archived with it, from the list of the recurring invoices.
        menu={
          isTemplate
            ? undefined
            : {
                name: label,
                items: [
                  archiveEntry(
                    {
                      archived: document.archived,
                      type: DOCUMENT_TYPE_LABELS[document.type],
                      label,
                      feminine: isFeminineDocumentType(document.type),
                    },
                    setArchived,
                    document.id,
                  ),
                ],
              }
        }
        actions={
          <>
            {/* A final document shows its PDF in the page. */}
            {!readOnly && (
              <ActionButton priority="secondary" icon={<EyeIcon aria-hidden />} onClick={preview}>
                Aperçu
              </ActionButton>
            )}
            <IconAction label="Télécharger le PDF" component="a" href={pdfUrl(document.id, true)} download variant="light" size="lg">
              <DownloadSimpleIcon aria-hidden />
            </IconAction>
            {receiptable && (
              <ActionButton priority="secondary" href={pdfUrl(document.id, true, true)} download icon={<ReceiptIcon aria-hidden />} hint="Facture portant la mention « acquittée » et ses règlements">
                Facture acquittée
              </ActionButton>
            )}
            {readOnly && !archived && (
              <ActionButton icon={<PaperPlaneTiltIcon aria-hidden />} onClick={() => openDocumentMail()} loading={preparingMail}>
                Envoyer
              </ActionButton>
            )}
            {document.status === 'DRAFT' && (
              <>
                {!archived && (
                  <ActionButton icon={<SealCheckIcon aria-hidden />} onClick={confirmFinalize} loading={mutations.finalize.isPending}>
                    Valider
                  </ActionButton>
                )}
                <ActionButton danger icon={<TrashIcon aria-hidden />} onClick={confirmDelete}>
                  Supprimer le brouillon
                </ActionButton>
              </>
            )}
            {readOnly && !archived && isQuote && (
              <>
                <ActionButton priority="secondary" icon={<HandCoinsIcon aria-hidden />} onClick={() => openDepositForm({ quoteId: document.id })}>
                  Facture d’acompte
                </ActionButton>
                <ActionButton priority="secondary" icon={<ReceiptIcon aria-hidden />} onClick={() => createFrom('INVOICE')}>
                  Facturer
                </ActionButton>
              </>
            )}
            {readOnly && !archived && invoice && (
              <ActionButton priority="secondary" icon={<ReceiptXIcon aria-hidden />} onClick={() => createFrom('CREDIT_NOTE')}>
                Créer un avoir
              </ActionButton>
            )}
            {document.type === 'INVOICE' && !isTemplate && !archived && (
              <ActionButton priority="secondary" icon={<ArrowsClockwiseIcon aria-hidden />} onClick={() => openRecurringForm({ documentId: document.id })}>
                Rendre récurrente
              </ActionButton>
            )}
            {!isTemplate && !archived && (
              <DuplicateButton
                iconOnly
                size="lg"
                item={document}
                hint="Copie en brouillon, datée d’aujourd’hui"
                duplicate={(source) => mutations.duplicate.mutateAsync({ id: source.id, issueDate: parisToday() })}
                done="Document dupliqué en brouillon."
                open={(id) => void navigate(documentPath(id))}
              />
            )}
          </>
        }
      />

      {archived ? (
        <ArchivedNotice>
          {archivedRecurring
            ? 'Facture récurrente archivée : son modèle est en lecture seule et aucune facture n’est plus émise. Restaurez-la depuis la liste des factures récurrentes pour la modifier.'
            : `Document archivé : masqué des listes et en lecture seule.${readOnly ? ' Il reste valable (numéro et PDF conservés).' : ''} Restaurez-le pour le modifier.`}
        </ArchivedNotice>
      ) : (
        readOnly && <NoticeAlert kind="success">Document définitif : il ne peut plus être modifié. Ses pièces jointes restent modifiables.</NoticeAlert>
      )}
      {isQuote && readOnly && document.invoicedNet !== null && document.invoicedNet !== undefined && (
        <Text size="sm">
          Déjà facturé : <b>{fmt.money(document.invoicedNet, currency)}</b> HT sur {fmt.money(document.totalNet, currency)} HT
          {document.derived.length > 0 && ` (${document.derived.map((item) => documentName(item.number)).join(', ')})`}
        </Text>
      )}

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          {/* A final document shows its PDF in place; its fields stay a click away. */}
          {readOnly && (
            <SegmentedControl
              mb="sm"
              data={[
                { value: 'preview', label: 'Aperçu' },
                { value: 'details', label: 'Détails' },
              ]}
              value={finalView}
              onChange={(value) => setFinalView(value as 'preview' | 'details')}
            />
          )}
          {readOnly && finalView === 'preview' ? (
            <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
              <FilePreview url={pdfUrl(document.id)} filename={documentTitle(document)} kind="pdf" height={PAGE_PREVIEW_HEIGHT} />
            </Paper>
          ) : (
            <Stack gap="md">
              {!locked && <SaveStatus saving={saving} />}
              <SettingsSection title="Client et dates">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <ClientSelect
                    required
                    readOnly={locked}
                    {...form.getInputProps('clientId')}
                    onChange={(clientId) => clientId && form.setValues({ clientId, serviceId: null, contactId: null, projectId: null })}
                  />
                  <Select
                    label="Projet"
                    clearable
                    searchable
                    readOnly={locked}
                    placeholder="Aucun"
                    {...treeSelectProps(clientProjectOptions(workspace, values.clientId, { keepId: values.projectId }))}
                    {...form.getInputProps('projectId')}
                  />
                  <Select
                    label="Service"
                    clearable
                    readOnly={locked}
                    placeholder="Aucun"
                    data={(client?.services ?? []).map((service) => ({ value: service.id, label: service.label }))}
                    {...form.getInputProps('serviceId')}
                  />
                  <Select
                    label="Contact"
                    clearable
                    readOnly={locked}
                    placeholder="Aucun"
                    // Archived contacts are not offered, the document's own stays.
                    data={unarchived(client?.contacts ?? [], document.contactId)
                      .filter((contact) => !values.serviceId || !contact.serviceId || contact.serviceId === values.serviceId)
                      .map((contact) => ({ value: contact.id, label: contactName(contact) }))}
                    {...form.getInputProps('contactId')}
                  />
                  <DateField
                    label="Date du document"
                    required
                    readOnly={locked}
                    // Not before the latest document of its type (models of recurring invoices are dated later).
                    minDate={document.status === 'DRAFT' ? (latestDate ?? undefined) : undefined}
                    description={document.status === 'DRAFT' && latestDate ? `Pas avant le ${fmt.day(latestDate)}, date du dernier document de ce type.` : undefined}
                    {...form.getInputProps('issueDate')}
                  />
                  <DateField label={isQuote ? 'Valable jusqu’au' : 'Échéance'} clearable readOnly={locked} {...form.getInputProps('dueDate')} />
                  <PeriodField label="Période de la prestation" readOnly={locked} {...formRange(form, 'serviceStart', 'serviceEnd')} />
                </SimpleGrid>
              </SettingsSection>

              <SettingsSection title="Contenu">
                <TextInput label="Objet" readOnly={locked} {...form.getInputProps('label')} />
                <Group gap="sm" align="flex-end" grow>
                  <TextInput label="Libellé de la référence" readOnly={locked} {...form.getInputProps('referenceLabel')} />
                  <TextInput label="Référence du client" readOnly={locked} {...form.getInputProps('referenceValue')} />
                </Group>
                <Textarea label="Introduction" autosize minRows={2} readOnly={locked} {...form.getInputProps('introduction')} />
                <Divider label="Lignes" labelPosition="left" />
                <DocumentLinesEditor
                  lines={values.lines}
                  totals={totals.lines}
                  onChange={(lines) => form.setFieldValue('lines', lines)}
                  onCommit={() => commit(['lines'])}
                  readOnly={locked}
                  vatApplicable={values.vatApplicable}
                  currency={currency}
                  errors={form.errors}
                  extraActions={
                    <>
                      {canBillTime && (
                        <ActionButton priority="secondary" size="xs" icon={<ClockIcon aria-hidden />} onClick={openTimeBilling}>
                          Temps passé
                        </ActionButton>
                      )}
                      {document.type === 'INVOICE' && (
                        <DeductDepositMenu
                          clientId={values.clientId || null}
                          documentId={document.id}
                          lines={values.lines}
                          currency={currency}
                          vatApplicable={values.vatApplicable}
                          onAdd={(added) => {
                            form.setFieldValue('lines', [...values.lines, ...added]);
                            commit(['lines']);
                          }}
                        />
                      )}
                    </>
                  }
                />
                {billedIds.length > 0 && (
                  <Group gap="xs" justify="space-between">
                    <Text size="xs" c="dimmed">
                      <ClockIcon aria-hidden /> {billedIds.length} temps {plural(billedIds.length, 'facturé')} ({formatDuration(sumOf(billedIds, (id) => timeSeconds.get(id) ?? 0))}) : ils sont marqués
                      facturés par ce document.
                    </Text>
                    {canBillTime && (
                      <ActionButton priority="tertiary" icon={<LinkBreakIcon aria-hidden />} onClick={() => form.setFieldValue('timeEntryIds', [])}>
                        Détacher le temps
                      </ActionButton>
                    )}
                  </Group>
                )}
                <Textarea label="Conclusion" autosize minRows={2} readOnly={locked} {...form.getInputProps('conclusion')} />
              </SettingsSection>

              <SettingsSection title="Conditions et mentions">
                {isQuote && (
                  <Autocomplete
                    label="Mode de facturation"
                    placeholder="Au mois, tous les 5 du mois…"
                    description="Choisissez ou complétez."
                    readOnly={locked}
                    data={BILLING_SCHEDULE_PRESETS}
                    {...form.getInputProps('billingSchedule')}
                  />
                )}
                {document.type !== 'CREDIT_NOTE' && (
                  <Autocomplete
                    label="Conditions de règlement"
                    placeholder="À réception"
                    readOnly={locked}
                    data={PAYMENT_TERMS_PRESETS}
                    {...form.getInputProps('paymentTerms')}
                    onChange={(paymentTerms) => {
                      // The terms give the due date of an invoice (saved with them, on leaving them).
                      const dueDate = isQuote ? null : dueDateForTerms(paymentTerms, values.issueDate);
                      base.setValues({ paymentTerms, ...(dueDate && { dueDate }) });
                    }}
                    onBlur={() => commit(['paymentTerms', 'dueDate'])}
                  />
                )}
                <Autocomplete label="Mode de règlement" placeholder="Virement bancaire" readOnly={locked} data={PAYMENT_METHOD_PRESETS} {...form.getInputProps('paymentMethods')} />
                {isQuote && (
                  <DiscountInput
                    label="Acompte à la commande"
                    placeholder="Aucun"
                    readOnly={locked}
                    style={{ flex: 1 }}
                    error={form.errors.depositValue}
                    description={
                      values.depositType && values.depositValue
                        ? `Soit ${fmt.moneyCents(depositAmount(values.depositType, values.depositValue, totals.totalGross), currency)}${values.vatApplicable ? ' TTC' : ''}`
                        : undefined
                    }
                    value={values.depositValue ?? null}
                    type={values.depositType ?? null}
                    currency={currency}
                    typeLabel="Type d’acompte"
                    // The amount saved on leaving it, the type as soon as it changes.
                    onChange={({ value, type }) => {
                      form.setValues({ depositValue: value, depositType: type });
                      if (value === values.depositValue) commit(['depositValue', 'depositType']);
                    }}
                    onBlur={() => commit(['depositValue', 'depositType'])}
                  />
                )}
                {document.type !== 'CREDIT_NOTE' && (
                  <Autocomplete label="Intérêts de retard" placeholder="Taux d’intérêt légal en vigueur" readOnly={locked} data={LATE_INTEREST_PRESETS} {...form.getInputProps('lateInterest')} />
                )}
                {document.type !== 'CREDIT_NOTE' && client?.kind === 'COMPANY' && (
                  <Text size="xs" c="dimmed">
                    Client professionnel : l’indemnité forfaitaire de 40 € pour frais de recouvrement est ajoutée au document.
                  </Text>
                )}
                <Textarea label="Autres mentions" autosize minRows={2} readOnly={locked} {...form.getInputProps('otherMentions')} />
                <Group gap="lg">
                  <Switch label="Afficher le RIB" disabled={locked} {...form.getInputProps('showBankDetails', { type: 'checkbox' })} />
                  <Switch label="TVA non applicable" disabled={locked} checked={!values.vatApplicable} onChange={(event) => form.setFieldValue('vatApplicable', !event.currentTarget.checked)} />
                </Group>
              </SettingsSection>
            </Stack>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            {readOnly && <TrackingPanel document={document} onRemind={() => openDocumentMail(true)} remindPending={preparingMail} />}
            <SettingsSection title="Totaux">
              {!locked && (
                <DiscountInput
                  label="Remise générale"
                  style={{ flex: 1 }}
                  error={form.errors.globalDiscountValue}
                  value={values.globalDiscountValue ?? null}
                  type={values.globalDiscountType ?? null}
                  currency={currency}
                  typeLabel="Type de remise générale"
                  // The amount saved on leaving it, the type as soon as it changes.
                  onChange={({ value, type }) => {
                    form.setValues({ globalDiscountValue: value, globalDiscountType: type });
                    if (value === values.globalDiscountValue) commit(['globalDiscountValue', 'globalDiscountType']);
                  }}
                  onBlur={() => commit(['globalDiscountValue', 'globalDiscountType'])}
                />
              )}
              <Table withRowBorders={false} verticalSpacing={4}>
                <Table.Tbody>
                  <TotalRow label="Total articles HT" value={totals.itemsNet} currency={currency} />
                  {totals.globalDiscount > 0 && <TotalRow label="Remise générale" value={-totals.globalDiscount} currency={currency} />}
                  {totals.deductions > 0 && <TotalRow label="Déjà facturé" value={-totals.deductions} currency={currency} />}
                  <TotalRow label="Total HT" value={totals.totalNet} currency={currency} strong />
                  {values.vatApplicable ? (
                    totals.vat.map((item) => <TotalRow key={item.rate} label={`TVA ${fmt.percent(item.rate)} sur ${fmt.moneyCents(item.base, currency)}`} value={item.vat} currency={currency} />)
                  ) : (
                    <Table.Tr>
                      <Table.Td colSpan={2}>
                        <Text size="xs" c="dimmed">
                          {document.vatExemptionText ?? 'TVA non applicable'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {totals.disbursements > 0 && <TotalRow label="Débours" value={totals.disbursements} currency={currency} />}
                  <TotalRow label={values.vatApplicable ? 'Total TTC' : 'Total'} value={totals.totalGross} currency={currency} strong />
                </Table.Tbody>
              </Table>
            </SettingsSection>
            <AttachmentsSection document={document} readOnly={archived} />
            {document.derived.length > 0 && (
              <SettingsSection title="Documents liés">
                {document.derived.map((item) => (
                  <Group key={item.id} justify="space-between">
                    <Anchor component={Link} to={documentPath(item.id)} size="sm">
                      {documentTitle(item)}
                    </Anchor>
                    <Text size="sm" ff="monospace">
                      {fmt.money(item.totalGross, currency)}
                    </Text>
                  </Group>
                ))}
              </SettingsSection>
            )}
            <Comments target="DOCUMENT" id={document.id} readOnly={document.archived} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

/**
 * Row of the totals table.
 * @param {{ label: string, value: number, currency: string, strong?: boolean }} props Label and amount in cents.
 * @returns {JSX.Element} Row.
 */
function TotalRow({ label, value, currency, strong }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={strong ? 700 : 400}>
          {label}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" fw={strong ? 700 : 400} ff="monospace">
          {fmt.moneyCents(value, currency)}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Files attached to a document (signed quote, purchase order, specifications…); only opened when read only.
 * @param {{ document: AccountingDocument, readOnly?: boolean }} props Document, read only (archived). Optional.
 * @returns {JSX.Element} Section.
 */
function AttachmentsSection({ document, readOnly = false }: { document: AccountingDocument; readOnly?: boolean }) {
  const { addAttachments, removeAttachment } = useDocumentMutations();
  return (
    <SettingsSection
      title="Pièces jointes"
      actions={
        !readOnly && (
          <FileButton multiple onChange={(files) => files.length && addAttachments.mutate({ id: document.id, files }, toastCallbacks('Fichiers joints.'))}>
            {(props) => (
              <ActionButton priority="secondary" size="xs" icon={<UploadSimpleIcon aria-hidden />} loading={addAttachments.isPending} {...props}>
                Joindre
              </ActionButton>
            )}
          </FileButton>
        )
      }
    >
      {document.attachments.length === 0 ? (
        <EmptyState compact message="Aucune pièce jointe." />
      ) : (
        <Group gap={4}>
          {document.attachments.map((attachment) => (
            <FileBadge
              key={attachment.id}
              filename={attachment.filename}
              max={48}
              onClick={() => openFile({ url: attachment.url, filename: attachment.filename })}
              onRemove={readOnly ? undefined : () => confirmRemoveAttachment(attachment, documentName(document.number), () => removeAttachment.mutateAsync(attachment.id))}
            />
          ))}
        </Group>
      )}
      <Text size="xs" c="dimmed">
        <FileArrowDownIcon aria-hidden /> Joints aux mails d’envoi du document.
      </Text>
    </SettingsSection>
  );
}

/**
 * Accounting document page: draft (or recurring model) saved field by field, read-only final document with the
 * documents that can be created from it.
 * @param {{ id: string }} props Document id.
 * @returns {JSX.Element} Page.
 */
export function DocumentEditor({ id }: { id: string }) {
  const { data: document, isPending, error } = useAccountingDocument(id);
  if (isPending) return <DetailSkeleton fields={6} />;
  if (error) return <ErrorAlert>{error.message}</ErrorAlert>;
  if (!document) return <DetailNotFound what="Ce document" backTo={PAGES.accounting.path} backLabel={PAGES.accounting.label} />;
  // A validated document is shown again, read only.
  return <Editor key={`${document.id}-${document.status}`} document={document} />;
}
