import { Group, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { ActionsMenu, type RowMenuEntry } from '../actions/ActionsMenu';
import type { ActionsSubject } from '../actions/actions-subject';
import { BackLink } from './BackLink';

interface DetailHeaderProps {
  /** Way back to the list, above the title (« ← Facturation »). Optional. */
  back?: { to: string; label: ReactNode };
  /** Header of the page (PageHeader), between the way back and the name. Optional. */
  page?: ReactNode;
  /** Name of the element (an h3). */
  title: ReactNode;
  /** Level of the heading: 1 on a page without PageHeader, 2 under one (or in a panel). Optional. Default = 2. */
  order?: 1 | 2;
  /** Badges after the name (state, archived…). Optional. */
  badges?: ReactNode;
  /** Line(s) under the name (its origin, counts, links…). Optional. */
  subtitle?: ReactNode;
  /** Buttons on the right (ActionButton, IconAction…), before the menu. Optional. */
  actions?: ReactNode;
  /** « … » menu of the element: its name or what it is (ActionsSubject: « la tâche ») and its entries; « Archiver » always goes there. Optional. */
  menu?: ActionsSubject & { items: readonly RowMenuEntry[] };
  /** Smaller menu button, for a header of xs buttons (a side panel). Optional. Default = false. */
  compact?: boolean;
}

/**
 * Header of the page (or panel) of an element, the same everywhere (decision R): the way back, the name in h3 with its
 * badges and what is under it, then its actions and its « … » menu on the right.
 * @param {DetailHeaderProps} props Component props.
 * @returns {JSX.Element} Header.
 */
export function DetailHeader({ back, page, title, order = 2, badges, subtitle, actions, menu, compact = false }: DetailHeaderProps) {
  return (
    <Stack gap={4}>
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      {page}
      <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs">
            <Title order={order} size="h3" style={{ wordBreak: 'break-word' }}>
              {title}
            </Title>
            {badges}
          </Group>
          {subtitle}
        </Stack>
        {(actions || menu) && (
          <Group gap="xs" ml="auto" wrap="wrap">
            {actions}
            {menu && <ActionsMenu name={menu.name} about={menu.about} items={menu.items} variant="default" size={compact ? 'input-xs' : 'input-sm'} />}
          </Group>
        )}
      </Group>
    </Stack>
  );
}
