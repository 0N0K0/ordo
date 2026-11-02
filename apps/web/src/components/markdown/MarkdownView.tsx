import { Anchor, Text, Typography } from '@mantine/core';
import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link, useLocation } from 'react-router';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { remarkReferences, type ReferenceTargets } from './remark-references';

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

const components: Components = { a: MarkdownLink, img: MarkdownImage };

interface MarkdownViewProps {
  children: string | null | undefined;
  targets: ReferenceTargets;
  /** Text shown when there is no content. */
  emptyText?: string;
}

/**
 * Renders GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks), sanitized,
 * with "#12" and "@handle" references turned into links.
 * @param {MarkdownViewProps} props Component props.
 * @returns {JSX.Element} Rendered markdown.
 */
export function MarkdownView({ children, targets, emptyText = 'Aucune description.' }: MarkdownViewProps) {
  const remarkPlugins = useMemo(() => [remarkGfm, remarkReferences(targets)], [targets]);

  if (!children?.trim()) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        {emptyText}
      </Text>
    );
  }
  return (
    <Typography fz="sm">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeSanitize]} components={components}>
        {children}
      </ReactMarkdown>
    </Typography>
  );
}
