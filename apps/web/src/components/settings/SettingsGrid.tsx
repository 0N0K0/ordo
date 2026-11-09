import type { ReactNode } from 'react';
import classes from './SettingsGrid.module.css';

/**
 * Sections of a settings tab as cards: a third of the width each, three side by side at most, fewer when that
 * would be narrower than their minimum (one on a phone); an incomplete row is centered, top-aligned.
 * @param {{ children: ReactNode }} props Sections.
 * @returns {JSX.Element} Grid.
 */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className={classes.grid}>{children}</div>;
}
