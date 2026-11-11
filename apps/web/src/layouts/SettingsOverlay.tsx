import { Overlay, Transition } from '@mantine/core';
import { useEffect } from 'react';
import classes from './SettingsOverlay.module.css';

/**
 * Veil over the page content while the settings sidebar is open (the header and the navigation stay usable): a
 * click on it, or Escape, closes the settings.
 * @param {{ opened: boolean, onClose: () => void }} props Component props.
 * @param {boolean} props.opened Settings open.
 * @param {() => void} props.onClose Closes them.
 * @returns {JSX.Element} Veil.
 */
export function SettingsOverlay({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!opened) return;
    const onKey = (event: KeyboardEvent) => {
      // A dialog or a menu open over the settings closes first.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"][aria-modal="true"], [role="listbox"], [role="menu"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened, onClose]);

  return (
    <Transition mounted={opened} transition="fade" duration={150}>
      {(styles) => <Overlay className={classes.overlay} style={styles} backgroundOpacity={0.35} color="#000" onClick={onClose} aria-hidden />}
    </Transition>
  );
}
