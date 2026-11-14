import {
  Button,
  Checkbox,
  FileInput,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  ACCOUNTING_DOCUMENT_TYPES,
  importedDocumentSchema,
  type AccountingDocumentType,
} from '@ordo/shared';
import { FilePdfIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useWorkspace } from '../workspace/api';
import {
  useImportedDocumentMutations,
  type ImportedDocument,
} from './documents-api';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { projectOptions } from '../workspace/tree';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { AmountInput } from '../../components/AmountInput';

interface FormValues extends Record<string, unknown> {
  type: AccountingDocumentType;
  number: string;
  issueDate: string;
  dueDate: string | null;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  title: string;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  currency: string;
  note: string;
  settled: boolean;
}

/**
 * Import of a quote or an invoice issued before Ordo: type, number, dates, client, project, totals and file.
 * Its lines are not imported: the file is the document.
 * @param {{ document?: ImportedDocument, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ImportedDocumentForm({
  document,
  onDone,
}: {
  document?: ImportedDocument;
  onDone: () => void;
}) {
  const { data: workspace } = useWorkspace();
  const { create, update } = useImportedDocumentMutations();
  const [file, setFile] = useState<File | null>(null);
  const form = useAppForm<FormValues>({
    initialValues: {
      type: document?.type ?? 'INVOICE',
      number: document?.number ?? '',
      issueDate: document ? String(document.issueDate) : localToday(),
      dueDate: document?.dueDate ? String(document.dueDate) : null,
      clientId: document?.clientId ?? null,
      clientName: document && !document.clientId ? document.clientName : '',
      projectId: document?.projectId ?? null,
      title: document?.title ?? '',
      totalNet: document?.totalNet ?? 0,
      totalVat: document?.totalVat ?? 0,
      totalGross: document?.totalGross ?? 0,
      currency: document?.currency ?? 'EUR',
      note: document?.note ?? '',
      // Documents issued before Ordo are mostly settled already.
      settled: document?.settled ?? true,
    },
    schema: importedDocumentSchema,
  });
  const values = form.values;
  const projects = (workspace?.projects ?? []).filter(
    (project) =>
      !project.archived &&
      (!values.clientId || project.clientId === values.clientId),
  );

  const handleSubmit = form.onSubmit((input) => {
    const callbacks = {
      onSuccess: () => {
        notifySuccess(
          document ? 'Document importé modifié.' : 'Document importé.',
        );
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    const payload = {
      ...input,
      clientName: input.clientId ? null : input.clientName,
    };
    if (document)
      update.mutate({ id: document.id, input: payload, file }, callbacks);
    else create.mutate({ input: payload, file }, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Pour garder la trace d’un devis ou d’une facture émis ailleurs : ses
          informations principales et son PDF, sans ses lignes.
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
          <TextInput
            label="Numéro"
            required
            data-autofocus
            {...form.getInputProps('number')}
          />
          <TextInput label="Objet" {...form.getInputProps('title')} />
          <DatePickerInput
            label="Date"
            required
            {...form.getInputProps('issueDate')}
          />
          <DatePickerInput
            label={values.type === 'QUOTE' ? 'Valable jusqu’au' : 'Échéance'}
            clearable
            {...form.getInputProps('dueDate')}
          />
          <Select
            label="Devise"
            data={['EUR', 'CHF', 'USD', 'GBP', 'CAD']}
            allowDeselect={false}
            {...form.getInputProps('currency')}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Client"
            clearable
            searchable
            placeholder="Client d’Ordo"
            data={(workspace?.clients ?? []).map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            {...form.getInputProps('clientId')}
            onChange={(clientId) =>
              form.setValues({ clientId, projectId: null })
            }
          />
          {values.clientId ? (
            <Select
              label="Projet"
              clearable
              searchable
              placeholder="Aucun"
              {...treeSelectProps(projectOptions(workspace, projects))}
              {...form.getInputProps('projectId')}
            />
          ) : (
            <TextInput
              label="Ou nom du client"
              placeholder="S’il n’est pas dans Ordo"
              {...form.getInputProps('clientName')}
            />
          )}
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <AmountInput
            label="Total HT"
            {...form.getInputProps('totalNet')}
            onChange={(value) => {
              const totalNet = typeof value === 'number' ? value : 0;
              form.setValues({
                totalNet,
                totalGross:
                  Math.round((totalNet + values.totalVat) * 100) / 100,
              });
            }}
          />
          <AmountInput
            label="TVA"
            {...form.getInputProps('totalVat')}
            onChange={(value) => {
              const totalVat = typeof value === 'number' ? value : 0;
              form.setValues({
                totalVat,
                totalGross:
                  Math.round((values.totalNet + totalVat) * 100) / 100,
              });
            }}
          />
          <AmountInput
            label="Total TTC"
            description="Débours compris"
            {...form.getInputProps('totalGross')}
          />
        </SimpleGrid>
        <FileInput
          label="Document"
          placeholder={document?.fileName ?? 'PDF du devis ou de la facture'}
          description={
            document?.fileName
              ? 'Choisir un fichier remplace le document actuel.'
              : undefined
          }
          leftSection={<FilePdfIcon aria-hidden />}
          accept="application/pdf,image/*"
          clearable
          value={file}
          onChange={setFile}
        />
        <Textarea
          label="Note"
          autosize
          minRows={2}
          {...form.getInputProps('note')}
        />
        {values.type !== 'QUOTE' && (
          <Checkbox
            label="Déjà réglée hors trésorerie"
            description="Décochez pour l’attendre dans le prévisionnel et le rattacher aux mouvements de trésorerie qui le règlent."
            {...form.getInputProps('settled', { type: 'checkbox' })}
          />
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {document ? 'Enregistrer' : 'Importer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
