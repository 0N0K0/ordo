import { IconAction } from '../../components/actions/IconAction';
import { AppShell, Group, ScrollArea } from '@mantine/core';
import { PanelTitle } from '../../components/panels/SidePanel';
import { XIcon } from '@phosphor-icons/react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ResizeHandle } from '../../components/panels/ResizeHandle';
import { usePageSettings, useSettingsOpened } from './page-settings';
import classes from './SettingsAside.module.css';
import { useIsPhone } from '../../lib/use-is-phone';

interface SettingsAsideProps {
  onContainer: (element: HTMLDivElement | null) => void;
  /** Resizing of the sidebar (useResizablePanel). */
  resize: { resizing: boolean; onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void; onResizeReset: (event: ReactMouseEvent<HTMLElement>) => void };
}

/**
 * Sidebar on the right holding the settings of the page (drawn by the page through PageSettings), resized from its
 * left edge.
 * @param {SettingsAsideProps} props Component props.
 * @param {(element: HTMLDivElement | null) => void} props.onContainer Receives the element the settings go in.
 * @param {SettingsAsideProps['resize']} props.resize Resizing state and handlers of its handle.
 * @returns {JSX.Element} Sidebar.
 */
export function SettingsAside({ onContainer, resize }: SettingsAsideProps) {
  const { title } = usePageSettings();
  const { setOpened } = useSettingsOpened();
  const mobile = useIsPhone();
  return (
    <AppShell.Aside aria-label={title ?? 'Paramètres'}>
      {/* Its left edge resizes it (not on a phone: it takes the whole width there). */}
      {!mobile && <ResizeHandle edge="left" label="Redimensionner les paramètres" {...resize} />}
      <Group justify="space-between" wrap="nowrap" className={classes.header}>
        <PanelTitle>{title ?? 'Paramètres'}</PanelTitle>
        <IconAction label="Fermer" aria-label="Fermer les paramètres" onClick={() => setOpened(false)}>
          <XIcon aria-hidden />
        </IconAction>
      </Group>
      <ScrollArea type="auto" className={classes.body}>
        <div ref={onContainer} className={classes.content} />
      </ScrollArea>
    </AppShell.Aside>
  );
}
