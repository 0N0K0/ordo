import { Button, Center, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { CompassIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';

/**
 * 404 page with a way back home.
 * @returns {JSX.Element} Not found page.
 */
export function NotFoundPage() {
  return (
    <Center h="100dvh" p="md">
      <Stack align="center" gap="md">
        <ThemeIcon size={72} radius="xl" variant="light" color="gray">
          <CompassIcon size="60%" weight="duotone" aria-hidden />
        </ThemeIcon>
        <Text fw={700} size="xl" c="dimmed">
          404
        </Text>
        <Title order={1} size="h3">
          Page introuvable
        </Title>
        <Text c="dimmed" ta="center">
          L’adresse demandée n’existe pas ou a été déplacée.
        </Text>
        <Button component={Link} to="/">
          Retour à l’accueil
        </Button>
      </Stack>
    </Center>
  );
}
