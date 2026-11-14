import { ActionIcon, Button, Group, Menu, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { DotsThreeIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { confirmDestructive } from '../dialogs/confirm-destructive';
import { ListSkeleton } from '../feedback/Skeletons';
import { MarkdownEditor, type MarkdownSuggestions } from '../markdown/MarkdownEditor';
import { MarkdownView } from '../markdown/MarkdownView';
import type { ReferenceTargets } from '../markdown/remark-references';
import * as fmt from '../../lib/format';

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * "il y a 3 heures", "hier"…
 * @param {string} date ISO instant.
 * @returns {string} Relative time.
 */
function fromNow(date: string): string {
  const seconds = (Date.parse(date) - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'à l’instant';
}

/** Comment as the thread shows it. */
export interface ThreadComment {
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
}

/**
 * One comment, editable in place.
 * @param {{ comment: ThreadComment, actions: ThreadActions, suggestions: MarkdownSuggestions, targets: ReferenceTargets }} props Component props.
 * @returns {JSX.Element} Comment.
 */
function CommentCard({ comment, actions, suggestions, targets }: { comment: ThreadComment; actions: ThreadActions; suggestions: MarkdownSuggestions; targets: ReferenceTargets }) {
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
          <Tooltip label={fmt.dateTime(new Date(comment.createdAt))}>
            <Text size="xs" c="dimmed" component="time" dateTime={comment.createdAt}>
              {fromNow(comment.createdAt)}
            </Text>
          </Tooltip>
        </Group>
        {draft === null && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Actions sur le commentaire">
                <DotsThreeIcon weight="bold" aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => setDraft(comment.body)}>
                Modifier
              </Menu.Item>
              <Menu.Item
                leftSection={<TrashIcon aria-hidden />}
                color="red"
                onClick={() =>
                  confirmDestructive({
                    title: 'Supprimer le commentaire',
                    risks: 'Le commentaire sera supprimé définitivement. Cette action est irréversible.',
                    onConfirm: () => actions.remove(comment.id),
                  })
                }
              >
                Supprimer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      <div style={{ padding: 'var(--mantine-spacing-sm)' }}>
        {draft === null ? (
          <MarkdownView targets={targets} onChange={(body) => actions.update(comment.id, body)}>
            {comment.body}
          </MarkdownView>
        ) : (
          <Stack gap="xs">
            <MarkdownEditor value={draft} onChange={setDraft} suggestions={suggestions} minRows={3} autoFocus onSubmitShortcut={save} />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" size="xs" onClick={() => setDraft(null)}>
                Annuler
              </Button>
              <Button size="xs" onClick={save} loading={actions.updating} disabled={!draft.trim()}>
                Enregistrer
              </Button>
            </Group>
          </Stack>
        )}
      </div>
    </Paper>
  );
}

/**
 * Comment thread of an item (task, routine, event, document…), the same everywhere: its comments (markdown, editable in
 * place) and the new comment editor at the bottom.
 * @param {CommentThreadProps} props Component props.
 * @returns {JSX.Element} Thread.
 */
export function CommentThread({ comments, loading = false, actions, suggestions, targets }: CommentThreadProps) {
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
        comments?.map((comment) => <CommentCard key={comment.id} comment={comment} actions={actions} suggestions={suggestions} targets={targets} />)
      )}
      <MarkdownEditor label="Ajouter un commentaire" value={body} onChange={setBody} suggestions={suggestions} minRows={3} placeholder="Écrivez un commentaire…" onSubmitShortcut={submit} />
      <Group justify="flex-end">
        <Button onClick={submit} loading={actions.adding} disabled={!body.trim()}>
          Commenter
        </Button>
      </Group>
    </Stack>
  );
}
