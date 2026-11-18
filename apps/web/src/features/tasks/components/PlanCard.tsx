import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { ActionsMenu, type RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { plural } from '../../../lib/text';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import type { ReferenceTargets } from '../../../components/markdown/remark-references';

interface PlanCardProps {
  icon: ReactNode;
  title: string;
  /** Archived: its badge after the title. */
  archived: boolean;
  /** Badges after the title (its state). Optional. */
  badges?: ReactNode;
  /** Past its end with tasks left: how many, in a red badge (decision AF). Optional. Default = not late. */
  late?: number;
  /** Line of its dates, under the title. */
  dates: ReactNode;
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
 * Content of the card of a milestone or a sprint: icon, title and badges (archived, state, lateness in red), dates, its
 * menu, the progress of its tasks and its description.
 * @param {PlanCardProps} props Component props.
 * @returns {JSX.Element} Card content.
 */
export function PlanCard({ icon, title, archived, badges, late = 0, dates, actions, progress, description, targets, onDescription }: PlanCardProps) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            {icon}
            <Title order={3} size="h5">
              {title}
            </Title>
            {archived && <ArchivedBadge size="sm" />}
            {badges}
            {late > 0 && (
              <Badge size="sm" variant="light" color="red">
                {late} {plural(late, 'tâche')} non {plural(late, 'terminée')}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
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
