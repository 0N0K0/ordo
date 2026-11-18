import { ActionsMenu } from '../actions/ActionsMenu';
import { FormActions } from '../dialogs/FormActions';
import { Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { PencilSimpleIcon, TrashIcon, ChatCircleTextIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { confirmDestructive } from '../dialogs/confirm-destructive';
import { ListSkeleton } from '../feedback/Skeletons';
import { EmptyState } from '../feedback/EmptyState';
import { MarkdownEditor, type MarkdownSuggestions } from '../markdown/MarkdownEditor';
import { MarkdownView } from '../markdown/MarkdownView';
import type { ReferenceTargets } from '../markdown/remark-references';
import * as fmt from '../../lib/format';

/** Comment as the thread shows it. */
interface ThreadComment {
  id: string;
  /** Markdown. */
  body: string;
  createdAt: string;
  /** Written on GitHub by someone else (task comments). Optional. */
  githubAuthor?: string | null;
}

/** Saves of a thread: each calls `done` once saved (errors are told by the caller). */
export interface ThreadActions {
  add: (body: string, done: () => void) => void;
  update: (id: string, body: string, done?: () => void) => void;
  remove: (id: string) => void;
  adding?: boolean;
  updating?: boolean;
}

interface CommentThreadProps {
  comments: readonly ThreadComment[] | undefined;
  loading?: boolean;
  actions: ThreadActions;
  /** « # » and « @ » offered while typing. */
  suggestions: MarkdownSuggestions;
  /** References the texts point to. */
  targets: ReferenceTargets;
  /** Comments of an archived item: shown only, neither added, changed nor deleted. Optional. Default = false. */
  readOnly?: boolean;
}

/**
 * One comment, editable in place (unless read only).
 * @param {{ comment: ThreadComment, actions: ThreadActions, suggestions: MarkdownSuggestions, targets: ReferenceTargets, readOnly: boolean }} props Component props.
 * @returns {JSX.Element} Comment.
 */
function CommentCard({
  comment,
  actions,
  suggestions,
  targets,
  readOnly,
}: {
  comment: ThreadComment;
  actions: ThreadActions;
  suggestions: MarkdownSuggestions;
  targets: ReferenceTargets;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  /**
   * Saves the edited comment.
   * @returns {void}
   */
  const save = () => {
    if (draft === null || !draft.trim()) return;
    actions.update(comment.id, draft, () => setDraft(null));
  };
  return (
    <Paper withBorder radius="md">
      <Group justify="space-between" px="sm" py={6} bg="var(--mantine-color-default-hover)" style={{ borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0' }}>
        <Group gap={6}>
          {comment.githubAuthor && (
            <Text size="xs" fw={600}>
              @{comment.githubAuthor} sur GitHub
            </Text>
          )}
          <Tooltip label={fmt.dateTime(comment.createdAt)}>
            <Text size="xs" c="dimmed" component="time" dateTime={comment.createdAt}>
              {fmt.fromNow(comment.createdAt)}
            </Text>
          </Tooltip>
        </Group>
        {draft === null && !readOnly && (
          <ActionsMenu
            name="ce commentaire"
            size="sm"
            items={[
              { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => setDraft(comment.body) },
              {
                label: 'Supprimer',
                icon: <TrashIcon aria-hidden />,
                danger: true,
                onClick: () =>
                  confirmDestructive({
                    title: 'Supprimer le commentaire',
                    risks: 'Le commentaire sera supprimé définitivement.',
                    onConfirm: () => actions.remove(comment.id),
                  }),
              },
            ]}
          />
        )}
      </Group>
      <div style={{ padding: 'var(--mantine-spacing-sm)' }}>
        {draft === null ? (
          <MarkdownView targets={targets} onChange={readOnly ? undefined : (body) => actions.update(comment.id, body)}>
            {comment.body}
          </MarkdownView>
        ) : (
          <Stack gap="xs">
            <MarkdownEditor value={draft} onChange={setDraft} suggestions={suggestions} minRows={3} autoFocus onSubmitShortcut={save} />
            <FormActions size="xs" onCancel={() => setDraft(null)} onSubmit={save} loading={actions.updating} disabled={!draft.trim()} />
          </Stack>
        )}
      </div>
    </Paper>
  );
}

/**
 * Comment thread of an item (task, routine, event, document…), the same everywhere: its comments (markdown, editable in
 * place) and the new comment editor at the bottom; on an archived item, its comments only.
 * @param {CommentThreadProps} props Component props.
 * @returns {JSX.Element} Thread.
 */
export function CommentThread({ comments, loading = false, actions, suggestions, targets, readOnly = false }: CommentThreadProps) {
  const [body, setBody] = useState('');
  /**
   * Posts the new comment.
   * @returns {void}
   */
  const submit = () => {
    if (!body.trim()) return;
    actions.add(body, () => setBody(''));
  };
  return (
    <Stack gap="sm">
      {loading ? (
        <ListSkeleton items={2} lines={2} avatar />
      ) : (
        comments?.map((comment) => <CommentCard key={comment.id} comment={comment} actions={actions} suggestions={suggestions} targets={targets} readOnly={readOnly} />)
      )}
      {readOnly ? (
        !loading && !comments?.length && <EmptyState compact message="Aucun commentaire." />
      ) : (
        <>
          <MarkdownEditor label="Ajouter un commentaire" value={body} onChange={setBody} suggestions={suggestions} minRows={3} placeholder="Écrivez un commentaire…" onSubmitShortcut={submit} />
          <Group justify="flex-end">
            <Button leftSection={<ChatCircleTextIcon aria-hidden />} onClick={submit} loading={actions.adding} disabled={!body.trim()}>
              Commenter
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
