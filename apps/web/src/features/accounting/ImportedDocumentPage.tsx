import { ActionIcon, Anchor, Badge, Button, Grid, Group, Paper, Skeleton, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { formatMoney } from '@ordo/shared';
import { ArrowLeftIcon, DownloadSimpleIcon, FileXIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router';
import { notifyError } from '../../lib/notify';
import { FilePreview } from '../files/FilePreview';
import { downloadUrl, viewableKind } from '../files/viewable';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { useImportedDocument, useImportedDocumentMutations } from './documents-api';
import { Section } from './EditorSection';
import { openImportForm } from './imported-form';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { StatusMenu } from './TrackingBadge';
import { openSentDialog } from './sent-dialog';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

/**
 * Printed calendar date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Date.
 */
const printed = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * Page of a document issued before Ordo: its file shown in place (a PDF or an image, like the documents made in
 * Ordo), its information, its tracking status and settlement; edited in the import form.
 * @returns {JSX.Element} Page.
 */
export function ImportedDocumentPage() {
  const { id = '' } = useParams();
  const { data: document, isLoading } = useImportedDocument(id);
  const { setStatus, markSent } = useImportedDocumentMutations();

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton h={36} w={320} />
        <Skeleton h="70vh" />
      </Stack>
    );
  }
  if (!document) return <NotFoundPage />;

  const kind = document.fileUrl ? viewableKind({ url: document.fileUrl, name: document.fileName, mimeType: document.fileMimeType }) : null;
  const money = (amount: number) => formatMoney(Math.round(amount * 100), document.currency);
  const facts: [string, string | null][] = [
    ['Client', document.clientName || null],
    ['Date', printed(String(document.issueDate))],
    [document.type === 'QUOTE' ? 'Valable jusqu’au' : 'Échéance', document.dueDate ? printed(String(document.dueDate)) : null],
    ['Total HT', money(document.totalNet)],
    ['TVA', money(document.totalVat)],
    ['Total TTC', money(document.totalGross)],
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Anchor component={Link} to="/accounting" size="sm">
            <Group gap={4} wrap="nowrap">
              <ArrowLeftIcon aria-hidden /> Facturation
            </Group>
          </Anchor>
          <Group gap="xs">
            <Title order={1} size="h3">
              {DOCUMENT_TYPE_LABELS[document.type]} {document.number}
            </Title>
            <Badge variant="light" color="cyan">
              Importé
            </Badge>
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
          <Button variant="default" leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openImportForm(document)}>
            Modifier
          </Button>
        </Group>
      </Group>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            {document.fileUrl && kind ? (
              <FilePreview url={document.fileUrl} name={document.fileName ?? document.number} kind={kind} height="max(36rem, calc(100dvh - 16rem))" />
            ) : (
              <Stack align="center" gap="sm" p="xl">
                <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
                  <FileXIcon aria-hidden />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  {document.fileUrl ? 'Ce fichier ne peut pas être affiché ici.' : 'Aucun fichier joint.'}
                </Text>
                {document.fileUrl ? (
                  <Button component="a" href={downloadUrl(document.fileUrl)} variant="light" leftSection={<DownloadSimpleIcon aria-hidden />}>
                    Télécharger {document.fileName}
                  </Button>
                ) : (
                  <Button variant="light" onClick={() => openImportForm(document)}>
                    Joindre le fichier
                  </Button>
                )}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Section title="Suivi">
              <Group gap="xs">
                <StatusMenu
                  type={document.type}
                  current={document.trackingStatus}
                  pending={setStatus.isPending}
                  onSelect={(status) =>
                    // A "sent" status asks when and how it was sent.
                    status.category === 'SENT'
                      ? openSentDialog({
                          title: `Envoi de ${document.number}`,
                          sentAt: document.sentAt,
                          sentVia: document.sentVia,
                          onSubmit: ({ date, via }) => markSent.mutateAsync({ id: document.id, date, via, statusId: status.id }),
                        })
                      : setStatus.mutate({ id: document.id, statusId: status.id }, { onError: (error) => notifyError(error.message) })
                  }
                />
                {document.type !== 'QUOTE' && (
                  <Badge variant="light" color={document.balance ? 'orange' : 'green'}>
                    {document.balance ? `Reste ${money(document.balance)}` : 'Réglé'}
                  </Badge>
                )}
              </Group>
            </Section>
            <Section title="Informations">
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
                {document.note && (
                  <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                    {document.note}
                  </Text>
                )}
              </Stack>
            </Section>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
