import { HourglassMediumIcon } from '@phosphor-icons/react';
import { Tooltip } from '@mantine/core';

/**
 * Hourglass of a routine waiting for others, naming them in its tooltip; nothing when it waits for none.
 * @param {{ waiting: readonly { label: string }[] }} props Routines it waits for.
 * @returns {JSX.Element | null} Icon.
 */
export function WaitingIcon({ waiting }: { waiting: readonly { label: string }[] }) {
  if (waiting.length === 0) return null;
  return (
    <Tooltip label={`En attente de : ${waiting.map((item) => item.label).join(', ')}`}>
      <HourglassMediumIcon aria-label="En attente" color="var(--mantine-color-orange-6)" />
    </Tooltip>
  );
}
