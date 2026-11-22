import { Stack } from '@mantine/core';
import { ColumnDefaults } from '../../../components/data-table/views/ColumnDefaults';
import { useDocumentColumns, type DocumentRow } from '../hooks/use-document-columns';
import { DOCUMENT_TABS, documentsTableKey } from '../lib/labels';
import { BILLING_COLUMNS, catalogColumns, OVERDUE_COLUMNS, RECURRING_COLUMNS } from '../lib/accounting-columns';

/** No row: the columns of the tables of documents, in the settings. */
const NO_ROWS: readonly DocumentRow[] = [];

/** No comment counted: the columns of the catalogue, in the settings. */
const NO_COMMENTS = new Map<string, number>();

/**
 * Columns of new views of the tables of a project or a client: its accounting documents.
 * @returns {JSX.Element} Section.
 */
export function ProjectDocumentsColumnDefaults() {
  const columns = useDocumentColumns(NO_ROWS, { showType: true });
  return <ColumnDefaults tableKey="project-documents" columns={columns} label="Documents d’un projet ou d’un client" />;
}

/**
 * Columns of new views of every table of the accounting: the documents of each type, those to send, the invoices to
 * remind, the recurring invoices, the catalogue, the time to bill, the documents of a project or a client.
 * @returns {JSX.Element} Sections.
 */
export function AccountingColumnDefaults() {
  const byType = useDocumentColumns(NO_ROWS, {});
  const toSend = useDocumentColumns(NO_ROWS, { showType: true });
  return (
    <Stack gap="md">
      {DOCUMENT_TABS.map((tab) => (
        <ColumnDefaults key={tab.value} tableKey={documentsTableKey(tab.value)} columns={byType} label={tab.label} />
      ))}
      <ColumnDefaults tableKey="documents-to-send" columns={toSend} label="À envoyer" />
      <ColumnDefaults tableKey="overdue-invoices" columns={OVERDUE_COLUMNS} label="À relancer" />
      <ColumnDefaults tableKey="recurring-invoices" columns={RECURRING_COLUMNS} label="Récurrentes" />
      <ColumnDefaults tableKey="catalog" columns={catalogColumns(NO_COMMENTS)} label="Catalogue" />
      <ColumnDefaults tableKey="time-billing" columns={BILLING_COLUMNS} label="Temps à facturer" />
      <ProjectDocumentsColumnDefaults />
    </Stack>
  );
}
