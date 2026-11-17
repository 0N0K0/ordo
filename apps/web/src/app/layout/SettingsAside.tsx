import { ActionIcon, AppShell, Group, ScrollArea, Title, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { XIcon } from '@phosphor-icons/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePageSettings, useSettingsOpened } from './page-settings';
import classes from './SettingsAside.module.css';

interface SettingsAsideProps {
  onContainer: (element: HTMLDivElement | null) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeReset: () => void;
}

/**
 * Sidebar on the right holding the settings of the page (drawn by the page through PageSettings), resized from its
 * left edge.
 * @param {SettingsAsideProps} props Component props.
 * @param {(element: HTMLDivElement | null) => void} props.onContainer Receives the element the settings go in.
 * @param {(event: ReactPointerEvent<HTMLElement>) => void} props.onResizeStart Starts resizing from the handle.
 * @param {() => void} props.onResizeReset Double click on the handle: the minimum width.
 * @returns {JSX.Element} Sidebar.
 */
export function SettingsAside({ onContainer, onResizeStart, onResizeReset }: SettingsAsideProps) {
  const { title } = usePageSettings();
  const { setOpened } = useSettingsOpened();
  const mobile = useMediaQuery('(max-width: 48em)');
  return (
    <AppShell.Aside aria-label={title ?? 'Paramètres'}>
      {/* Its left edge resizes it (not on a phone: it takes the whole width there). */}
      {!mobile && (
        <div className={classes.resizeHandle} role="separator" aria-orientation="vertical" aria-label="Redimensionner les paramètres" onPointerDown={onResizeStart} onDoubleClick={onResizeReset} />
      )}
      <Group justify="space-between" wrap="nowrap" className={classes.header}>
        <Title order={2} size="h4">
          {title ?? 'Paramètres'}
        </Title>
        <Tooltip label="Fermer">
          <ActionIcon variant="subtle" color="gray" aria-label="Fermer les paramètres" onClick={() => setOpened(false)}>
            <XIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ScrollArea type="auto" className={classes.body}>
        <div ref={onContainer} className={classes.content} />
      </ScrollArea>
    </AppShell.Aside>
  );
}
