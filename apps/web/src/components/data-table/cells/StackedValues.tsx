import { Anchor, Stack } from '@mantine/core';
import { Children, useState, type ReactNode } from 'react';
import { MAX_STACKED, stackedCount } from './stacked';

/**
 * Button unfolding or folding the values of a cell.
 * @param {{ hidden: number, expanded: boolean, onToggle: () => void }} props Values folded, unfolded, toggle.
 * @returns {JSX.Element} Button.
 */
export function StackedToggle({ hidden, expanded, onToggle }: { hidden: number; expanded: boolean; onToggle: () => void }) {
  return (
    <Anchor
      component="button"
      type="button"
      size="xs"
      aria-expanded={expanded}
      onClick={(event: React.MouseEvent) => {
        // The row does not open.
        event.stopPropagation();
        onToggle();
      }}
    >
      {expanded ? 'Réduire' : `${hidden} de plus`}
    </Anchor>
  );
}

/**
 * Several values of a cell, one under the other: up to 5; beyond, 4 and « X de plus », unfolded or folded again.
 * @param {{ children: ReactNode, gap?: number }} props Values (each child is one), and the gap between them. Optional. Default = 2.
 * @returns {JSX.Element | null} Values.
 */
export function StackedValues({ children, gap = 2 }: { children: ReactNode; gap?: number }) {
  const [expanded, setExpanded] = useState(false);
  const values = Children.toArray(children);
  if (!values.length) return null;
  const shown = stackedCount(values.length, expanded);
  return (
    <Stack gap={gap} align="flex-start" style={{ minWidth: 0 }}>
      {values.slice(0, shown)}
      {values.length > MAX_STACKED && <StackedToggle hidden={values.length - shown} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />}
    </Stack>
  );
}
