import { CheckIcon, HourglassMediumIcon } from '@phosphor-icons/react';

/**
 * Icon of a dependency in a cell: a green check once done, an orange hourglass while it is waited for.
 * @param {{ done: boolean }} props Component props: whether the dependency is done.
 * @returns {JSX.Element} Icon.
 */
export function DependencyIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckIcon aria-hidden color="var(--mantine-color-green-6)" style={{ flexShrink: 0 }} />
  ) : (
    <HourglassMediumIcon aria-hidden color="var(--mantine-color-orange-6)" style={{ flexShrink: 0 }} />
  );
}
