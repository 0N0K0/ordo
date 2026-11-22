import { sheetPath } from '../../../app/pages';
import type { CountdownItem } from '../../countdowns/lib/countdowns';

/**
 * A sheet as the timers launched for it (its saved timers) keep it: its ring links to its page.
 * @param {{ id: string, label: string }} sheet Sheet.
 * @returns {CountdownItem} Item.
 */
export const sheetCountdownItem = (sheet: { id: string; label: string }): CountdownItem => ({ sheetId: sheet.id, subject: sheet.label, path: sheetPath(sheet.id), linkLabel: 'Ouvrir la fiche' });
