import { ActionIcon, Badge, Button, Grid, Group, Paper, ScrollArea, Skeleton, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { ArrowBendDoubleUpLeftIcon, ArrowBendUpLeftIcon, ArrowBendUpRightIcon, EnvelopeSimpleIcon, LinkBreakIcon, PaperclipIcon, PencilSimpleLineIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useMailAccounts, useMailActions, useProjectMails, type LinkedMail } from './api';
import { forwardOptions, replyOptions, type SourceMail } from './compose-options';
import { listDate, senderName } from './mail-format';
import { MailBody } from './MailBody';
import { MailFiles, MailHeader } from './MailHeader';
import classes from './MailPage.module.css';
import { useMailComposer } from './use-mail-composer';

/**
 * Linked copy as a source of reply or forward (its files are not forwarded: they are in Ordo, not on the server).
 * @param {LinkedMail} mail Copy.
 * @returns {SourceMail} Source.
 */
function sourceOf(mail: LinkedMail): SourceMail {
  return { ...mail, date: String(mail.date), location: null };
}

/**
 * Mails tab of a project: copies of the linked mails (received or sent), latest first, readable even when
 * deleted from the mailbox; reply, forward, unlink, and new mails linked to the project.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectMailsPanel({ projectId }: { projectId: string }) {
  const { data: mails, isPending } = useProjectMails(projectId);
  const { data: accounts } = useMailAccounts();
  const { unlink } = useMailActions();
  const compose = useMailComposer();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const own = (accounts ?? []).map((account) => account.email);
  const selected = mails?.find((mail) => mail.id === selectedId) ?? mails?.[0];

  /**
   * Asks for confirmation before unlinking a mail.
   * @param {LinkedMail} mail Copy.
   * @returns {void}
   */
  const confirmUnlink = (mail: LinkedMail) => {
    const modalId = `unlink-mail-${mail.id}`;
    modals.open({
      modalId,
      title: 'Détacher le mail du projet',
      children: (
        <Stack gap="md">
          <Text size="sm">
            La copie de « {mail.subject} » conservée dans le projet sera supprimée, avec ses pièces jointes. Le mail reste dans
            la boîte mail s’il n’en a pas été supprimé.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              unlink.mutate(mail.id, {
                onSuccess: () => {
                  notifySuccess('Mail détaché du projet.');
                  setSelectedId(null);
                },
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Text size="sm" c="dimmed" maw={640}>
          Mails rattachés au projet depuis la page Mails, envoyés depuis ce projet, ou faisant suite à une conversation
          rattachée. Une copie est conservée dans Ordo.
        </Text>
        <Button
          leftSection={<PencilSimpleLineIcon aria-hidden />}
          disabled={!accounts?.length}
          onClick={() => compose({ projectId })}
        >
          Nouveau mail
        </Button>
      </Group>

      {isPending ? (
        <Skeleton height={200} />
      ) : !mails?.length ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <EnvelopeSimpleIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun mail rattaché à ce projet.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Grid gap="md">
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper withBorder radius="md">
              <ScrollArea.Autosize mah="calc(100dvh - 320px)">
                {mails.map((mail) => (
                  <UnstyledButton
                    key={mail.id}
                    className={classes.item}
                    data-active={mail.id === selected?.id || undefined}
                    onClick={() => setSelectedId(mail.id)}
                  >
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="sm" truncate fw={600}>
                        {mail.sent ? `À : ${senderName(mail.to)}` : senderName(mail.from)}
                      </Text>
                      <Group gap={4} wrap="nowrap">
                        {mail.attachments.some((file) => !file.inline) && <PaperclipIcon aria-label="Pièces jointes" />}
                        <Text size="xs" c="dimmed">
                          {listDate(String(mail.date))}
                        </Text>
                      </Group>
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      {mail.sent && (
                        <Badge size="xs" variant="light" color="gray">
                          Envoyé
                        </Badge>
                      )}
                      <Text size="sm" truncate c="dimmed">
                        {mail.subject}
                      </Text>
                    </Group>
                  </UnstyledButton>
                ))}
              </ScrollArea.Autosize>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 8 }}>
            {selected && (
              <Paper withBorder radius="md" p="md">
                <Stack gap="md">
                  <MailHeader
                    subject={selected.subject}
                    from={selected.from}
                    to={selected.to}
                    cc={selected.cc}
                    date={String(selected.date)}
                    actions={
                      <Tooltip label="Détacher du projet">
                        <ActionIcon variant="subtle" color="red" aria-label="Détacher le mail du projet" onClick={() => confirmUnlink(selected)}>
                          <LinkBreakIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                    }
                  />
                  <Group gap="xs">
                    <Button size="xs" variant="default" leftSection={<ArrowBendUpLeftIcon aria-hidden />} disabled={!accounts?.length} onClick={() => compose(replyOptions(sourceOf(selected), false, own, projectId))}>
                      Répondre
                    </Button>
                    <Button size="xs" variant="default" leftSection={<ArrowBendDoubleUpLeftIcon aria-hidden />} disabled={!accounts?.length} onClick={() => compose(replyOptions(sourceOf(selected), true, own, projectId))}>
                      Répondre à tous
                    </Button>
                    <Button size="xs" variant="default" leftSection={<ArrowBendUpRightIcon aria-hidden />} disabled={!accounts?.length} onClick={() => compose(forwardOptions(sourceOf(selected), [], projectId))}>
                      Transférer
                    </Button>
                  </Group>
                  <MailFiles files={selected.attachments.filter((file) => !file.inline).map((file) => ({ key: file.id, name: file.name, size: file.size, url: file.url }))} />
                  <MailBody key={selected.id} html={selected.html} text={selected.text} />
                </Stack>
              </Paper>
            )}
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  );
}
