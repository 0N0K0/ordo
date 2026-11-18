import { NO_TARGETS } from '../../../components/markdown/remark-references';
import { BackLink } from '../../../components/page/BackLink';
import { DetailSkeleton } from '../../../components/feedback/Skeletons';
import { ActionIcon, Badge, Box, Button, Grid, Group, Paper, Stack, Text, Title, Tooltip } from '@mantine/core';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ArchiveIcon, ArrowCounterClockwiseIcon, DownloadSimpleIcon, FileXIcon, PencilSimpleIcon, PaperclipIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { archiveWithUndo, useSetArchived } from '../../../lib/archive';
import { accountingQueryKey } from '../api';
import { useParams } from 'react-router';
import { onMutationError } from '../../../lib/notify';
import { FilePreview } from '../../files/components/FilePreview';
import { downloadUrl, viewableKind } from '../../files/lib/viewable';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { useImportedDocument, useImportedDocumentMutations } from '../api/documents';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { openImportForm } from '../lib/imported-form';
import { DOCUMENT_TYPE_LABELS } from '../lib/labels';
import { StatusMenu } from '../components/TrackingBadge';
import { openSentDialog } from '../lib/sent-dialog';
import * as fmt from '../../../lib/format';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { Comments } from '../../comments/components/Comments';

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
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <BackLink to="/accounting">Facturation</BackLink>
          <Group gap="xs">
            <Title order={1} size="h3">
              {DOCUMENT_TYPE_LABELS[document.type]} {document.number}
            </Title>
            <Badge variant="light" color="cyan">
              Importé
            </Badge>
            {document.archived && <ArchivedBadge />}
          </Group>
          {document.title && <Text c="dimmed">{document.title}</Text>}
        </Stack>
        <Group gap="xs" wrap="nowrap">
          {document.fileUrl && (
            <Tooltip label="Télécharger le fichier">
              <ActionIcon component="a" href={downloadUrl(document.fileUrl)} variant="default" size="lg" aria-label="Télécharger le fichier">
                <DownloadSimpleIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
          {!document.archived && (
            <Button variant="default" leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openImportForm(document)}>
              Modifier
            </Button>
          )}
          <Button
            variant="default"
            leftSection={document.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
            loading={setArchived.isPending}
            onClick={() => void archiveWithUndo(setArchived, { ids: [document.id], archived: !document.archived, label: `« ${document.number} »` })}
          >
            {document.archived ? 'Restaurer' : 'Archiver'}
          </Button>
        </Group>
      </Group>

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
                  onSelect={(status) =>
                    // A "sent" status asks when and how it was sent.
                    status.category === 'SENT'
                      ? openSentDialog({
                          title: `Envoi de ${document.number}`,
                          sentAt: document.sentAt,
                          sentVia: document.sentVia,
                          onSubmit: ({ date, via }) => markSent.mutateAsync({ id: document.id, date, via, statusId: status.id }),
                        })
                      : setStatus.mutate({ id: document.id, statusId: status.id }, { onError: onMutationError })
                  }
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
