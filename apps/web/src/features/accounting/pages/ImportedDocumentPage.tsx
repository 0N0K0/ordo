import { IconAction } from '../../../components/actions/IconAction';
import { NO_TARGETS } from '../../../components/markdown/remark-references';

import { DetailSkeleton } from '../../../components/feedback/Skeletons';
import { Badge, Box, Button, Grid, Group, Paper, Stack, Text } from '@mantine/core';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { DownloadSimpleIcon, FileXIcon, PencilSimpleIcon, PaperclipIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, useSetArchived } from '../../../lib/archive';
import { accountingQueryKey } from '../api';
import { useParams } from 'react-router';

import { FilePreview } from '../../files/components/FilePreview';
import { downloadUrl, viewableKind } from '../../files/lib/viewable';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { useImportedDocument, useImportedDocumentMutations } from '../api/documents';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { openImportForm } from '../lib/imported-form';
import { DOCUMENT_TYPE_LABELS, isFeminineDocumentType } from '../lib/labels';
import { StatusMenu } from '../components/TrackingBadge';
import { chooseTrackingStatus } from '../lib/sent-dialog';
import * as fmt from '../../../lib/format';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { Comments } from '../../comments/components/Comments';
import { DetailHeader } from '../../../components/page/DetailHeader';

/**
 * Page of a document issued before Ordo: its file shown in place (a PDF or an image, like the documents made in
 * Ordo), its information, its tracking status and settlement; edited in the import form, archived (then read only) or
 * restored.
 * @returns {JSX.Element} Page.
 */
export function ImportedDocumentPage() {
  const { id = '' } = useParams();
  const { data: document, isLoading } = useImportedDocument(id);
  const { setStatus, markSent } = useImportedDocumentMutations();
  const setArchived = useSetArchived('IMPORTED_DOCUMENT', [accountingQueryKey]);

  if (isLoading) {
    return <DetailSkeleton fields={6} />;
  }
  if (!document) return <DetailNotFound what="Ce document" backTo="/accounting" backLabel="Facturation" />;

  const kind = document.fileUrl ? viewableKind({ url: document.fileUrl, name: document.fileName, mimeType: document.fileMimeType }) : null;
  const money = (amount: number) => fmt.money(amount, document.currency);
  const facts: [string, string | null][] = [
    ['Client', document.clientName || null],
    ['Date', fmt.day(document.issueDate)],
    [document.type === 'QUOTE' ? 'Valable jusqu’au' : 'Échéance', document.dueDate ? fmt.day(document.dueDate) : null],
    ['Total HT', money(document.totalNet)],
    ['TVA', money(document.totalVat)],
    ['Total TTC', money(document.totalGross)],
  ];

  return (
    <Stack gap="md">
      <DetailHeader
        back={{ to: '/accounting', label: 'Facturation' }}
        order={1}
        title={`${DOCUMENT_TYPE_LABELS[document.type]} ${document.number}`}
        badges={
          <>
            <Badge variant="light" color="cyan">
              Importé
            </Badge>
            {document.archived && <ArchivedBadge />}
          </>
        }
        subtitle={document.label && <Text c="dimmed">{document.label}</Text>}
        actions={
          <>
            {document.fileUrl && (
              <IconAction label="Télécharger le fichier" component="a" href={downloadUrl(document.fileUrl)} variant="default" size="lg">
                <DownloadSimpleIcon aria-hidden />
              </IconAction>
            )}
            {!document.archived && (
              <Button variant="default" leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openImportForm(document)}>
                Modifier
              </Button>
            )}
          </>
        }
        menu={{
          name: `« ${document.number} »`,
          items: [
            archiveEntry({ archived: document.archived, type: DOCUMENT_TYPE_LABELS[document.type], name: document.number, feminine: isFeminineDocumentType(document.type) }, setArchived, document.id),
          ],
        }}
      />

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            {document.fileUrl && kind ? (
              <FilePreview url={document.fileUrl} name={document.fileName ?? document.number} kind={kind} height="max(36rem, calc(100dvh - 16rem))" />
            ) : (
              <Box p="xl">
                <EmptyState
                  plain
                  icon={<FileXIcon aria-hidden />}
                  message={document.fileUrl ? 'Ce fichier ne peut pas être affiché ici.' : 'Aucun fichier joint.'}
                  action={
                    document.fileUrl ? (
                      <Button component="a" href={downloadUrl(document.fileUrl)} variant="default" leftSection={<DownloadSimpleIcon aria-hidden />}>
                        Télécharger {document.fileName}
                      </Button>
                    ) : (
                      !document.archived && (
                        <Button variant="default" leftSection={<PaperclipIcon aria-hidden />} onClick={() => openImportForm(document)}>
                          Joindre le fichier
                        </Button>
                      )
                    )
                  }
                />
              </Box>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <SettingsSection title="Suivi">
              <Group gap="xs">
                <StatusMenu
                  type={document.type}
                  current={document.trackingStatus}
                  pending={setStatus.isPending}
                  readOnly={document.archived}
                  onSelect={(status) => chooseTrackingStatus(document, status, { setStatus, markSent })}
                />
                {document.type !== 'QUOTE' && (
                  <Badge variant="light" color={document.balance ? 'orange' : 'green'}>
                    {document.balance ? `Reste ${money(document.balance)}` : 'Réglé'}
                  </Badge>
                )}
              </Group>
            </SettingsSection>
            <SettingsSection title="Informations">
              <Stack gap={6}>
                {facts.map(([label, value]) =>
                  value ? (
                    <Group key={label} justify="space-between" wrap="nowrap">
                      <Text size="sm" c="dimmed">
                        {label}
                      </Text>
                      <Text size="sm" ta="right">
                        {value}
                      </Text>
                    </Group>
                  ) : null,
                )}
                {document.note && <MarkdownView targets={NO_TARGETS}>{document.note}</MarkdownView>}
              </Stack>
            </SettingsSection>
            <Comments target="IMPORTED_DOCUMENT" id={document.id} readOnly={document.archived} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
