import { ActionIcon, Alert, Badge, Button, Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  ArrowBendDoubleUpLeftIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  CheckCircleIcon,
  FlagIcon,
  EnvelopeSimpleIcon,
  PencilSimpleLineIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useWorkspace } from '../workspace/api';
import { fetchMailDraft, mailQueryKey, useMailAccounts, useMailActions, useMailLabels, useMailMessage, type MailView } from './api';
import { MailOrganizeActions } from './MailOrganizeActions';
import { forwardOptions, replyOptions, splitDraftHtml, type SourceMail } from './compose-options';
import { escapeHtml } from './mail-format';
import { LinkToProject } from './LinkToProject';
import { MailBody } from './MailBody';
import { MailFiles, MailHeader } from './MailHeader';
import { useMailComposer } from './use-mail-composer';

/**
 * Message read on the server, as a source of reply or forward.
 * @param {MailView} mail Message.
 * @returns {SourceMail} Source.
 */
function sourceOf(mail: MailView): SourceMail {
  return { ...mail, date: String(mail.date), location: { accountId: mail.accountId, folder: mail.folder, uid: mail.uid } };
}

interface MailReaderProps {
  accountId: string;
  folder: string;
  uid: number;
  /** Mail of the drafts folder: it is resumed rather than answered. */
  isDraft?: boolean;
  /** Called once the mail is deleted (or moved away). */
  onDeleted: () => void;
  /** Opens the flags settings. */
  onManageLabels: () => void;
}

/**
 * Mail read live on the server: header, body, files and flags; reply, reply all, forward, done / to do,
 * flags, spam, move, mark as unread, delete, link to a project.
 * @param {MailReaderProps} props Component props.
 * @returns {JSX.Element} Reader.
 */
export function MailReader({ accountId, folder, uid, isDraft, onDeleted, onManageLabels }: MailReaderProps) {
  const { data: mail, isPending, error } = useMailMessage({ accountId, folder, uid });
  const { data: accounts } = useMailAccounts();
  const { data: workspace } = useWorkspace();
  const { data: labels } = useMailLabels();
  const { setSeen, remove, deleteDraft } = useMailActions();
  const [resuming, setResuming] = useState(false);
  const compose = useMailComposer();
  const own = (accounts ?? []).map((account) => account.email);
  const queryClient = useQueryClient();

  // Opening marks the mail as read: lists and counts are refreshed.
  useEffect(() => {
    if (mail) void queryClient.invalidateQueries({ queryKey: [...mailQueryKey], predicate: (query) => query.queryKey[1] !== 'message' });
  }, [mail, queryClient]);

  if (isPending) return <Skeleton height={300} />;
  if (error || !mail) {
    return (
      <Alert color="red" icon={<ErrorIcon />}>
        {error?.message ?? 'Mail introuvable.'}
      </Alert>
    );
  }

  /**
   * Asks for confirmation before deleting the mail.
   * @returns {void}
   */
  const confirmDelete = () => {
    const modalId = `delete-mail-${uid}`;
    modals.open({
      modalId,
      title: 'Supprimer le mail',
      children: (
        <Stack gap="md">
          <Text size="sm">
            Le mail sera placé dans la corbeille de la boîte (supprimé définitivement s’il y est déjà). Ses copies rattachées à des projets
            sont conservées.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(
                { accountId, folder, uids: [uid] },
                {
                  onSuccess: () => {
                    notifySuccess('Mail supprimé.');
                    onDeleted();
                  },
                  onError: (failure) => notifyError(failure.message),
                },
              );
            }}
          />
        </Stack>
      ),
    });
  };

  const files = mail.attachments.filter((file) => !file.inline);

  /**
   * Opens the draft in the writing form; its next save replaces it.
   * @returns {Promise<void>}
   */
  const resume = async () => {
    setResuming(true);
    try {
      const draft = await fetchMailDraft({ accountId, folder, uid });
      const parts = splitDraftHtml(draft.html ?? `<p>${escapeHtml(draft.text ?? '').replace(/\n/g, '<br>')}</p>`);
      compose({
        accountId,
        to: draft.to.map((item) => item.address),
        cc: draft.cc.map((item) => item.address),
        bcc: draft.bcc.map((item) => item.address),
        subject: draft.subject,
        body: parts.body,
        withSignature: parts.withSignature,
        quote: parts.quote,
        inReplyTo: draft.inReplyTo,
        references: draft.references,
        projectId: draft.projectId,
        sourceFiles: {
          from: { accountId, folder, uid },
          files: draft.attachments.filter((file) => !file.inline).map(({ index, filename, size }) => ({ index, filename, size })),
        },
        draft: { accountId, folder, uid },
      });
    } catch (failure) {
      notifyError(failure instanceof Error ? failure.message : 'Brouillon illisible.');
    } finally {
      setResuming(false);
    }
  };

  /**
   * Asks for confirmation before deleting the draft for good.
   * @returns {void}
   */
  const confirmDeleteDraft = () => {
    const modalId = `delete-draft-${uid}`;
    modals.open({
      modalId,
      title: 'Supprimer le brouillon',
      children: (
        <Stack gap="md">
          <Text size="sm">Le brouillon « {mail.subject} » sera supprimé définitivement de la boîte. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              deleteDraft.mutate(
                { accountId, folder, uid },
                {
                  onSuccess: () => {
                    notifySuccess('Brouillon supprimé.');
                    onDeleted();
                  },
                  onError: (failure) => notifyError(failure.message),
                },
              );
            }}
          />
        </Stack>
      ),
    });
  };
  const base = `/api/mail/${accountId}/attachment?folder=${encodeURIComponent(folder)}&uid=${uid}`;

  return (
    <Stack gap="md">
      <MailHeader
        subject={mail.subject}
        from={mail.from}
        to={mail.to}
        cc={mail.cc}
        date={String(mail.date)}
        actions={
          <Group gap={4} wrap="nowrap">
            {!isDraft && (
              <MailOrganizeActions
                groups={[{ accountId, folder, uids: [uid] }]}
                done={mail.done}
                labelIds={mail.labelIds}
                onMoved={onDeleted}
                onManageLabels={onManageLabels}
              />
            )}
            <Tooltip label="Marquer comme non lu">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Marquer comme non lu"
                onClick={() =>
                  setSeen.mutate({ accountId, folder, uids: [uid], seen: false }, { onError: (failure) => notifyError(failure.message) })
                }
              >
                <EnvelopeSimpleIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Supprimer">
              <ActionIcon variant="subtle" color="red" aria-label="Supprimer le mail" onClick={confirmDelete}>
                <TrashIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        }
        extra={
          (mail.linkedProjectIds.length > 0 || mail.labelIds.length > 0 || mail.done) && (
            <Group gap={4} mt={4}>
              {mail.done && (
                <Badge size="sm" variant="light" color="green" leftSection={<CheckCircleIcon weight="fill" aria-hidden />}>
                  Traité
                </Badge>
              )}
              {mail.labelIds
                .map((id) => labels?.find((label) => label.id === id))
                .filter((label) => label !== undefined)
                .map((label) => (
                  <Badge key={label.id} size="sm" variant="light" color={label.color} leftSection={<FlagIcon weight="fill" aria-hidden />}>
                    {label.name}
                  </Badge>
                ))}
              {mail.linkedProjectIds.map((projectId) => (
                <Badge
                  key={projectId}
                  size="sm"
                  variant="light"
                  component={Link}
                  to={`/projects/${projectId}?tab=mail`}
                  style={{ cursor: 'pointer' }}
                >
                  {workspace?.projects.find((project) => project.id === projectId)?.title ?? 'Projet'}
                </Badge>
              ))}
            </Group>
          )
        }
      />
      {isDraft ? (
        <Group gap="xs">
          <Button size="xs" leftSection={<PencilSimpleLineIcon aria-hidden />} loading={resuming} onClick={() => void resume()}>
            Reprendre le brouillon
          </Button>
          <Button size="xs" variant="light" color="red" leftSection={<TrashIcon aria-hidden />} onClick={confirmDeleteDraft}>
            Supprimer le brouillon
          </Button>
        </Group>
      ) : (
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<ArrowBendUpLeftIcon aria-hidden />}
            onClick={() => compose(replyOptions(sourceOf(mail), false, own))}
          >
            Répondre
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<ArrowBendDoubleUpLeftIcon aria-hidden />}
            onClick={() => compose(replyOptions(sourceOf(mail), true, own))}
          >
            Répondre à tous
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<ArrowBendUpRightIcon aria-hidden />}
            onClick={() => compose(forwardOptions(sourceOf(mail), files))}
          >
            Transférer
          </Button>
          <LinkToProject accountId={accountId} folder={folder} uid={uid} linkedProjectIds={mail.linkedProjectIds} />
        </Group>
      )}
      <MailFiles
        files={files.map((file) => ({ key: String(file.index), name: file.filename, size: file.size, url: `${base}&index=${file.index}` }))}
      />
      <MailBody html={mail.html} text={mail.text} />
    </Stack>
  );
}
