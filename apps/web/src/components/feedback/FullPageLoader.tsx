import { Center, Loader } from '@mantine/core';

/**
 * Loader filling the page, while what every page needs loads (the session, the workspace).
 * @param {{ label: string }} props Accessible label of the loader.
 * @returns {JSX.Element} Loader.
 */
export function FullPageLoader({ label }: { label: string }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- FullPageLoader itself.
    <Center h="100dvh">
      <Loader aria-label={label} />
    </Center>
  );
}
