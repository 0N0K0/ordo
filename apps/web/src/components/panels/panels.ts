import { useSyncExternalStore, type ReactNode } from 'react';

/** Width of a side panel: a form (md), or a wide one, as the panel of a task (lg). */
export type PanelSize = 'md' | 'lg';

/** Side panel opened on the right of the page. */
export interface OpenPanel {
  panelId: string;
  title: ReactNode;
  size: PanelSize;
  children: ReactNode;
  /** Called once the panel is closed (by its close button, Escape, a click outside or `closePanel`). Optional. */
  onClose?: () => void;
  /** Closed by its content only (a form asking first whether to keep what was written). Optional. */
  locked?: boolean;
}

let opened: OpenPanel[] = [];
const listeners = new Set<() => void>();
let count = 0;

/**
 * Tells the panel host the panels changed.
 * @returns {void}
 */
const emit = () => listeners.forEach((listener) => listener());

/**
 * Opens a form in the side panel on the right (the one of every form, as the one of the tasks); a panel already open
 * with the same id is replaced.
 * @param {{ panelId?: string, title: ReactNode, size?: PanelSize, children: ReactNode, onClose?: () => void, locked?: boolean }} panel Panel.
 * @returns {string} Id of the panel.
 */
export function openPanel({
  panelId = `panel-${++count}`,
  title,
  size = 'md',
  children,
  onClose,
  locked = false,
}: {
  panelId?: string;
  title: ReactNode;
  size?: PanelSize;
  children: ReactNode;
  onClose?: () => void;
  locked?: boolean;
}): string {
  opened = [...opened.filter((panel) => panel.panelId !== panelId), { panelId, title, size, children, onClose, locked }];
  emit();
  return panelId;
}

/**
 * Closes a side panel.
 * @param {string} panelId Id of the panel.
 * @returns {void}
 */
export function closePanel(panelId: string): void {
  const panel = opened.find((item) => item.panelId === panelId);
  if (!panel) return;
  opened = opened.filter((item) => item.panelId !== panelId);
  emit();
  panel.onClose?.();
}

/**
 * Opens a form in the side panel, given a function closing it.
 * @param {string} title Title of the panel.
 * @param {(close: () => void) => ReactNode} render Content, given its closing.
 * @param {PanelSize} [size] Width. Optional. Default = 'md'.
 * @returns {void}
 */
export function openFormPanel(title: string, render: (close: () => void) => ReactNode, size: PanelSize = 'md'): void {
  const panelId = `panel-${++count}`;
  openPanel({ panelId, title, size, children: render(() => closePanel(panelId)) });
}

/**
 * Side panels open, the last one on top.
 * @returns {OpenPanel[]} Panels.
 */
export function useOpenPanels(): OpenPanel[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => opened,
  );
}
