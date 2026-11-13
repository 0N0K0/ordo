import {
  ActionIcon,
  Alert,
  Anchor,
  Autocomplete,
  Badge,
  Button,
  Divider,
  FileButton,
  Grid,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import {
  accountingDocumentInputSchema,
  BILLING_SCHEDULE_PRESETS,
  computeTotals,
  depositAmount,
  dueDateForTerms,
  formatDuration,
  formatMoney,
  LATE_INTEREST_PRESETS,
  PAYMENT_METHOD_PRESETS,
  PAYMENT_TERMS_PRESETS,
  type AccountingDocumentInput,
  type AccountingLineInput,
} from '@ordo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowsClockwiseIcon, CheckCircleIcon, ClockIcon, CopyIcon, DownloadSimpleIcon, EyeIcon, FileArrowDownIcon, PaperPlaneTiltIcon, PaperclipIcon, ReceiptIcon, SealCheckIcon, TrashIcon, UploadSimpleIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useMailComposer } from '../mail/use-mail-composer';
import { timeQueryKey } from '../time/api';
import { useWorkspace } from '../workspace/api';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useClientBilling, useCompanyProfile } from './api';
import { documentMailOptions, openPdfPreview, pdfUrl } from './document-pdf';
import { useAccountingDocument, useDocumentMutations, useLatestDocumentDate, type AccountingDocument } from './documents-api';
import { Section } from './EditorSection';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { DeductDepositMenu } from './DeductDepositMenu';
import { LinesEditor } from './LinesEditor';
import { openDepositForm } from './new-document';
import { useTrackingMutations } from './tracking-api';
import { TimeBillingForm } from './TimeBillingForm';
import { TrackingPanel } from './TrackingPanel';
import { openRecurringForm } from './recurring-form';
import { FileLink } from '../files/FileLink';
import { FilePreview } from '../files/FilePreview';
import { projectOptions } from '../workspace/tree';
import { treeSelectProps } from '../../components/tree-select/tree-select';

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
    issueDate: String(document.issueDate),
    dueDate: document.dueDate ? String(document.dueDate) : null,
    serviceStart: document.serviceStart ? String(document.serviceStart) : null,
    serviceEnd: document.serviceEnd ? String(document.serviceEnd) : null,
    title: document.title ?? '',
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
      title: line.title,
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
  const { data: client } = useClientBilling(values.clientId);
  const [finalView, setFinalView] = useState<'preview' | 'details'>('preview');
  const { data: latestDate } = useLatestDocumentDate(document.type, document.id, document.status === 'DRAFT');
  const { data: company } = useCompanyProfile();
  const openComposer = useMailComposer();
  const [preparingMail, setPreparingMail] = useState(false);
  const tracking = useTrackingMutations();
  const queryClient = useQueryClient();
  // Duration of the time billed on the invoice, saved or just added.
  const [timeSeconds, setTimeSeconds] = useState(() => new Map(document.timeEntries.map((entry) => [entry.id, entry.duration ?? 0])));
  const readOnly = document.status === 'FINAL';
  const isTemplate = document.status === 'TEMPLATE';
  const isQuote = document.type === 'QUOTE';
  // Fully paid final invoice: it can be printed receipted.
  const receiptable = readOnly && (document.type === 'INVOICE' || document.type === 'DEPOSIT_INVOICE') && (document.paid ?? 0) > 0 && (document.balance ?? 1) <= 0;
  const isInvoice = document.type === 'INVOICE' || document.type === 'DEPOSIT_INVOICE';
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
    if (!dirty || readOnly) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, readOnly]);

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
        // The time billed changed with the draft.
        void queryClient.invalidateQueries({ queryKey: timeQueryKey });
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
    const modalId = `finalize-${document.id}`;
    modals.open({
      modalId,
      title: `Valider ${isQuote ? 'le devis' : document.type === 'CREDIT_NOTE' ? 'l’avoir' : 'la facture'}`,
      children: (
        <Stack gap="md">
          <Text size="sm">
            Le document reçoit son numéro définitif et ne pourra plus être modifié ni supprimé : une erreur se corrigera par un
            avoir. Vérifiez la date ({new Date(`${values.issueDate}T12:00:00`).toLocaleDateString('fr-FR')}) : les numéros se
            suivent dans l’ordre de validation.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              leftSection={<SealCheckIcon aria-hidden />}
              onClick={() => {
                modals.close(modalId);
                save(() =>
                  void mutations.finalize
                    .mutateAsync(document.id)
                    .then((number) => notifySuccess(`Document validé : ${number}.`))
                    .catch((error: Error) => notifyError(error.message)),
                );
              }}
            >
              Valider
            </Button>
            <Button variant="default" onClick={() => modals.close(modalId)}>
              Annuler
            </Button>
          </Group>
        </Stack>
      ),
    });
  };

  /**
   * Asks for confirmation before deleting the draft.
   * @returns {void}
   */
  const confirmDelete = () => {
    const modalId = `delete-document-${document.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le brouillon',
      children: (
        <Stack gap="md">
          <Text size="sm">Ce brouillon sera supprimé définitivement avec ses pièces jointes. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              mutations.remove.mutate(document.id, {
                onSuccess: () => {
                  notifySuccess('Brouillon supprimé.');
                  void navigate('/accounting');
                },
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
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
      totalGross: Math.round(document.totalGross * 100),
      currency: document.currency,
      dueDate: document.dueDate ?? null,
      paymentTerms: document.paymentTerms ?? null,
      projectId: document.projectId ?? null,
      attachments: document.attachments,
      companyName: company?.name ?? '',
      recipient: { email: contact?.email || service?.email || client?.email || null, firstName: contact?.firstName ?? null },
      reminder: reminder ? { balance: Math.round((document.balance ?? 0) * 100) } : null,
      onSent: () =>
        reminder
          ? tracking.addReminder.mutate({ id: document.id, note: 'Relance par mail' }, { onError: (error) => notifyError(error.message) })
          : tracking.markSent.mutate({ id: document.id, via: 'MAIL' }, { onError: (error) => notifyError(error.message) }),
    })
      .then(openComposer)
      .catch((error: Error) => notifyError(error.message))
      .finally(() => setPreparingMail(false));
  };

  /**
   * Creates a document from this one and opens it.
   * @param {'INVOICE' | 'DEPOSIT_INVOICE' | 'CREDIT_NOTE'} type Type.
   * @param {number | null} [depositPercent] Deposit percentage. Optional.
   * @returns {void}
   */
  const createFrom = (type: 'INVOICE' | 'CREDIT_NOTE') =>
    mutations.createFrom.mutate(
      { sourceId: document.id, type, issueDate: localToday() },
      { onSuccess: (id) => void navigate(`/accounting/${id}`), onError: (error) => notifyError(error.message) },
    );


  const canBillTime = document.type === 'INVOICE' && document.status === 'DRAFT';
  const billedIds = values.timeEntryIds ?? [];

  /**
   * Opens the tracked time of the project, to bill it as lines.
   * @returns {void}
   */
  const openTimeBilling = () => {
    const modalId = `time-billing-${document.id}`;
    modals.open({
      modalId,
      title: 'Facturer le temps passé',
      size: 'xl',
      children: (
        <TimeBillingForm
          projectId={values.projectId}
          projects={projectOptions(
            workspace,
            (workspace?.projects ?? []).filter((project) => project.clientId === values.clientId || project.id === values.projectId),
          )}
          excludeIds={billedIds}
          start={values.serviceStart}
          end={values.serviceEnd}
          vatApplicable={values.vatApplicable}
          onCancel={() => modals.close(modalId)}
          onAdd={(lines: AccountingLineInput[], time, period) => {
            modals.close(modalId);
            setTimeSeconds((current) => new Map([...current, ...time.map((entry) => [entry.id, entry.seconds] as const)]));
            form.setValues({
              lines: [...values.lines, ...lines],
              timeEntryIds: [...billedIds, ...time.map((entry) => entry.id)],
              serviceStart: values.serviceStart ?? period.start,
              serviceEnd: values.serviceEnd ?? period.end,
            });
            notifySuccess(`${lines.length} ligne${lines.length > 1 ? 's' : ''} ajoutée${lines.length > 1 ? 's' : ''} : enregistrez le brouillon.`);
          }}
        />
      ),
    });
  };

  const clients = (workspace?.clients ?? []).filter((item) => !item.archived || item.id === values.clientId);
  const projects = (workspace?.projects ?? []).filter((project) => (!project.archived && project.clientId === values.clientId) || project.id === values.projectId);
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={2}>
          <Anchor component={Link} to="/accounting" size="sm">
            ← Facturation
          </Anchor>
          <Group gap="sm">
            <Title order={1} size="h2">
              {isTemplate ? `Modèle de facture récurrente` : `${typeLabel} ${document.number ?? ''}`}
            </Title>
            <Badge variant="light" color={readOnly ? 'green' : isTemplate ? 'grape' : 'gray'}>
              {readOnly ? 'Définitif' : isTemplate ? 'Modèle' : 'Brouillon'}
            </Badge>
          </Group>
          {document.sourceId && (
            <Text size="sm" c="dimmed">
              Établi à partir de{' '}
              <Anchor component={Link} to={`/accounting/${document.sourceId}`} size="sm">
                {document.sourceNumber ?? 'un document'}
              </Anchor>
            </Text>
          )}
          {document.importedSourceId && (
            <Text size="sm" c="dimmed">
              Établi à partir du devis importé {document.importedSourceNumber ?? ''}
            </Text>
          )}
        </Stack>
        <Group gap="xs">
          {/* A final document shows its PDF in the page. */}
          {!readOnly && (
            <Button variant="default" leftSection={<EyeIcon aria-hidden />} onClick={preview}>
              Aperçu
            </Button>
          )}
          <Tooltip label={dirty && !readOnly ? 'Télécharger le PDF (dernière version enregistrée)' : 'Télécharger le PDF'}>
            <ActionIcon component="a" href={pdfUrl(document.id, true)} download variant="default" size="lg" aria-label="Télécharger le PDF">
              <DownloadSimpleIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          {receiptable && (
            <Tooltip label="Facture portant la mention « acquittée » et ses règlements">
              <Button component="a" href={pdfUrl(document.id, true, true)} download variant="default" leftSection={<ReceiptIcon aria-hidden />}>
                Facture acquittée
              </Button>
            </Tooltip>
          )}
          {readOnly && (
            <Button leftSection={<PaperPlaneTiltIcon aria-hidden />} onClick={() => openDocumentMail()} loading={preparingMail}>
              Envoyer
            </Button>
          )}
          {!readOnly && (
            <Button variant="default" onClick={() => save()} loading={mutations.update.isPending} disabled={!dirty}>
              Enregistrer
            </Button>
          )}
          {document.status === 'DRAFT' && (
            <>
              <Button leftSection={<SealCheckIcon aria-hidden />} onClick={confirmFinalize} loading={mutations.finalize.isPending}>
                Valider
              </Button>
              <Tooltip label="Supprimer le brouillon">
                <ActionIcon variant="subtle" color="red" size="lg" aria-label="Supprimer le brouillon" onClick={confirmDelete}>
                  <TrashIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          {readOnly && isQuote && (
            <>
              <Button variant="light" onClick={() => openDepositForm({ quoteId: document.id })}>
                Facture d’acompte
              </Button>
              <Button variant="light" onClick={() => createFrom('INVOICE')}>
                Facturer
              </Button>
            </>
          )}
          {readOnly && isInvoice && (
            <Button variant="light" color="orange" onClick={() => createFrom('CREDIT_NOTE')}>
              Créer un avoir
            </Button>
          )}
          {document.type === 'INVOICE' && !isTemplate && (
            <Button variant="light" color="grape" leftSection={<ArrowsClockwiseIcon aria-hidden />} onClick={() => openRecurringForm({ documentId: document.id })}>
              Rendre récurrente
            </Button>
          )}
          {!isTemplate && (
            <Tooltip label="Dupliquer en brouillon">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label="Dupliquer"
                onClick={() =>
                  mutations.duplicate.mutate(
                    { id: document.id, issueDate: localToday() },
                    { onSuccess: (id) => void navigate(`/accounting/${id}`), onError: (error) => notifyError(error.message) },
                  )
                }
              >
                <CopyIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {readOnly && (
        <Alert color="green" icon={<CheckCircleIcon aria-hidden />}>
          Document définitif : il ne peut plus être modifié. Ses pièces jointes restent modifiables.
        </Alert>
      )}
      {isQuote && readOnly && document.invoicedNet !== null && document.invoicedNet !== undefined && (
        <Text size="sm">
          Déjà facturé : <b>{formatMoney(Math.round(document.invoicedNet * 100), currency)}</b> HT sur {formatMoney(Math.round(document.totalNet * 100), currency)} HT
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
              <FilePreview url={pdfUrl(document.id)} name={`${DOCUMENT_TYPE_LABELS[document.type]} ${document.number ?? ''}`} kind="pdf" height="max(36rem, calc(100dvh - 16rem))" />
            </Paper>
          ) : (
          <Stack gap="md">
            <Section title="Client et dates">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Select
                  label="Client"
                  required
                  searchable
                  readOnly={readOnly}
                  data={clients.map((item) => ({ value: item.id, label: item.name }))}
                  {...form.getInputProps('clientId')}
                  onChange={(clientId) => clientId && form.setValues({ clientId, serviceId: null, contactId: null, projectId: null })}
                />
                <Select
                  label="Projet"
                  clearable
                  searchable
                  readOnly={readOnly}
                  placeholder="Aucun"
                  {...treeSelectProps(projectOptions(workspace, projects))}
                  {...form.getInputProps('projectId')}
                />
                <Select
                  label="Service"
                  clearable
                  readOnly={readOnly}
                  placeholder="Aucun"
                  data={(client?.services ?? []).map((service) => ({ value: service.id, label: service.name }))}
                  {...form.getInputProps('serviceId')}
                />
                <Select
                  label="Contact"
                  clearable
                  readOnly={readOnly}
                  placeholder="Aucun"
                  data={(client?.contacts ?? [])
                    .filter((contact) => !values.serviceId || !contact.serviceId || contact.serviceId === values.serviceId)
                    .map((contact) => ({ value: contact.id, label: `${contact.firstName} ${contact.lastName}` }))}
                  {...form.getInputProps('contactId')}
                />
                <DatePickerInput
                  label="Date du document"
                  required
                  readOnly={readOnly}
                  valueFormat="D MMM YYYY"
                  // Not before the latest document of its type (models of recurring invoices are dated later).
                  minDate={document.status === 'DRAFT' ? (latestDate ?? undefined) : undefined}
                  description={document.status === 'DRAFT' && latestDate ? `Pas avant le ${printedDay(latestDate)}, date du dernier document de ce type.` : undefined}
                  {...form.getInputProps('issueDate')}
                />
                <DatePickerInput
                  label={isQuote ? 'Valable jusqu’au' : 'Échéance'}
                  clearable
                  readOnly={readOnly}
                  valueFormat="D MMM YYYY"
                  {...form.getInputProps('dueDate')}
                />
                <DatePickerInput label="Début de la prestation" clearable readOnly={readOnly} valueFormat="D MMM YYYY" {...form.getInputProps('serviceStart')} />
                <DatePickerInput label="Fin de la prestation" clearable readOnly={readOnly} valueFormat="D MMM YYYY" {...form.getInputProps('serviceEnd')} />
              </SimpleGrid>
            </Section>

            <Section title="Contenu">
              <TextInput label="Objet" readOnly={readOnly} {...form.getInputProps('title')} />
              <Group gap="sm" align="flex-end" grow>
                <TextInput label="Libellé de la référence" readOnly={readOnly} {...form.getInputProps('referenceLabel')} />
                <TextInput label="Référence du client" readOnly={readOnly} {...form.getInputProps('referenceValue')} />
              </Group>
              <Textarea label="Introduction" autosize minRows={2} readOnly={readOnly} {...form.getInputProps('introduction')} />
              <Divider label="Lignes" labelPosition="left" />
              <LinesEditor
                lines={values.lines}
                totals={totals.lines}
                onChange={(lines) => form.setFieldValue('lines', lines)}
                readOnly={readOnly}
                vatApplicable={values.vatApplicable}
                currency={currency}
                errors={form.errors}
                extraActions={
                  <>
                    {canBillTime && (
                      <Button size="xs" variant="light" color="teal" leftSection={<ClockIcon aria-hidden />} onClick={openTimeBilling}>
                        Temps passé
                      </Button>
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
                    <ClockIcon aria-hidden /> {billedIds.length} temps facturé{billedIds.length > 1 ? 's' : ''} ({formatDuration(billedIds.reduce((sum, id) => sum + (timeSeconds.get(id) ?? 0), 0))}
                    ) : ils sont marqués facturés {readOnly ? 'par ce document' : 'à l’enregistrement'}.
                  </Text>
                  {canBillTime && (
                    <Button size="compact-xs" variant="subtle" color="gray" onClick={() => form.setFieldValue('timeEntryIds', [])}>
                      Détacher le temps
                    </Button>
                  )}
                </Group>
              )}
              <Textarea label="Conclusion" autosize minRows={2} readOnly={readOnly} {...form.getInputProps('conclusion')} />
            </Section>

            <Section title="Conditions et mentions">
              {isQuote && (
                <Autocomplete
                  label="Mode de facturation"
                  placeholder="Au mois, tous les 5 du mois…"
                  description="Choisissez ou complétez."
                  readOnly={readOnly}
                  data={BILLING_SCHEDULE_PRESETS}
                  {...form.getInputProps('billingSchedule')}
                />
              )}
              {document.type !== 'CREDIT_NOTE' && (
                <Autocomplete
                  label="Conditions de règlement"
                  placeholder="À réception"
                  readOnly={readOnly}
                  data={PAYMENT_TERMS_PRESETS}
                  {...form.getInputProps('paymentTerms')}
                  onChange={(paymentTerms) => {
                    // The terms give the due date of an invoice.
                    const dueDate = isQuote ? null : dueDateForTerms(paymentTerms, values.issueDate);
                    form.setValues({ paymentTerms, ...(dueDate && { dueDate }) });
                  }}
                />
              )}
              <Autocomplete label="Mode de règlement" placeholder="Virement bancaire" readOnly={readOnly} data={PAYMENT_METHOD_PRESETS} {...form.getInputProps('paymentMethods')} />
              {isQuote && (
                <Group gap={4} align="flex-end" wrap="nowrap">
                  <NumberInput
                    label="Acompte à la commande"
                    placeholder="Aucun"
                    min={0}
                    decimalScale={2}
                    decimalSeparator=","
                    thousandSeparator=" "
                    readOnly={readOnly}
                    style={{ flex: 1 }}
                    error={form.errors.depositValue}
                    description={
                      values.depositType && values.depositValue
                        ? `Soit ${formatMoney(depositAmount(values.depositType, values.depositValue, totals.totalGross), currency)}${values.vatApplicable ? ' TTC' : ''}`
                        : undefined
                    }
                    value={values.depositValue ?? ''}
                    onChange={(value) =>
                      form.setValues({
                        depositValue: typeof value === 'number' && value > 0 ? value : null,
                        depositType: typeof value === 'number' && value > 0 ? (values.depositType ?? 'PERCENT') : null,
                      })
                    }
                  />
                  <SegmentedControl
                    aria-label="Type d’acompte"
                    readOnly={readOnly}
                    data={[
                      { value: 'PERCENT', label: '%' },
                      { value: 'AMOUNT', label: currency === 'EUR' ? '€' : currency },
                    ]}
                    value={values.depositType ?? 'PERCENT'}
                    onChange={(type) => form.setFieldValue('depositType', type as FormValues['depositType'])}
                  />
                </Group>
              )}
              {document.type !== 'CREDIT_NOTE' && (
                <Autocomplete label="Intérêts de retard" placeholder="Taux d’intérêt légal en vigueur" readOnly={readOnly} data={LATE_INTEREST_PRESETS} {...form.getInputProps('lateInterest')} />
              )}
              {document.type !== 'CREDIT_NOTE' && client?.kind === 'COMPANY' && (
                <Text size="xs" c="dimmed">
                  Client professionnel : l’indemnité forfaitaire de 40 € pour frais de recouvrement est ajoutée au document.
                </Text>
              )}
              <Textarea label="Autres mentions" autosize minRows={2} readOnly={readOnly} {...form.getInputProps('otherMentions')} />
              <Group gap="lg">
                <Switch label="Afficher le RIB" disabled={readOnly} {...form.getInputProps('showBankDetails', { type: 'checkbox' })} />
                <Switch
                  label="TVA non applicable"
                  disabled={readOnly}
                  checked={!values.vatApplicable}
                  onChange={(event) => form.setFieldValue('vatApplicable', !event.currentTarget.checked)}
                />
              </Group>
            </Section>
          </Stack>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            {readOnly && <TrackingPanel document={document} onRemind={() => openDocumentMail(true)} remindPending={preparingMail} />}
            <Section title="Totaux">
              {!readOnly && (
                <Group gap={4} align="flex-end" wrap="nowrap">
                  <NumberInput
                    label="Remise générale"
                    min={0}
                    decimalScale={2}
                    decimalSeparator=","
                    style={{ flex: 1 }}
                    error={form.errors.globalDiscountValue}
                    value={values.globalDiscountValue ?? ''}
                    onChange={(value) =>
                      form.setValues({
                        globalDiscountValue: typeof value === 'number' && value > 0 ? value : null,
                        globalDiscountType: typeof value === 'number' && value > 0 ? (values.globalDiscountType ?? 'PERCENT') : null,
                      })
                    }
                  />
                  <SegmentedControl
                    aria-label="Type de remise générale"
                    data={[
                      { value: 'PERCENT', label: '%' },
                      { value: 'AMOUNT', label: '€' },
                    ]}
                    value={values.globalDiscountType ?? 'PERCENT'}
                    onChange={(type) => form.setFieldValue('globalDiscountType', type as FormValues['globalDiscountType'])}
                  />
                </Group>
              )}
              <Table withRowBorders={false} verticalSpacing={4}>
                <Table.Tbody>
                  <TotalRow label="Total articles HT" value={totals.itemsNet} currency={currency} />
                  {totals.globalDiscount > 0 && <TotalRow label="Remise générale" value={-totals.globalDiscount} currency={currency} />}
                  {totals.deductions > 0 && <TotalRow label="Déjà facturé" value={-totals.deductions} currency={currency} />}
                  <TotalRow label="Total HT" value={totals.totalNet} currency={currency} strong />
                  {values.vatApplicable ? (
                    totals.vat.map((item) => (
                      <TotalRow key={item.rate} label={`TVA ${item.rate.toLocaleString('fr-FR')} % sur ${formatMoney(item.base, currency)}`} value={item.vat} currency={currency} />
                    ))
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
            </Section>
            <AttachmentsSection document={document} />
            {document.derived.length > 0 && (
              <Section title="Documents liés">
                {document.derived.map((item) => (
                  <Group key={item.id} justify="space-between">
                    <Anchor component={Link} to={`/accounting/${item.id}`} size="sm">
                      {DOCUMENT_TYPE_LABELS[item.type]} {item.number ?? '(brouillon)'}
                    </Anchor>
                    <Text size="sm" ff="monospace">
                      {formatMoney(Math.round(item.totalGross * 100), currency)}
                    </Text>
                  </Group>
                ))}
              </Section>
            )}
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
          {formatMoney(value, currency)}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Files attached to a document (signed quote, purchase order, specifications…).
 * @param {{ document: AccountingDocument }} props Component props.
 * @returns {JSX.Element} Section.
 */
function AttachmentsSection({ document }: { document: AccountingDocument }) {
  const { addAttachments, removeAttachment } = useDocumentMutations();
  return (
    <Section
      title="Pièces jointes"
      actions={
        <FileButton
          multiple
          onChange={(files) =>
            files.length &&
            addAttachments.mutate({ id: document.id, files }, { onSuccess: () => notifySuccess('Fichiers joints.'), onError: (error) => notifyError(error.message) })
          }
        >
          {(props) => (
            <Button size="xs" variant="light" leftSection={<UploadSimpleIcon aria-hidden />} loading={addAttachments.isPending} {...props}>
              Joindre
            </Button>
          )}
        </FileButton>
      }
    >
      {document.attachments.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucune pièce jointe.
        </Text>
      ) : (
        document.attachments.map((attachment) => (
          <Group key={attachment.id} justify="space-between" wrap="nowrap">
            <FileLink url={attachment.url} name={attachment.name} size="sm" truncate>
              <Group gap={4} wrap="nowrap">
                <PaperclipIcon aria-hidden /> {attachment.name}
              </Group>
            </FileLink>
            <Tooltip label="Retirer">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Retirer ${attachment.name}`}
                onClick={() => removeAttachment.mutate(attachment.id, { onError: (error) => notifyError(error.message) })}
              >
                <XIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))
      )}
      <Text size="xs" c="dimmed">
        <FileArrowDownIcon aria-hidden /> Joints aux mails d’envoi du document.
      </Text>
    </Section>
  );
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

/**
 * Printed calendar date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} "09/11/2026".
 */
const printedDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * Accounting document page: editable draft (or recurring model), read-only final document with the
 * documents that can be created from it.
 * @param {{ id: string }} props Document id.
 * @returns {JSX.Element} Page.
 */
export function DocumentEditor({ id }: { id: string }) {
  const { data: document, isPending, error } = useAccountingDocument(id);
  if (isPending) return <Skeleton height={500} />;
  if (error || !document) return <Alert color="red">{error?.message ?? 'Document introuvable.'}</Alert>;
  // A validated document is shown again, read only.
  return <Editor key={`${document.id}-${document.status}`} document={document} />;
}
