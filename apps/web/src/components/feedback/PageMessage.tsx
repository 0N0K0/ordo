import { Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { HouseIcon } from '@phosphor-icons/react';
import { PAGES } from '../../app/pages';
import { ActionButton } from '../actions/ActionButton';

interface PageMessageProps {
  /** Icon of what happened. */
  icon: ReactNode;
  title: string;
  /** What happened, and why. */
  message: ReactNode;
  /** HTTP code of the error (« 404 »), above the title. Optional. */
  code?: string;
}

/**
 * Page that cannot be shown (not found, not available in this workspace…): its icon, its title, what happened and a
 * way back home.
 * @param {PageMessageProps} props Component props.
 * @returns {JSX.Element} Message.
 */
export function PageMessage({ icon, title, message, code }: PageMessageProps) {
  return (
    <Stack align="center" gap="md" py="xl">
      <ThemeIcon size={64} radius="xl" variant="light" color="gray">
        {icon}
      </ThemeIcon>
      {code && (
        <Text fw={700} size="xl" c="dimmed">
          {code}
        </Text>
      )}
      <Title order={1} size="h3">
        {title}
      </Title>
      <Text c="dimmed" ta="center">
        {message}
      </Text>
      <ActionButton to={PAGES.home.path} icon={<HouseIcon aria-hidden />}>
        Retour à l’accueil
      </ActionButton>
    </Stack>
  );
}
