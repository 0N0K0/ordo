import { Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Tooltip of an action button that also shows when the button is disabled (a disabled button gets no pointer events:
 * Mantine's pattern, the button wrapped in an element that gets them).
 * @param {{ label: ReactNode, disabled?: boolean, wrapped?: boolean, children: ReactNode }} props Component props: the tooltip, whether the button is disabled (optional), whether
 * the control is always wrapped (a switch, whose root takes no ref; optional), the button.
 * @returns {JSX.Element} Tooltip and button.
 */
export function ActionTooltip({ label, disabled = false, wrapped = false, children }: { label: ReactNode; disabled?: boolean; wrapped?: boolean; children: ReactNode }) {
  if (!disabled && !wrapped) return <Tooltip label={label}>{children}</Tooltip>;
  return (
    <Tooltip label={label}>
      <span style={{ display: 'inline-flex', flexShrink: 0, ...(disabled && { cursor: 'not-allowed' }) }}>{children}</span>
    </Tooltip>
  );
}
