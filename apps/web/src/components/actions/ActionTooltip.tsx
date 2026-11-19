import { Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Tooltip of an action button that also shows when the button is disabled (a disabled button gets no pointer events:
 * Mantine's pattern, the button wrapped in an element that gets them).
 * @param {{ label: ReactNode, disabled?: boolean, children: ReactNode }} props Component props: the tooltip, whether the button is disabled (optional), the button.
 * @returns {JSX.Element} Tooltip and button.
 */
export function ActionTooltip({ label, disabled = false, children }: { label: ReactNode; disabled?: boolean; children: ReactNode }) {
  return <Tooltip label={label}>{disabled ? <span style={{ display: 'inline-flex', cursor: 'not-allowed' }}>{children}</span> : children}</Tooltip>;
}
