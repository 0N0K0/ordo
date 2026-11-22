import { Anchor, Stack, Text, type MantineSize } from '@mantine/core';
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
 * @param {{ children: ReactNode, gap?: number, wrap?: (values: ReactNode) => ReactNode }} props Values (each child is one), the gap between them (optional,
 * default = 2), and what holds the values shown, « X de plus » kept out of it (the button opening the editor of the cell…). Optional.
 * @returns {JSX.Element | null} Values.
 */
export function StackedValues({ children, gap = 2, wrap }: { children: ReactNode; gap?: number; wrap?: (values: ReactNode) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const values = Children.toArray(children);
  if (!values.length) return null;
  const shown = stackedCount(values.length, expanded);
  const toggle = values.length > MAX_STACKED && <StackedToggle hidden={values.length - shown} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />;
  const list = values.slice(0, shown);
  return (
    <Stack gap={gap} align="flex-start" style={{ minWidth: 0 }}>
      {wrap
        ? wrap(
            <Stack gap={gap} style={{ minWidth: 0 }}>
              {list}
            </Stack>,
          )
        : list}
      {toggle}
    </Stack>
  );
}

interface StackedLinesProps {
  /** Values, a line each. */
  lines: readonly string[];
  /** Size of the text. Optional. Default = « sm ». */
  size?: MantineSize;
  /** Color of the text. Optional. */
  c?: string;
  /** Shown without any line. Optional. Default = nothing. */
  empty?: ReactNode;
  /** What holds the lines shown (the button opening the editor of the cell…), « X de plus » kept out of it. Optional. */
  wrap?: (values: ReactNode) => ReactNode;
}

/**
 * Several texts of a cell (cases of a repetition, names, zones of a place…), a line each, one under the other: cut
 * when too long (whole on hover), folded beyond 5 (`StackedValues`).
 * @param {StackedLinesProps} props Component props.
 * @returns {JSX.Element | null} Lines.
 */
export function StackedLines({ lines, size = 'sm', c, empty = null, wrap }: StackedLinesProps) {
  if (!lines.length) return <>{wrap ? wrap(empty) : empty}</>;
  return (
    <StackedValues wrap={wrap}>
      {lines.map((line, index) => (
        <Text key={index} component="div" size={size} c={c} truncate title={line} maw="100%">
          {line}
        </Text>
      ))}
    </StackedValues>
  );
}
