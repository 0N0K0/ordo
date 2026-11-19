import { Anchor, Stack } from '@mantine/core';
import { Children, useState, type ReactNode } from 'react';
import { MAX_STACKED, stackedCount } from './stacked';
import { foldAction } from '../../actions/fold-label';

/**
 * Button unfolding or folding values (of a cell, of a multi-select): « X de plus », then « Réduire ».
 * @param {{ hidden: number, expanded: boolean, onToggle: () => void, className?: string, keepFocus?: boolean }} props Values folded, unfolded, toggle, class (optional),
 * and whether the focus stays where it is, in a field (optional, default = false).
 * @returns {JSX.Element} Button.
 */
export function StackedToggle({ hidden, expanded, onToggle, className, keepFocus = false }: { hidden: number; expanded: boolean; onToggle: () => void; className?: string; keepFocus?: boolean }) {
  return (
    <Anchor
      // eslint-disable-next-line no-restricted-syntax -- a link-like toggle among the values of a cell, at their size.
      component="button"
      type="button"
      size="xs"
      className={className}
      aria-expanded={expanded}
      onMouseDown={keepFocus ? (event: React.MouseEvent) => event.preventDefault() : undefined}
      onClick={(event: React.MouseEvent) => {
        // The row does not open, nor the list of a field.
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      {/* eslint-disable-next-line no-restricted-syntax -- StackedToggle itself. */}
      {expanded ? foldAction(true) : `${hidden} de plus`}
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
