import { Anchor, Text, Typography } from '@mantine/core';
import { useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link, useLocation } from 'react-router';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { remarkReferences, type ReferenceTargets } from './remark-references';
import { remarkTaskOffsets, toggleTask } from './task-list';

/**
 * Markdown link: task references ("?task=12") open the task over the current page, internal paths use
 * the router, external links open in a new tab.
 * @param {object} props Anchor props.
 * @param {string} [props.href] Target. Optional.
 * @param {React.ReactNode} props.children Content.
 * @returns {JSX.Element} Link.
 */
function MarkdownLink({ href = '', children }: { href?: string; children?: React.ReactNode }) {
  const { pathname, search } = useLocation();
  if (href.startsWith('?')) {
    const params = new URLSearchParams(search);
    new URLSearchParams(href).forEach((value, key) => params.set(key, value));
    return (
      <Anchor component={Link} to={{ pathname, search: `?${params}` }} fw={600}>
        {children}
      </Anchor>
    );
  }
  // Attachments: downloaded, or opened in a new tab for images.
  if (href.startsWith('/api/attachments/')) {
    return (
      <Anchor href={href} target="_blank" rel="noopener">
        {children}
      </Anchor>
    );
  }
  if (href.startsWith('/')) {
    return (
      <Anchor component={Link} to={href} fw={600}>
        {children}
      </Anchor>
    );
  }
  return (
    <Anchor href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </Anchor>
  );
}

/**
 * Markdown image (attached images): fits the text width, opens full size on click.
 * @param {object} props Image props.
 * @param {string} [props.src] Source. Optional.
 * @param {string} [props.alt] Alternative text. Optional.
 * @returns {JSX.Element} Image.
 */
function MarkdownImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  if (typeof src !== 'string') return null;
  return (
    <a href={src} target="_blank" rel="noopener">
      <img src={src} alt={alt ?? ''} loading="lazy" style={{ maxWidth: '100%', height: 'auto' }} />
    </a>
  );
}

// The task item offsets survive the sanitizing.
const schema = { ...defaultSchema, attributes: { ...defaultSchema.attributes, li: [...(defaultSchema.attributes?.li ?? []), 'dataTaskOffset'] } };

const components: Components = { a: MarkdownLink, img: MarkdownImage };

interface MarkdownViewProps {
  children: string | null | undefined;
  targets: ReferenceTargets;
  /** Text shown when there is no content. */
  emptyText?: string;
  /** Called with the new markdown when a task box is ticked or unticked; boxes are read-only without it. */
  onChange?: (markdown: string) => void;
}

/**
 * Renders GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks), sanitized,
 * with "#12" and "@handle" references turned into links. With `onChange`, task boxes can be ticked and
 * unticked (the source is updated).
 * @param {MarkdownViewProps} props Component props.
 * @returns {JSX.Element} Rendered markdown.
 */
export function MarkdownView({ children, targets, emptyText = 'Aucune description.', onChange }: MarkdownViewProps) {
  // A ticked box shows at once, until the saved text comes back.
  const [pending, setPending] = useState<{ from: string | null | undefined; source: string } | null>(null);
  const source = pending && pending.from === children ? pending.source : children;
  const remarkPlugins = useMemo(() => [remarkGfm, remarkReferences(targets), remarkTaskOffsets], [targets]);
  const rendered = useMemo<Components>(
    () => ({
      ...components,
      // Task boxes: enabled when the text can change.
      input: ({ type, checked }) =>
        type === 'checkbox' ? (
          <input type="checkbox" checked={Boolean(checked)} disabled={!onChange} readOnly={!onChange} onChange={() => undefined} style={{ cursor: onChange ? 'pointer' : undefined }} />
        ) : null,
      li: ({ node, children: content, ...props }) => {
        const offset = Number(node?.properties?.dataTaskOffset);
        if (!onChange || !Number.isFinite(offset)) return <li {...props}>{content}</li>;
        return (
          <li
            {...props}
            onChange={(event) => {
              // Only the box of this item (not those of nested items).
              if ((event.target as HTMLElement).closest('li') !== event.currentTarget) return;
              event.stopPropagation();
              const next = toggleTask(source ?? '', offset);
              setPending({ from: children, source: next });
              onChange(next);
            }}
          >
            {content}
          </li>
        );
      },
    }),
    [onChange, children, source],
  );

  if (!source?.trim()) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        {emptyText}
      </Text>
    );
  }
  return (
    <Typography fz="sm">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[[rehypeSanitize, schema]]} components={rendered}>
        {source}
      </ReactMarkdown>
    </Typography>
  );
}
