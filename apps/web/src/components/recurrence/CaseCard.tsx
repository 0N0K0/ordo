import { DragHandle } from '../actions/DragHandle';
import { useSortableItem } from '../actions/use-sortable-item';
import { Collapse, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { RemoveButton } from '../actions/RemoveButton';

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
  /** Its key among the cases, dragged by its handle to reorder them (within a sortable list). */
  sortId: string;
  /** It can be moved (several cases). */
  sortable: boolean;
  children: ReactNode;
}

/**
 * One case of a repetition (routine, schedule…): « Cas 2 · its summary », folded or unfolded when there are several,
 * moved by its handle (pointer or keyboard: the first one that fits a day wins), removable.
 * @param {CaseCardProps} props Component props.
 * @returns {JSX.Element} Case.
 */
export function CaseCard({ index, summary, collapsible, opened, onToggle, onRemove, sortId, sortable, children }: CaseCardProps) {
  const { ref, style, dragging, handle } = useSortableItem(sortId, !sortable);
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
    <Paper ref={ref} withBorder radius="sm" p="sm" shadow={dragging ? 'md' : undefined} style={style}>
      <Stack gap={shown ? 'xs' : 0}>
        <Group justify="space-between" wrap="nowrap" gap={4}>
          {sortable && <DragHandle label={`Déplacer le cas ${index}`} {...handle} size="sm" />}
          {collapsible ? (
            <UnstyledButton onClick={onToggle} aria-expanded={shown} style={{ minWidth: 0, flex: 1 }}>
              {heading}
            </UnstyledButton>
          ) : (
            heading
          )}
          {onRemove && <RemoveButton label="Retirer le cas" size="sm" aria-label={`Retirer le cas ${index}`} onClick={onRemove} />}
        </Group>
        <Collapse expanded={shown}>
          <Stack gap="xs">{children}</Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
