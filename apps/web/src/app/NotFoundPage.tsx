import { Center } from '@mantine/core';
import { CompassIcon } from '@phosphor-icons/react';
import { PageMessage } from '../components/feedback/PageMessage';

/**
 * 404 page with a way back home.
 * @returns {JSX.Element} Not found page.
 */
export function NotFoundPage() {
  return (
    <Center h="100dvh" p="md">
      <PageMessage code="404" icon={<CompassIcon size="60%" weight="duotone" aria-hidden />} title="Page introuvable" message="L’adresse demandée n’existe pas ou a été déplacée." />
    </Center>
  );
}
