import { openFile } from '../../files/lib/open-file';
import { FileBadge } from '../../../components/items/FileBadge';
import { IconAction } from '../../../components/actions/IconAction';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { DestructiveButton } from '../../../components/dialogs/DestructiveActions';
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
import { DatePickerInput } from '@mantine/dates';

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
} from '@ordo/shared';

import {
  ArrowsClockwiseIcon,
  ClockIcon,
  CopyIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileArrowDownIcon,
  FloppyDiskIcon,
  HandCoinsIcon,
  LinkBreakIcon,
  PaperPlaneTiltIcon,
  ReceiptIcon,
  ReceiptXIcon,
  SealCheckIcon,
  TrashIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { localToday } from '../../../lib/dates';
import { formCallbacks, showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess, onMutationError, toastCallbacks, ON_ERROR } from '../../../lib/notify';
import { confirmRemoveAttachment } from '../lib/remove-attachment';
import { useMailComposer } from '../../mail/hooks/use-mail-composer';

import { useWorkspace } from '../../projects/api';
import { useClientBilling, useCompanyProfile } from '../api';
import { documentMailOptions, openPdfPreview, pdfUrl } from '../lib/document-pdf';
import { useAccountingDocument, useDocumentMutations, useLatestDocumentDate, useRecurringInvoices, type AccountingDocument } from '../api/documents';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, useSetArchived } from '../../../lib/archive';
import { accountingQueryKey } from '../api';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { DOCUMENT_TYPE_LABELS, isFeminineDocumentType } from '../lib/labels';
import { DeductDepositMenu } from './DeductDepositMenu';
import { LinesEditor } from './LinesEditor';
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
import { dateRangeProps, formRange } from '../../../components/inputs/date-range';
import { DetailHeader } from '../../../components/page/DetailHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { documentPath, PAGES } from '../../../app/pages';

type FormValues = AccountingDocumentInput & Record<string, unknown>;

/**
 * Form values of a stored document.
 * @param {AccountingDocument} document Document.
 * @returns {FormValues} Values.
 */
function toValues(document: AccountingDocument): FormValues {
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
 * Editor of a loaded document.
 * @param {{ document: AccountingDocument }} props Component props.
 * @returns {JSX.Element} Editor.
 */
function Editor({ document }: { document: AccountingDocument }) {
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const mutations = useDocumentMutations();
  const form = useAppForm<FormValues>({ initialValues: toValues(document), schema: accountingDocumentInputSchema });
  const values = form.values;
  const service = dateRangeProps(formRange(form, 'serviceStart', 'serviceEnd'));
  const { data: client } = useClientBilling(values.clientId);
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
  const dirty = form.isDirty();

  // Leaving with unsaved changes asks for confirmation.
  useEffect(() => {
    if (!dirty || locked) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, locked]);

  /**
   * Saves the draft.
   * @param {() => void} [then] Called once saved. Optional.
   * @returns {void}
   */
  const save = (then?: () => void) => {
    const result = form.validate();
    if (result.hasErrors) return;
    // A promise: it settles even if the editor is replaced meanwhile (the document is reloaded).
    mutations.update
      .mutateAsync({ id: document.id, input: values })
      .then(() => {
        form.resetDirty();
        if (then) then();
        else notifySuccess(isTemplate ? 'Modèle enregistré.' : 'Brouillon enregistré.');
      })
      .catch((error: Error) => showFormError(form, error));
  };

  /**
   * Asks for confirmation, then makes the draft final (saved first).
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
            save(
              () =>
                void mutations.finalize
                  .mutateAsync(document.id)
                  .then((number) => notifySuccess(`Document validé : ${number}.`))
                  .catch(onMutationError),
            );
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
      onConfirm: () => {
        mutations.remove.mutate(
          document.id,
          formCallbacks(null, 'Brouillon supprimé.', () => void navigate(PAGES.accounting.path)),
        );
      },
    });
  };

  /**
   * Shows the PDF; a draft with changes is saved first, so that the preview shows them.
   * @returns {void}
   */
  const preview = () => {
    const title = `${DOCUMENT_TYPE_LABELS[document.type]} ${document.number ?? '(brouillon)'}`;
    if (dirty && !readOnly) save(() => openPdfPreview(document.id, title));
    else openPdfPreview(document.id, title);
  };

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
    mutations.createFrom.mutate({ sourceId: document.id, type, issueDate: localToday() }, { onSuccess: (id) => void navigate(documentPath(id)), onError: onMutationError });

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
            form.setValues({
              lines: [...values.lines, ...lines],
              timeEntryIds: [...billedIds, ...time.map((entry) => entry.id)],
              serviceStart: values.serviceStart ?? period.start,
              serviceEnd: values.serviceEnd ?? period.end,
            });
            notifySuccess(`${countOf(lines.length, 'ligne')} ${plural(lines.length, 'ajoutée')} : enregistrez le brouillon.`);
          }}
        />
      ),
      { size: 'lg', panelId: `time-billing-${document.id}` },
    );
  };

  const typeLabel = DOCUMENT_TYPE_LABELS[document.type];
  const documentName = `« ${document.number ?? document.label ?? 'Brouillon'} »`;

  return (
    <Stack gap="md">
      <DetailHeader
        back={{ to: PAGES.accounting.path, label: PAGES.accounting.title }}
        order={1}
        title={isTemplate ? `Modèle de facture récurrente` : `${typeLabel} ${document.number ?? ''}`}
        badges={
          <>
            <Badge variant="light" color={readOnly ? 'green' : isTemplate ? 'grape' : 'gray'}>
              {readOnly ? 'Définitif' : isTemplate ? 'Modèle' : 'Brouillon'}
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
                name: documentName,
                items: [
                  archiveEntry(
                    {
                      archived: document.archived,
                      type: DOCUMENT_TYPE_LABELS[document.type],
                      label: document.number ?? document.label ?? 'Brouillon',
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
            <IconAction
              label="Télécharger le PDF"
              hint={dirty && !readOnly ? 'Télécharger le PDF (dernière version enregistrée)' : undefined}
              component="a"
              href={pdfUrl(document.id, true)}
              download
              variant="default"
              size="lg"
            >
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
            {!locked && (
              <ActionButton priority="secondary" icon={<FloppyDiskIcon aria-hidden />} onClick={() => save()} loading={mutations.update.isPending} disabled={!dirty}>
                Enregistrer
              </ActionButton>
            )}
            {document.status === 'DRAFT' && (
              <>
                {!archived && (
                  <ActionButton icon={<SealCheckIcon aria-hidden />} onClick={confirmFinalize} loading={mutations.finalize.isPending}>
                    Valider
                  </ActionButton>
                )}
                <DestructiveButton leftSection={<TrashIcon aria-hidden />} onClick={confirmDelete}>
                  Supprimer le brouillon
                </DestructiveButton>
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
              <IconAction
                label="Dupliquer"
                hint="Dupliquer en brouillon"
                size="lg"
                onClick={() => mutations.duplicate.mutate({ id: document.id, issueDate: localToday() }, { onSuccess: (id) => void navigate(documentPath(id)), onError: onMutationError })}
              >
                <CopyIcon aria-hidden />
              </IconAction>
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
          {document.derived.length > 0 && ` (${document.derived.map((item) => item.number ?? 'brouillon').join(', ')})`}
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
              <FilePreview url={pdfUrl(document.id)} filename={`${DOCUMENT_TYPE_LABELS[document.type]} ${document.number ?? ''}`} kind="pdf" height={PAGE_PREVIEW_HEIGHT} />
            </Paper>
          ) : (
            <Stack gap="md">
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
                    data={(client?.contacts ?? [])
                      .filter((contact) => !values.serviceId || !contact.serviceId || contact.serviceId === values.serviceId)
                      .map((contact) => ({ value: contact.id, label: contactName(contact) }))}
                    {...form.getInputProps('contactId')}
                  />
                  <DatePickerInput
                    label="Date du document"
                    required
                    readOnly={locked}
                    // Not before the latest document of its type (models of recurring invoices are dated later).
                    minDate={document.status === 'DRAFT' ? (latestDate ?? undefined) : undefined}
                    description={document.status === 'DRAFT' && latestDate ? `Pas avant le ${fmt.day(latestDate)}, date du dernier document de ce type.` : undefined}
                    {...form.getInputProps('issueDate')}
                  />
                  <DatePickerInput label={isQuote ? 'Valable jusqu’au' : 'Échéance'} clearable readOnly={locked} {...form.getInputProps('dueDate')} />
                  <DatePickerInput label="Début de la prestation" clearable readOnly={locked} {...service.start} />
                  <DatePickerInput label="Fin de la prestation" clearable readOnly={locked} {...service.end} />
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
                <LinesEditor
                  lines={values.lines}
                  totals={totals.lines}
                  onChange={(lines) => form.setFieldValue('lines', lines)}
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
                          onAdd={(added) => form.setFieldValue('lines', [...values.lines, ...added])}
                        />
                      )}
                    </>
                  }
                />
                {billedIds.length > 0 && (
                  <Group gap="xs" justify="space-between">
                    <Text size="xs" c="dimmed">
                      <ClockIcon aria-hidden /> {billedIds.length} temps {plural(billedIds.length, 'facturé')} ({formatDuration(sumOf(billedIds, (id) => timeSeconds.get(id) ?? 0))}) : ils sont marqués
                      facturés {readOnly ? 'par ce document' : 'à l’enregistrement'}.
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
                      // The terms give the due date of an invoice.
                      const dueDate = isQuote ? null : dueDateForTerms(paymentTerms, values.issueDate);
                      form.setValues({ paymentTerms, ...(dueDate && { dueDate }) });
                    }}
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
                    onChange={({ value, type }) => form.setValues({ depositValue: value, depositType: type })}
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
                  onChange={({ value, type }) => form.setValues({ globalDiscountValue: value, globalDiscountType: type })}
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
                      {DOCUMENT_TYPE_LABELS[item.type]} {item.number ?? '(brouillon)'}
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
              onRemove={readOnly ? undefined : () => confirmRemoveAttachment(attachment, document.number ?? 'ce brouillon', () => removeAttachment.mutateAsync(attachment.id))}
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
 * Accounting document page: editable draft (or recurring model), read-only final document with the
 * documents that can be created from it.
 * @param {{ id: string }} props Document id.
 * @returns {JSX.Element} Page.
 */
export function DocumentEditor({ id }: { id: string }) {
  const { data: document, isPending, error } = useAccountingDocument(id);
  if (isPending) return <DetailSkeleton fields={6} />;
  if (error) return <ErrorAlert>{error.message}</ErrorAlert>;
  if (!document) return <DetailNotFound what="Ce document" backTo={PAGES.accounting.path} backLabel={PAGES.accounting.title} />;
  // A validated document is shown again, read only.
  return <Editor key={`${document.id}-${document.status}`} document={document} />;
}
