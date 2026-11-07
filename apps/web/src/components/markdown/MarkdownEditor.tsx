import { ActionIcon, Avatar, Group, Loader, Paper, Tabs, Text, Textarea, Tooltip, UnstyledButton } from '@mantine/core';
import { MAX_ATTACHMENT_BYTES } from '@ordo/shared';
import {
  AtIcon,
  CheckSquareIcon,
  CodeIcon,
  HashIcon,
  LinkIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  MarkdownLogoIcon,
  PaperclipIcon,
  QuotesIcon,
  TextBIcon,
  TextHIcon,
  TextItalicIcon,
} from '@phosphor-icons/react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { attachmentMarkdown, uploadAttachment } from '../../lib/attachments';
import { notifyError } from '../../lib/notify';
import {
  completeReference,
  insertLink,
  isUrl,
  prefixLines,
  referenceAt,
  wrapSelection,
  type EditResult,
  type ReferenceToken,
} from './markdown-commands';
import classes from './MarkdownEditor.module.css';
import { MarkdownView } from './MarkdownView';
import { referenceLabel, taskReferenceUrl, type ReferenceTargets, type ReferenceTask } from './remark-references';

export interface MarkdownSuggestions {
  /** Project of the text: its tasks come first and show without their project. */
  projectId: string | null;
  tasks: ReferenceTask[];
  contributors: { handle: string; name: string; avatarUrl: string | null }[];
}

interface Suggestion {
  key: string;
  reference: string;
  label: ReactNode;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Items offered when typing "#" and "@". */
  suggestions: MarkdownSuggestions;
  label?: string;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
  error?: string;
  /** Ctrl/⌘ + Enter. */
  onSubmitShortcut?: () => void;
}

const MAX_SUGGESTIONS = 8;

type Edit = (value: string, start: number, end: number) => EditResult;

/**
 * Inserts a trigger character to start a mention or a task reference (with a space before when glued to a word).
 * @param {'#' | '@'} trigger Trigger.
 * @returns {Edit} Edit command.
 */
function triggerCommand(trigger: '#' | '@'): Edit {
  return (text, start, end) => {
    const inserted = (start > 0 && !/\s/.test(text[start - 1]) ? ' ' : '') + trigger;
    const caret = start + inserted.length;
    return { value: text.slice(0, start) + inserted + text.slice(end), selectionStart: caret, selectionEnd: caret };
  };
}

/** Toolbar commands, in display order; `key` is the Ctrl/⌘ shortcut letter. */
const COMMANDS: { label: string; key?: string; icon: ReactNode; edit: Edit; divider?: boolean }[] = [
  { label: 'Titre', icon: <TextHIcon />, edit: (t, s, e) => prefixLines(t, s, e, '### ') },
  { label: 'Gras', key: 'b', icon: <TextBIcon />, edit: (t, s, e) => wrapSelection(t, s, e, '**', '**', 'texte en gras') },
  {
    label: 'Italique',
    key: 'i',
    icon: <TextItalicIcon />,
    edit: (t, s, e) => wrapSelection(t, s, e, '_', '_', 'texte en italique'),
  },
  { label: 'Citation', icon: <QuotesIcon />, edit: (t, s, e) => prefixLines(t, s, e, '> ') },
  { label: 'Code', key: 'e', icon: <CodeIcon />, edit: (t, s, e) => codeCommand(t, s, e) },
  { label: 'Lien', key: 'k', icon: <LinkIcon />, edit: (t, s, e) => insertLink(t, s, e) },
  { label: 'Liste à puces', icon: <ListBulletsIcon />, edit: (t, s, e) => prefixLines(t, s, e, '- '), divider: true },
  { label: 'Liste numérotée', icon: <ListNumbersIcon />, edit: (t, s, e) => prefixLines(t, s, e, (i) => `${i + 1}. `) },
  { label: 'Liste de tâches', icon: <CheckSquareIcon />, edit: (t, s, e) => prefixLines(t, s, e, '- [ ] ') },
  { label: 'Mentionner un contributeur', icon: <AtIcon />, edit: triggerCommand('@'), divider: true },
  { label: 'Référencer une tâche', icon: <HashIcon />, edit: triggerCommand('#') },
];
// List item prefixes continued on Enter: "- ", "* ", "1. ", "- [ ] ", "> ".
const LIST_ITEM = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. |> )/;

/**
 * Lowercases and strips accents, for accent-insensitive matching.
 * @param {string} value Text.
 * @returns {string} Normalized text.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * GitHub-like markdown field: "Écrire" / "Aperçu" tabs, formatting toolbar, keyboard shortcuts,
 * list continuation, link on URL paste and "#" / "@" autocompletion. Edits keep the native undo history.
 * @param {MarkdownEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function MarkdownEditor({
  value,
  onChange,
  suggestions,
  label,
  placeholder = 'Écrivez en markdown…',
  minRows = 6,
  autoFocus,
  error,
  onSubmitShortcut,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const [tab, setTab] = useState<string | null>('write');
  const [token, setToken] = useState<ReferenceToken | null>(null);
  const [active, setActive] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const targets: ReferenceTargets = useMemo(
    () => ({
      projectId: suggestions.projectId,
      taskById: new Map(suggestions.tasks.map((task) => [task.id, task])),
      taskByNumber: new Map(suggestions.tasks.map((task) => [`${task.projectId}:${task.number}`, task])),
      handles: new Set(suggestions.contributors.map((contributor) => contributor.handle)),
    }),
    [suggestions],
  );

  const matches: Suggestion[] = useMemo(() => {
    if (!token) return [];
    const query = normalize(token.query);
    if (token.trigger === '#') {
      // Tasks of the project of the text first; a reference is a link to the task by its id.
      return suggestions.tasks
        .filter((task) => String(task.number).startsWith(query) || normalize(task.title).includes(query))
        .sort((a, b) => Number(b.projectId === suggestions.projectId) - Number(a.projectId === suggestions.projectId))
        .slice(0, MAX_SUGGESTIONS)
        .map((task) => ({
          key: `t${task.id}`,
          reference: `[#${task.number}](${taskReferenceUrl(task.id)})`,
          label: (
            <>
              <Text span size="sm" c="dimmed" ff="monospace">
                {referenceLabel(task, suggestions.projectId)}
              </Text>{' '}
              <Text span size="sm">
                {task.title}
              </Text>
            </>
          ),
        }));
    }
    return suggestions.contributors
      .filter((contributor) => contributor.handle.startsWith(query) || normalize(contributor.name).includes(query))
      .slice(0, MAX_SUGGESTIONS)
      .map((contributor) => ({
        key: `c${contributor.handle}`,
        reference: `@${contributor.handle}`,
        label: (
          <Group gap="xs" wrap="nowrap">
            <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" size={20} />
            <Text span size="sm" fw={600}>
              {contributor.handle}
            </Text>
            <Text span size="sm" c="dimmed">
              {contributor.name}
            </Text>
          </Group>
        ),
      }));
  }, [token, suggestions]);

  /**
   * Applies an edit through the browser so Ctrl+Z still works, then restores the selection.
   * Only the changed segment is replaced.
   * @param {EditResult} result New text and selection.
   * @returns {void}
   */
  const apply = (result: EditResult) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const previous = textarea.value;
    let start = 0;
    while (start < previous.length && start < result.value.length && previous[start] === result.value[start]) start++;
    let endOld = previous.length;
    let endNew = result.value.length;
    while (endOld > start && endNew > start && previous[endOld - 1] === result.value[endNew - 1]) {
      endOld--;
      endNew--;
    }
    textarea.focus();
    textarea.setSelectionRange(start, endOld);
    const inserted = result.value.slice(start, endNew);
    // execCommand keeps the undo stack; it is deprecated but has no replacement for this yet.
    const done = inserted ? document.execCommand('insertText', false, inserted) : document.execCommand('delete');
    if (!done) onChange(result.value);
    // Synchronous: a deferred restore would move the caret under fast typing.
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    setToken(null);
  };

  /**
   * Runs an edit command on the current selection.
   * @param {Edit} edit Edit command.
   * @returns {void}
   */
  const run = (edit: Edit) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    apply(edit(textarea.value, textarea.selectionStart, textarea.selectionEnd));
  };

  /**
   * Continues a list on Enter, or ends it when the item is empty.
   * @param {HTMLTextAreaElement} textarea Field.
   * @returns {boolean} True when the key was handled.
   */
  const continueList = (textarea: HTMLTextAreaElement): boolean => {
    const { value: text, selectionStart: caret, selectionEnd } = textarea;
    if (caret !== selectionEnd) return false;
    const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
    const line = text.slice(lineStart, caret);
    const match = LIST_ITEM.exec(line);
    if (!match) return false;
    const [prefixWithIndent, indent, marker, number] = match;
    if (line.length === prefixWithIndent.length) {
      // Empty item: remove it and leave the list.
      apply({ value: text.slice(0, lineStart) + text.slice(caret), selectionStart: lineStart, selectionEnd: lineStart });
      return true;
    }
    const next = number ? `${Number(number) + 1}. ` : marker.replace(/\[[xX]\]/, '[ ]');
    const inserted = `\n${indent}${next}`;
    apply({ value: text.slice(0, caret) + inserted + text.slice(caret), selectionStart: caret + inserted.length, selectionEnd: caret + inserted.length });
    return true;
  };

  /**
   * Keyboard: suggestion navigation, shortcuts and list continuation.
   * @param {KeyboardEvent<HTMLTextAreaElement>} event Key event.
   * @returns {void}
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (token && matches.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        choose(matches[active]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setToken(null);
        return;
      }
    }

    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key === 'Enter' && onSubmitShortcut) {
      event.preventDefault();
      onSubmitShortcut();
      return;
    }
    if (mod && !event.shiftKey && !event.altKey) {
      const command = COMMANDS.find((item) => item.key === event.key.toLowerCase());
      if (command) {
        event.preventDefault();
        run(command.edit);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !mod && continueList(event.currentTarget)) event.preventDefault();
  };

  /**
   * Uploads files and inserts them at the caret, one per line: images are shown in place, other files
   * become download links.
   * @param {File[]} files Files.
   * @returns {Promise<void>}
   */
  const attach = async (files: File[]) => {
    const accepted = files.filter((file) => {
      if (file.size <= MAX_ATTACHMENT_BYTES) return true;
      notifyError(`« ${file.name} » est trop lourd (10 Mo maximum).`);
      return false;
    });
    if (accepted.length === 0) return;
    setUploading((count) => count + accepted.length);
    const results = await Promise.allSettled(accepted.map((file) => uploadAttachment(file)));
    setUploading((count) => count - accepted.length);
    for (const result of results) if (result.status === 'rejected') notifyError(result.reason?.message ?? 'Envoi impossible.');
    const lines = results.flatMap((result) => (result.status === 'fulfilled' ? [attachmentMarkdown(result.value)] : []));
    if (lines.length === 0) return;
    run((text, start, end) => {
      const before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
      const after = end < text.length && text[end] !== '\n' ? '\n' : '';
      const inserted = before + lines.join('\n') + after;
      const caret = start + inserted.length;
      return { value: text.slice(0, start) + inserted + text.slice(end), selectionStart: caret, selectionEnd: caret };
    });
  };

  /**
   * Drops files on the field to attach them.
   * @param {DragEvent<HTMLTextAreaElement>} event Drop event.
   * @returns {void}
   */
  const handleDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    setDragOver(false);
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    void attach([...event.dataTransfer.files]);
  };

  /**
   * Pasting files attaches them; pasting a URL over a selection makes a link, like on GitHub.
   * @param {ClipboardEvent<HTMLTextAreaElement>} event Paste event.
   * @returns {void}
   */
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (event.clipboardData.files.length > 0) {
      event.preventDefault();
      void attach([...event.clipboardData.files]);
      return;
    }
    const text = event.clipboardData.getData('text/plain');
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (selectionStart === selectionEnd || !isUrl(text)) return;
    event.preventDefault();
    run((value, start, end) => insertLink(value, start, end, text.trim()));
  };

  /**
   * Updates the reference being typed after each change or caret move.
   * @param {HTMLTextAreaElement} textarea Field.
   * @returns {void}
   */
  const refreshToken = (textarea: HTMLTextAreaElement) => {
    const next = textarea.selectionStart === textarea.selectionEnd ? referenceAt(textarea.value, textarea.selectionStart) : null;
    setToken((current) => {
      if (next?.start !== current?.start || next?.trigger !== current?.trigger) setActive(0);
      return next;
    });
  };

  /**
   * Inserts the chosen reference.
   * @param {Suggestion} suggestion Chosen item.
   * @returns {void}
   */
  const choose = (suggestion: Suggestion) => {
    const textarea = textareaRef.current;
    if (!textarea || !token) return;
    apply(completeReference(textarea.value, token, textarea.selectionStart, suggestion.reference));
  };

  return (
    <div className={classes.root} data-error={error ? true : undefined}>
      {label && (
        <Text component="label" size="sm" fw={500} htmlFor={inputId}>
          {label}
        </Text>
      )}
      <Paper withBorder radius="md" className={classes.frame}>
        <Tabs value={tab} onChange={setTab} variant="outline" classNames={{ list: classes.tabs }}>
          <Group justify="space-between" wrap="wrap" gap={0} className={classes.header}>
            <Tabs.List>
              <Tabs.Tab value="write">Écrire</Tabs.Tab>
              <Tabs.Tab value="preview">Aperçu</Tabs.Tab>
            </Tabs.List>
            {tab === 'write' && (
              <Group gap={2} px="xs" wrap="wrap" role="toolbar" aria-label="Mise en forme">
                {COMMANDS.map((command) => (
                  <Group key={command.label} gap={2} wrap="nowrap">
                    {command.divider && <span className={classes.divider} />}
                    <Tooltip label={command.key ? `${command.label} (Ctrl+${command.key.toUpperCase()})` : command.label}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={command.label}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => run(command.edit)}
                      >
                        {command.icon}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))}
                <span className={classes.divider} />
                <Tooltip label="Joindre des fichiers (images affichées, autres fichiers en lien)">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Joindre des fichiers"
                    loading={uploading > 0}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <PaperclipIcon />
                  </ActionIcon>
                </Tooltip>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(event) => {
                    const files = [...(event.currentTarget.files ?? [])];
                    event.currentTarget.value = '';
                    void attach(files);
                  }}
                />
              </Group>
            )}
          </Group>

          <Tabs.Panel value="write" className={classes.panel}>
            <Textarea
              ref={textareaRef}
              id={inputId}
              value={value}
              onChange={(event) => {
                onChange(event.currentTarget.value);
                refreshToken(event.currentTarget);
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={(event) => ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && refreshToken(event.currentTarget)}
              onClick={(event) => refreshToken(event.currentTarget)}
              onBlur={() => setToken(null)}
              onPaste={handlePaste}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes('Files')) return;
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              data-drag-over={dragOver || undefined}
              placeholder={placeholder}
              autosize
              minRows={minRows}
              maxRows={30}
              autoFocus={autoFocus}
              aria-label={label ?? 'Texte markdown'}
              aria-invalid={Boolean(error)}
              aria-autocomplete="list"
              aria-expanded={matches.length > 0}
              classNames={{ input: classes.input }}
            />
            {token && matches.length > 0 && (
              <Paper shadow="md" withBorder className={classes.suggestions} role="listbox" aria-label="Suggestions">
                {matches.map((suggestion, index) => (
                  <UnstyledButton
                    key={suggestion.key}
                    className={classes.suggestion}
                    data-active={index === active || undefined}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(suggestion);
                    }}
                    onMouseEnter={() => setActive(index)}
                  >
                    {suggestion.label}
                  </UnstyledButton>
                ))}
              </Paper>
            )}
          </Tabs.Panel>
          <Tabs.Panel value="preview" className={classes.panel}>
            <div className={classes.preview}>
              <MarkdownView targets={targets} emptyText="Rien à prévisualiser." onChange={onChange}>
                {value}
              </MarkdownView>
            </div>
          </Tabs.Panel>
        </Tabs>
        <Group gap={6} className={classes.footer} aria-live="polite">
          {uploading > 0 ? <Loader size={12} /> : <MarkdownLogoIcon aria-hidden />}
          <Text size="xs" c="dimmed">
            {uploading > 0
              ? `Envoi de ${uploading} fichier${uploading > 1 ? 's' : ''}…`
              : 'Markdown pris en charge — « # » pour une tâche, « @ » pour un contributeur. Glissez, collez ou joignez des fichiers.'}
          </Text>
        </Group>
      </Paper>
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </div>
  );
}

/**
 * Inline code for a single line, fenced block for several lines.
 * @param {string} text Text.
 * @param {number} start Selection start.
 * @param {number} end Selection end.
 * @returns {EditResult} New text and selection.
 */
function codeCommand(text: string, start: number, end: number): EditResult {
  const selected = text.slice(start, end);
  if (!selected.includes('\n')) return wrapSelection(text, start, end, '`', '`', 'code');
  const before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const block = `${before}\`\`\`\n${selected}\n\`\`\`\n`;
  return {
    value: text.slice(0, start) + block + text.slice(end),
    selectionStart: start + before.length + 4,
    selectionEnd: start + before.length + 4 + selected.length,
  };
}
