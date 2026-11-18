import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { ActionsMenu, type RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import type { ReferenceTargets } from '../../../components/markdown/remark-references';

interface PlanCardProps {
  icon: ReactNode;
  title: string;
  /** Badges after the title (state, lateness). Optional. */
  badges?: ReactNode;
  /** Line of its dates, under the title. */
  dates: ReactNode;
  /** Color of the dates line (red: late). Optional. Default = dimmed. */
  datesColor?: string;
  /** Its menu: edit, delete. */
  actions: readonly RowMenuEntry[];
  /** Progress of its tasks. */
  progress: ReactNode;
  /** Description (or goal), its boxes ticked in place. Optional. */
  description?: string | null;
  targets: ReferenceTargets;
  /** Saves its description with a box ticked; none: read only (archived). Optional. */
  onDescription?: (description: string) => void;
}

/**
 * Content of the card of a milestone or a sprint: icon, title and badges, dates, its menu, the progress of its tasks
 * and its description.
 * @param {PlanCardProps} props Component props.
 * @returns {JSX.Element} Card content.
 */
export function PlanCard({ icon, title, badges, dates, datesColor = 'dimmed', actions, progress, description, targets, onDescription }: PlanCardProps) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            {icon}
            <Title order={3} size="h5">
              {title}
            </Title>
            {badges}
          </Group>
          <Text size="sm" c={datesColor} fw={datesColor === 'red' ? 600 : undefined}>
            {dates}
          </Text>
        </Stack>
        <ActionsMenu name={title} items={actions} />
      </Group>
      {progress}
      {description && (
        <MarkdownView targets={targets} onChange={onDescription}>
          {description}
        </MarkdownView>
      )}
    </Stack>
  );
}
