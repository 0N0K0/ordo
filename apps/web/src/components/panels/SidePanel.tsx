import { Drawer, Text, type DrawerProps } from '@mantine/core';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useIsPhone } from '../../lib/use-is-phone';
import { SIDE_PANELS } from './panel-widths';
import { closePanel, PanelFlushContext, useOpenPanels, type PanelFlush, type PanelSize } from './panels';
import { ResizeHandle } from './ResizeHandle';
import classes from './SidePanel.module.css';
import { useResizablePanel } from './use-resizable-panel';

/** Under the dialogs (a confirmation asked from a panel shows over it). */
const PANEL_Z_INDEX = 190;

interface SidePanelProps extends Omit<DrawerProps, 'position' | 'size' | 'title' | 'padding'> {
  title: ReactNode;
  /** Width. Optional. Default = 'md'. */
  size?: PanelSize;
}

/**
 * Title of a panel on the right, the same in the side panels and the settings of a page (decision CL).
 * @param {{ children: ReactNode }} props Component props: the title.
 * @returns {JSX.Element} Title.
 */
export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" fw={600}>
      {children}
    </Text>
  );
}

/**
 * Side panel on the right of the page, the one of every form and detail (as the panel of a task): its title, then its
 * content. Resized from its left edge as the navigation sidebar (`useResizablePanel`, one kept width per size,
 * `SIDE_PANELS`): dragged below its minimum it closes, a double click on the handle gives it its minimum width; on a
 * phone it takes the whole width, without handle. Closed by its close button, Escape, a click outside or its handle, it
 * first saves what its content has not saved yet (the field being typed, `usePanelFlush`); when a field is invalid, so
 * not saved, it stays open the first time, the field focused with its error under it; closed again, it closes (the
 * invalid value is not saved).
 * @param {SidePanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SidePanel({ title, size = 'md', children, onClose, opened, withCloseButton = true, ...props }: SidePanelProps) {
  const phone = useIsPhone();
  const [flushes] = useState(() => new Set<PanelFlush>());
  // A close refused once (an invalid field): the next one closes.
  const refused = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const register = useCallback(
    (flush: PanelFlush) => {
      flushes.add(flush);
      return () => {
        flushes.delete(flush);
      };
    },
    [flushes],
  );

  /**
   * Closes the panel once what its content holds is saved (kept open once on an invalid field).
   * @returns {void}
   */
  const close = () => {
    const saved = [...flushes].map((flush) => flush()).every(Boolean);
    if (!saved && !refused.current) {
      refused.current = true;
      // Its error shows on the next render: the field is focused then.
      requestAnimationFrame(() => content.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    refused.current = false;
    onClose();
  };
  // Dragged below its minimum, it closes as by its close button (dragged back, it is still open: nothing to do); a panel
  // without close button (`locked`: closed by its content only) does not.
  const resize = useResizablePanel({ ...SIDE_PANELS[size], opened, setOpened: (next) => !next && withCloseButton && close() });

  return (
    <Drawer
      opened={opened}
      position="right"
      size={phone ? '100%' : resize.width}
      padding="lg"
      zIndex={PANEL_Z_INDEX}
      title={<PanelTitle>{title}</PanelTitle>}
      withCloseButton={withCloseButton}
      closeButtonProps={{ 'aria-label': 'Fermer' }}
      onClose={close}
      classNames={{ root: classes.root, content: classes.content, body: classes.body }}
      data-resizing={resize.resizing || undefined}
      {...props}
    >
      {/* Its left edge resizes it (not on a phone: it takes the whole width there). */}
      {!phone && <ResizeHandle edge="left" label="Redimensionner le panneau" {...resize} />}
      <PanelFlushContext.Provider value={register}>
        <div ref={content} style={{ display: 'contents' }}>
          {children}
        </div>
      </PanelFlushContext.Provider>
    </Drawer>
  );
}

/**
 * Host of the side panels opened with `openPanel`, in the layout of the app.
 * @returns {JSX.Element} Panels.
 */
export function SidePanelHost() {
  const panels = useOpenPanels();
  return (
    <>
      {panels.map((panel) => (
        <SidePanel
          key={panel.panelId}
          opened
          title={panel.title}
          size={panel.size}
          onClose={() => closePanel(panel.panelId)}
          closeOnClickOutside={!panel.locked}
          closeOnEscape={!panel.locked}
          withCloseButton={!panel.locked}
        >
          {panel.children}
        </SidePanel>
      ))}
    </>
  );
}
