import { Text } from '@mantine/core';
import { Suspense } from 'react';
import { lazyNamed } from '../../lib/lazy';
import { TextSkeleton } from '../feedback/Skeletons';
import type { ReferenceTargets } from './remark-references';

const Renderer = lazyNamed(
  () => import('./MarkdownRenderer'),
  (module) => module.MarkdownRenderer,
);

export interface MarkdownViewProps {
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
 * unticked (the source is updated). The markdown libraries are loaded with the first text shown.
 * @param {MarkdownViewProps} props Component props.
 * @returns {JSX.Element} Rendered markdown.
 */
export function MarkdownView(props: MarkdownViewProps) {
  const { children, emptyText = 'Aucune description.' } = props;
  if (!children?.trim()) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        {emptyText}
      </Text>
    );
  }
  return (
    <Suspense fallback={<TextSkeleton lines={2} />}>
      <Renderer {...props} />
    </Suspense>
  );
}
