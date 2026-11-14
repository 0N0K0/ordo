import { Drawer, Text, type DrawerProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { closePanel, useOpenPanels, type PanelSize } from './panels';

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
 * Side panel on the right of the page, the one of every form and detail (as the panel of a task): its title, then its
 * content.
 * @param {SidePanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SidePanel({ title, size = 'md', children, ...props }: SidePanelProps) {
  return (
    <Drawer
      position="right"
      size={WIDTHS[size]}
      padding="lg"
      zIndex={PANEL_Z_INDEX}
      title={
        <Text size="sm" fw={600}>
          {title}
        </Text>
      }
      {...props}
    >
      {children}
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
