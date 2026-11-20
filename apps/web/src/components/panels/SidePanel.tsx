import { Drawer, Text, type DrawerProps } from '@mantine/core';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { closePanel, PanelFlushContext, useOpenPanels, type PanelFlush, type PanelSize } from './panels';

/** Width of each size of panel: a form, or a wide one (the width of the panel of a task). */
const WIDTHS: Record<PanelSize, string> = { md: 'min(40rem, 100%)', lg: 'min(72rem, 100%)' };

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
 * content. Closed by its close button, Escape or a click outside, it first saves what its content has not saved yet
 * (the field being typed, `usePanelFlush`); when a field is invalid, so not saved, it stays open the first time, the
 * field focused with its error under it; closed again, it closes (the invalid value is not saved).
 * @param {SidePanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SidePanel({ title, size = 'md', children, onClose, ...props }: SidePanelProps) {
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

  return (
    <Drawer position="right" size={WIDTHS[size]} padding="lg" zIndex={PANEL_Z_INDEX} title={<PanelTitle>{title}</PanelTitle>} closeButtonProps={{ 'aria-label': 'Fermer' }} onClose={close} {...props}>
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
