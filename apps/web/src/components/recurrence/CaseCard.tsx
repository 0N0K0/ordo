import { ActionIcon, Collapse, Group, Paper, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { CaretDownIcon, CaretRightIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface CaseCardProps {
  /** Number of the case, from 1. */
  index: number;
  /** The case told in words. */
  summary: string;
  /** It can be folded (several cases). */
  collapsible: boolean;
  opened: boolean;
  onToggle: () => void;
  /** Removes the case; none: it cannot be. Optional. */
  onRemove?: () => void;
  children: ReactNode;
}

/**
 * One case of a repetition (routine, schedule): « Cas 2 · its summary », folded or unfolded when there are several,
 * removable.
 * @param {CaseCardProps} props Component props.
 * @returns {JSX.Element} Case.
 */
export function CaseCard({ index, summary, collapsible, opened, onToggle, onRemove, children }: CaseCardProps) {
  const shown = !collapsible || opened;
  const heading = (
    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
      {collapsible && (shown ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />)}
      <Text size="xs" c="dimmed" truncate={!shown}>
        Cas {index} · {summary}
      </Text>
    </Group>
  );
  return (
    <Paper withBorder radius="sm" p="sm">
      <Stack gap={shown ? 'xs' : 0}>
        <Group justify="space-between" wrap="nowrap">
          {collapsible ? (
            <UnstyledButton onClick={onToggle} aria-expanded={shown} style={{ minWidth: 0, flex: 1 }}>
              {heading}
            </UnstyledButton>
          ) : (
            heading
          )}
          {onRemove && (
            <Tooltip label="Retirer le cas">
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Retirer le cas ${index}`} onClick={onRemove}>
                <TrashIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        <Collapse expanded={shown}>
          <Stack gap="xs">{children}</Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
