import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePageSettings, useSettingsOpened } from './page-settings';

/**
 * Settings of a page, drawn in the sidebar on the right while it is open (the ⚙ button of the header opens and
 * closes it, closed by default). They stay part of the page: its state and data.
 * @param {{ title: string, children: ReactNode }} props Component props.
 * @param {string} props.title Title of the sidebar.
 * @param {ReactNode} props.children Settings.
 * @returns {JSX.Element | null} Settings, in the sidebar.
 */
export function PageSettings({ title, children }: { title: string; children: ReactNode }) {
  const { setTitle, container } = usePageSettings();
  const { opened } = useSettingsOpened();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return opened && container ? createPortal(children, container) : null;
}
