import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

/** Width of a side panel: a form (md), or a wide one, as the panel of a task (lg). */
export type PanelSize = 'md' | 'lg';

/** Side panel opened on the right of the page. */
interface OpenPanel {
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
function openPanel({
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

/** Options of a form panel: its width, whether only its content closes it, what follows its closing, its id. */
interface FormPanelOptions {
  size?: PanelSize;
  /** Id of the panel: opened again, it replaces itself (the panel of a chart). Optional. Default = a new one. */
  panelId?: string;
  locked?: boolean;
  onClose?: () => void;
}

/**
 * Opens a form in the side panel, given a function closing it: how every form of the app opens.
 * @param {ReactNode} title Title of the panel.
 * @param {(close: () => void) => ReactNode} render Content, given its closing.
 * @param {PanelSize | FormPanelOptions} [options] Width, or the options of the panel. Optional. Default = 'md'.
 * @returns {() => void} Closes the panel.
 */
export function openFormPanel(title: ReactNode, render: (close: () => void) => ReactNode, options: PanelSize | FormPanelOptions = {}): () => void {
  const { size = 'md', locked = false, onClose, panelId = `panel-${++count}` } = typeof options === 'string' ? { size: options } : options;
  const close = () => closePanel(panelId);
  openPanel({ panelId, title, size, locked, onClose, children: render(close) });
  return close;
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

/**
 * Saves what a panel's content holds and has not saved yet (a text being typed), before the panel closes; false when a
 * field is invalid, so not saved (its error shown under it).
 */
export type PanelFlush = () => boolean;

/** Registration of a flush with the side panel holding it (`SidePanel`); gives the unregistration. None outside a panel. */
export const PanelFlushContext = createContext<((flush: PanelFlush) => () => void) | null>(null);

/**
 * Saves what the component holds and has not saved yet: before the side panel holding it closes by its close button,
 * Escape or a click outside (it stays open once when the flush finds an invalid field, `SidePanel`), when the
 * component goes away (its panel closed by its content or replaced, another page) and when the browser leaves the page
 * (`pagehide`, as far as the browser lets the request go). `useFieldSave` and `useLocationDraft` use it: a text being
 * typed is not lost.
 * @param {PanelFlush} flush Flush (the last one given is called).
 * @returns {void}
 */
export function usePanelFlush(flush: PanelFlush): void {
  const register = useContext(PanelFlushContext);
  const latest = useRef(flush);
  useEffect(() => {
    latest.current = flush;
  });
  useEffect(() => register?.(() => latest.current()), [register]);
  useEffect(() => {
    /**
     * Saves what was not saved yet, without waiting (the component or the page going away).
     * @returns {void}
     */
    const leave = () => void latest.current();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, []);
}
