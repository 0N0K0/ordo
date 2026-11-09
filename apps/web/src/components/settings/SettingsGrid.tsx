import type { ReactNode } from 'react';
import classes from './SettingsGrid.module.css';

/**
 * Sections of a settings tab as cards: three side by side at most, fewer when they would be narrower than their
 * minimum (one on a phone), top-aligned.
 * @param {{ children: ReactNode }} props Sections.
 * @returns {JSX.Element} Grid.
 */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className={classes.grid}>{children}</div>;
}

/**
 * Section of a settings grid across its whole width (wide lists, long forms).
 * @param {{ children: ReactNode }} props Section.
 * @returns {JSX.Element} Cell.
 */
export function WideSetting({ children }: { children: ReactNode }) {
  return <div className={classes.wide}>{children}</div>;
}
