import { Anchor, Text, Typography } from '@mantine/core';
import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { remarkReferences, type ReferenceTargets } from './remark-references';

const components: Components = {
  /**
   * Internal links (task and mention references) use the router; external ones open in a new tab.
   * @param {object} props Anchor props.
   * @returns {JSX.Element} Link.
   */
  a: ({ href = '', children }) =>
    href.startsWith('/') ? (
      <Anchor component={Link} to={href} fw={600}>
        {children}
      </Anchor>
    ) : (
      <Anchor href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Anchor>
    ),
};

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
