import { Text, Title } from '@mantine/core';
import { useMe } from '../features/auth/api';

/**
 * Home page of the logged-in area (placeholder until business features exist).
 * @returns {JSX.Element} Home page.
 */
export function HomePage() {
  const { data: user } = useMe();

  return (
    <>
      <Title order={1} size="h2">
        Bonjour {user?.username}
      </Title>
      <Text c="dimmed">Les modules métier arrivent bientôt.</Text>
    </>
  );
}
