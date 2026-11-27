import { Collapse, Group, Paper, Stack, Text } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import { FoldHeading } from '../actions/FoldHeading';

interface FoldCardProps {
  /** Its title, cut on one line while folded. */
  title: ReactNode;
  /** It can be folded. */
  collapsible: boolean;
  opened: boolean;
  onToggle: () => void;
  /** Before the title (a drag handle). Optional. */
  before?: ReactNode;
  /** After the title (remove, restore). Optional. */
  actions?: ReactNode;
  /** Node of the card (a sortable item). Optional. */
  cardRef?: (element: HTMLElement | null) => void;
  /** Style of the card (moved while dragged). Optional. */
  style?: CSSProperties;
  /** Raised above the others (dragged). Optional. Default = false. */
  raised?: boolean;
  /** Its settings, shown unfolded. Optional. */
  children?: ReactNode;
}

/**
 * Card of a list of settings that fold (the cases of a repetition, its exceptions): its title (the whole row clickable
 * when it folds, `FoldHeading`), its actions on the right, its settings under it.
 * @param {FoldCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
export function FoldCard({ title, collapsible, opened, onToggle, before, actions, cardRef, style, raised = false, children }: FoldCardProps) {
  const shown = !collapsible || opened;
  const heading = (
    <Text size="xs" c="dimmed" truncate={!shown}>
      {title}
    </Text>
  );
  return (
    <Paper ref={cardRef} withBorder radius="sm" p="sm" shadow={raised ? 'md' : undefined} style={style}>
      <Stack gap={shown && children ? 'xs' : 0}>
        <Group justify="space-between" wrap="nowrap" gap={4}>
          {before}
          {collapsible ? (
            <FoldHeading expanded={shown} onToggle={onToggle} style={{ flex: 1 }}>
              {heading}
            </FoldHeading>
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>{heading}</div>
          )}
          {actions}
        </Group>
        {children && (
          <Collapse expanded={shown}>
            <Stack gap="xs">{children}</Stack>
          </Collapse>
        )}
      </Stack>
    </Paper>
  );
}
