import { Group, Progress, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { countOf } from '../../../lib/text';

/**
 * Progress of a set of tasks (a milestone, a sprint): its bar and « 3/5 tâches », with more after it when given.
 * @param {{ done: number, total: number, label: string, extra?: ReactNode }} props Tasks closed, tasks, accessible name of the bar, and more. Optional.
 * @returns {JSX.Element} Progress.
 */
export function TaskProgress({ done, total, label, extra }: { done: number; total: number; label: string; extra?: ReactNode }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Progress value={total ? (done / total) * 100 : 0} style={{ flex: 1 }} aria-label={label} />
      <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
        {done}/{countOf(total, 'tâche')}
        {extra}
      </Text>
    </Group>
  );
}
