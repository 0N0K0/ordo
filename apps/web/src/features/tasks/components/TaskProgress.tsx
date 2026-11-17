import { Group, Progress, Text, type MantineSize } from '@mantine/core';
import type { ReactNode } from 'react';
import { countOf } from '../../../lib/text';

/**
 * Progress of a set of tasks (a milestone, a sprint, the sub-tasks of a task): its bar and « 3/5 tâches », with more
 * after it when given.
 * @param {{ done: number, total: number, label: string, extra?: ReactNode, size?: MantineSize, unit?: boolean }} props Tasks closed, tasks, accessible name of the bar, more after it, size of the bar, and whether « tâches » follows the count (default true).
 * @returns {JSX.Element} Progress.
 */
export function TaskProgress({ done, total, label, extra, size, unit = true }: { done: number; total: number; label: string; extra?: ReactNode; size?: MantineSize; unit?: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Progress value={total ? (done / total) * 100 : 0} size={size} style={{ flex: 1 }} aria-label={label} />
      <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
        {done}/{unit ? countOf(total, 'tâche') : total}
        {extra}
      </Text>
    </Group>
  );
}
