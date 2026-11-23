import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';
import { Checkbox, Fieldset, FileInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DateField } from '../../../components/inputs/DateField';
import { ACCOUNTING_DOCUMENT_TYPES, type AccountingDocumentType, importedDocumentSchema, round2 } from '@ordo/shared';
import { FilePdfIcon, FileArrowUpIcon } from '@phosphor-icons/react';
import { parisToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { useCachedItem } from '../../../lib/mutation';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { accountingQueryKey } from '../api';

import { useProjectTree } from '../../projects/api';
import { useImportedDocumentMutations, type ImportedDocument } from '../api/documents';
import { DOCUMENT_TYPE_LABELS } from '../lib/labels';
import { clientProjectOptions } from '../../projects/lib/tree';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { FormActions } from '../../../components/dialogs/FormActions';
import { ClientSelect } from '../../projects/components/ClientSelect';

interface FormValues extends Record<string, unknown> {
  type: AccountingDocumentType;
  number: string;
  issueDate: string;
  dueDate: string | null;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  label: string;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  currency: string;
  note: string;
  settled: boolean;
  /** File chosen (null: the current one kept); not a field of the document. */
  file: File | null;
}

/** Fields of an imported document saved on leaving them, in its panel: texts and amounts. */
const ON_BLUR = ['number', 'label', 'clientName', 'note', 'totalNet', 'totalVat', 'totalGross'] as const;

/** Totals: saved together on leaving one of them (HT and TVA give the TTC). */
const TOTALS = ['totalNet', 'totalVat', 'totalGross'] as const;

/**
 * Values of the form of an imported document, as it is (a new one: an invoice of today, settled).
 * @param {ImportedDocument} [document] Imported document, as the cache holds it. Optional.
 * @returns {FormValues} Values.
 */
const importedValues = (document?: ImportedDocument): FormValues => ({
  type: document?.type ?? 'INVOICE',
  number: document?.number ?? '',
  issueDate: document ? document.issueDate : parisToday(),
  dueDate: document?.dueDate ? document.dueDate : null,
  clientId: document?.clientId ?? null,
  clientName: document && !document.clientId ? document.clientName : '',
  projectId: document?.projectId ?? null,
  label: document?.label ?? '',
  totalNet: document?.totalNet ?? 0,
  totalVat: document?.totalVat ?? 0,
  totalGross: document?.totalGross ?? 0,
  currency: document?.currency ?? 'EUR',
  note: document?.note ?? '',
  // Documents issued before Ordo are mostly settled already.
  settled: document?.settled ?? true,
  file: null,
});

/**
 * Input of the API from the values of the form (without the file): the free client name only without a client of Ordo.
 * @param {FormValues} values Values.
 * @returns {Omit<FormValues, 'file' | 'clientName'> & { clientName: string | null }} Input.
 */
const importedInput = (values: FormValues) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { file: _file, ...input } = values;
  return { ...input, clientName: values.clientId ? null : values.clientName };
};

/**
 * Imported document of the cache, whatever query holds it (the list, the page of the document).
 * @param {ImportedDocument[] | ImportedDocument | null} data Data of a query.
 * @returns {readonly ImportedDocument[]} Documents.
 */
const importedOf = (data: ImportedDocument[] | ImportedDocument | null): readonly ImportedDocument[] => (Array.isArray(data) ? data : data ? [data] : []);

/**
 * Import of a quote or an invoice issued before Ordo: type, number, dates, client, project, totals and file.
 * Its lines are not imported: the file is the document. A new import is a form with « Importer »; an existing one, its
 * panel, saves each field as soon as it changes (texts and amounts on leaving them, `useFieldSave`), a
 * file chosen too, the one of the cache followed; archived, it is read only.
 * @param {{ document?: ImportedDocument, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ImportedDocumentForm({ document, onDone }: { document?: ImportedDocument; onDone: () => void }) {
  const { data: workspace } = useProjectTree();
  const { create, update } = useImportedDocumentMutations();
  const base = useAppForm<FormValues>({
    initialValues: importedValues(document),
    schema: importedDocumentSchema,
  });
  const cached = useCachedItem([...accountingQueryKey, 'imported'], importedOf, (item: ImportedDocument) => item.id === document?.id);
  const current = document && (cached ?? document);
  const readOnly = Boolean(current?.archived);
  // A file chosen is sent with the values, once (it replaces the current one).
  const { form, saving, commit, fieldProps } = useFieldSave(base, {
    save: document ? (changes, values) => update.mutateAsync({ id: document.id, input: importedInput(values), file: changes.file ?? null }) : null,
    schema: importedDocumentSchema,
    saved: current && importedValues(current),
    onBlur: ON_BLUR,
    readOnly,
  });
  const values = form.values;

  // A new import only: an existing document is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((input) => create.mutate({ input: importedInput(input), file: input.file }, formCallbacks(form, 'Document importé.', onDone)));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {document && !readOnly && <SaveStatus saving={saving} />}
          <Text size="sm" c="dimmed">
            Pour garder la trace d’un devis ou d’une facture émis ailleurs : ses informations principales et son PDF, sans ses lignes.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Select
              label="Type"
              data={ACCOUNTING_DOCUMENT_TYPES.map((type) => ({
                value: type,
                label: DOCUMENT_TYPE_LABELS[type],
              }))}
              allowDeselect={false}
              {...form.getInputProps('type')}
            />
            <TextInput label="Numéro" required data-autofocus={document ? undefined : true} {...form.getInputProps('number')} />
            <TextInput label="Objet" {...form.getInputProps('label')} />
            <DateField label="Date" required {...form.getInputProps('issueDate')} />
            <DateField label={values.type === 'QUOTE' ? 'Valable jusqu’au' : 'Échéance'} clearable {...form.getInputProps('dueDate')} />
            <Select label="Devise" data={['EUR', 'CHF', 'USD', 'GBP', 'CAD']} allowDeselect={false} {...form.getInputProps('currency')} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <ClientSelect clearable placeholder="Client d’Ordo" {...form.getInputProps('clientId')} onChange={(clientId) => form.setValues({ clientId, projectId: null })} />
            {values.clientId ? (
              <Select
                label="Projet"
                clearable
                searchable
                placeholder="Aucun"
                {...treeSelectProps(
                  clientProjectOptions(workspace, values.clientId ?? null, {
                    anyWhenNoClient: true,
                  }),
                )}
                {...form.getInputProps('projectId')}
              />
            ) : (
              <TextInput label="Ou nom du client" placeholder="S’il n’est pas dans Ordo" {...form.getInputProps('clientName')} />
            )}
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <AmountInput
              label="Total HT"
              currency={values.currency}
              {...form.getInputProps('totalNet')}
              onBlur={() => commit(TOTALS)}
              onChange={(value) => {
                const totalNet = typeof value === 'number' ? value : 0;
                form.setValues({
                  totalNet,
                  totalGross: round2(totalNet + values.totalVat),
                });
              }}
            />
            <AmountInput
              label="TVA"
              currency={values.currency}
              {...form.getInputProps('totalVat')}
              onBlur={() => commit(TOTALS)}
              onChange={(value) => {
                const totalVat = typeof value === 'number' ? value : 0;
                form.setValues({
                  totalVat,
                  totalGross: round2(values.totalNet + totalVat),
                });
              }}
            />
            <AmountInput label="Total TTC" currency={values.currency} description="Débours compris" {...form.getInputProps('totalGross')} onBlur={() => commit(TOTALS)} />
          </SimpleGrid>
          <FileInput
            label="Document"
            placeholder={document?.filename ?? 'PDF du devis ou de la facture'}
            description={document?.filename ? 'Choisir un fichier remplace le document actuel.' : undefined}
            leftSection={<FilePdfIcon aria-hidden />}
            accept="application/pdf,image/*"
            clearable
            {...form.getInputProps('file')}
          />
          <MarkdownEditor label="Description" {...fieldProps('note')} suggestions={NO_SUGGESTIONS} minRows={2} />
          {values.type !== 'QUOTE' && (
            <Checkbox
              label="Déjà réglée hors trésorerie"
              description="Décochez pour l’attendre dans le prévisionnel et le rattacher aux mouvements de trésorerie qui le règlent."
              {...form.getInputProps('settled', { type: 'checkbox' })}
            />
          )}
          {!document && <FormActions onCancel={onDone} submitLabel="Importer" submitIcon={<FileArrowUpIcon aria-hidden />} loading={create.isPending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}
