import { Anchor, Group } from '@mantine/core';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Way back of a detail page, above its title like a breadcrumb: « ← Facturation », a small text link to its list.
 * @param {{ to: string, children: ReactNode }} props Address of the list, and its name.
 * @returns {JSX.Element} Link.
 */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Anchor component={Link} to={to} size="sm" w="fit-content">
      <Group gap={4} wrap="nowrap" component="span">
        <ArrowLeftIcon aria-hidden />
        {children}
      </Group>
    </Anchor>
  );
}
